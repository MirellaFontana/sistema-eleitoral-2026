import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { criarClienteIA, respostaErroIA } from "@/lib/ia-client";
import { montarContextoConhecimento, type TemaComItens } from "@/lib/anthropic";
import { obterContextoDiretrizes } from "@/lib/diretrizes-context";

const PAPEIS_QUE_GERAM = new Set(["coord_campanha", "coord_marketing", "redator_marketing"]);

const SISTEMA = `Você é estrategista de tráfego pago em campanha eleitoral brasileira.
Recebe (a) a descrição/copy de uma peça e (b) a base de conhecimento da campanha (temas,
públicos-alvo por tema, regiões prioritárias, propostas). Devolve UMA sugestão prática de
público prioritário para impulsionar essa peça no Meta Ads (Instagram/Facebook).

Formato de saída: UMA linha só, em português, entre 80 e 200 caracteres. Estrutura sugerida:
"[perfil demográfico], [interesses/comportamentos], [geografia]".

Exemplo: "Mulheres 35-55 anos, mães, interessadas em educação pública, moradoras da região
metropolitana de Curitiba e Vale do Ribeira."

Regras:
- Use APENAS informação da base de conhecimento e da peça. Nunca invente perfis.
- Se o tema da peça tem público-alvo cadastrado, priorize esse público.
- Se o tema tem regiões prioritárias, priorize essas regiões.
- Nunca cite dados sensíveis (raça, religião, orientação sexual, condição de saúde) — Meta bloqueia.
- Nunca inclua nomes de partido/concorrente na segmentação.
- Não escreva explicação, cabeçalho ou aviso — retorne APENAS a linha do público.`;

export async function POST(request: Request) {
  const body = await request.json();
  const { peca_descricao } = body as { peca_descricao: string };

  if (!peca_descricao?.trim()) {
    return NextResponse.json({ error: "descrição da peça é obrigatória" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  const limited = checkRateLimit(user.id);
  if (limited) return limited;

  const { data: eu } = await supabase
    .from("usuarios_internos")
    .select("papel, campanha_id, campanhas(nome_candidato, cargo, uf)")
    .eq("id", user.id)
    .maybeSingle();

  if (!eu || !PAPEIS_QUE_GERAM.has(eu.papel)) {
    return NextResponse.json({ error: "sem permissão" }, { status: 403 });
  }

  const ia = await criarClienteIA(supabase);
  if (!ia) {
    return NextResponse.json({ error: "Nenhuma chave de IA configurada." }, { status: 400 });
  }

  const { data: temasDb } = await supabase
    .from("temas_campanha")
    .select("nome, publicos_alvo, regioes_prioritarias, base_conhecimento_itens(titulo, descricao)")
    .order("ordem")
    .limit(20);

  const temasCtx: TemaComItens[] = (temasDb ?? []).map((t) => ({
    nome: t.nome,
    publicos_alvo: t.publicos_alvo ?? [],
    regioes_prioritarias: t.regioes_prioritarias ?? [],
    itens: (Array.isArray(t.base_conhecimento_itens)
      ? t.base_conhecimento_itens
      : []) as { titulo: string; descricao: string | null }[],
  }));

  const conhecimento = montarContextoConhecimento(temasCtx);
  const diretrizes = await obterContextoDiretrizes(supabase, eu.campanha_id);
  const campanha = Array.isArray(eu.campanhas) ? eu.campanhas[0] : eu.campanhas;

  const mensagem = [
    campanha
      ? `IDENTIDADE: ${campanha.nome_candidato ?? "–"} (${campanha.cargo ?? "–"} / ${campanha.uf ?? "–"})`
      : "",
    diretrizes || null,
    conhecimento ? `BASE DE CONHECIMENTO:\n${conhecimento}` : "",
    `PEÇA:\n${peca_descricao.trim()}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  let sugestao: string;
  try {
    sugestao = await ia.gerar({
      sistema: SISTEMA,
      mensagens: [{ role: "user", content: mensagem }],
      maxTokens: 300,
    });
  } catch (err) {
    return respostaErroIA(err);
  }

  const linha = sugestao.split("\n").find((l) => l.trim().length > 0)?.trim() ?? sugestao.trim();
  const limpo = linha.replace(/^["']|["']$/g, "");

  return NextResponse.json({ publico: limpo });
}
