import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { sanitizarTexto, sanitizarTextoOpcional } from "@/lib/sanitizar";
import {
  SISTEMA_GERADOR_PECAS,
  montarContextoConhecimento,
  type TemaComItens,
} from "@/lib/anthropic";
import { criarClienteIA, respostaErroIA } from "@/lib/ia-client";
import { obterContextoDiretrizes } from "@/lib/diretrizes-context";

const PAPEIS_QUE_GERAM = new Set(["coord_campanha", "coord_marketing", "redator_marketing"]);

export async function POST(request: Request) {
  const body = await request.json();
  const { formato, foco, duracao } = body as { formato: string; foco?: string; duracao?: string };

  if (!formato) {
    return NextResponse.json({ error: "formato é obrigatório" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  }
  const limited = checkRateLimit(user.id);
  if (limited) return limited;

  const { data: eu } = await supabase
    .from("usuarios_internos")
    .select(
      "papel, campanha_id, campanhas(nome_candidato, cargo, uf, partido, numero_candidato, nome_urna, cnpj_campanha, coligacao, voz_candidato)"
    )
    .eq("id", user.id)
    .maybeSingle();

  if (!eu || !PAPEIS_QUE_GERAM.has(eu.papel)) {
    return NextResponse.json({ error: "seu papel não gera sugestão de conteúdo" }, { status: 403 });
  }

  const ia = await criarClienteIA(supabase);
  if (!ia) {
    return NextResponse.json(
      { error: "Nenhuma chave de IA configurada. Vá em Cadastro de Campanha > Chaves de API." },
      { status: 400 }
    );
  }

  const { data: temasDb } = await supabase
    .from("temas_campanha")
    .select("id, nome, publicos_alvo, regioes_prioritarias, base_conhecimento_itens(titulo, descricao)")
    .order("ordem")
    .limit(30);

  const temasCtx: TemaComItens[] = (temasDb ?? []).map((t) => ({
    nome: t.nome,
    publicos_alvo: t.publicos_alvo ?? [],
    regioes_prioritarias: t.regioes_prioritarias ?? [],
    itens: (Array.isArray(t.base_conhecimento_itens) ? t.base_conhecimento_itens : []) as { titulo: string; descricao: string | null }[],
  }));

  const campanha = Array.isArray(eu.campanhas) ? eu.campanhas[0] : eu.campanhas;

  const identidade = [
    `Candidato: ${campanha?.nome_candidato ?? "–"}`,
    `Nome de urna: ${campanha?.nome_urna ?? "–"}`,
    `Número: ${campanha?.numero_candidato ?? "–"}`,
    `Cargo: ${campanha?.cargo ?? "–"} – ${campanha?.uf ?? "–"}`,
    `Partido: ${campanha?.partido ?? "–"}`,
    `Coligação: ${campanha?.coligacao ?? "–"}`,
    `CNPJ da campanha: ${campanha?.cnpj_campanha ?? "–"}`,
  ].join("\n");

  const conhecimento = montarContextoConhecimento(temasCtx);
  const diretrizes = await obterContextoDiretrizes(supabase, eu.campanha_id);

  const vozCandidato = campanha?.voz_candidato as string | null;

  const mensagemUsuario = [
    `IDENTIDADE DA CAMPANHA:\n${identidade}`,
    vozCandidato ? `VOZ DO CANDIDATO (use como referência de estilo — copie expressões, ritmo, jeito de falar):\n${vozCandidato.slice(0, 4000)}` : null,
    diretrizes || null,
    conhecimento ? `BASE DE CONHECIMENTO DA CAMPANHA (público-alvo e regiões por tema):\n${conhecimento}` : "",
    `FORMATO PEDIDO: ${formato}`,
    duracao?.trim() ? `DURAÇÃO / TEMPO DISPONÍVEL: ${duracao.trim()}` : "",
    foco?.trim() ? `FOCO / TEMA ESPECÍFICO: ${foco.trim()}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  let sugestao: string;
  try {
    sugestao = await ia.gerar({
      sistema: SISTEMA_GERADOR_PECAS,
      mensagens: [{ role: "user", content: mensagemUsuario }],
      maxTokens: 3000,
    });
  } catch (err) {
    return respostaErroIA(err);
  }

  const contextoAuditoria = foco?.trim()
    ? `Foco: ${foco.trim()}`
    : "(gerado automaticamente a partir da base de conhecimento)";

  const { data: row, error } = await supabase
    .from("sugestoes_conteudo")
    .insert({
      campanha_id: eu.campanha_id,
      formato: sanitizarTexto(formato, 200),
      contexto_usado: sanitizarTexto(contextoAuditoria, 2000),
      modelo_ia: ia.provedor,
      sugestao,
      solicitado_por: user.id,
    })
    .select("id, sugestao, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json(row);
}
