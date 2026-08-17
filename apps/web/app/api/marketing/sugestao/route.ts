import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { sanitizarTexto } from "@/lib/sanitizar";
import { SISTEMA_GERADOR_PECAS } from "@/lib/anthropic";
import { criarClienteIA, respostaErroIA } from "@/lib/ia-client";
import { carregarContexto, montarMensagemContexto } from "@/lib/contexto-campanha";

const PAPEIS_QUE_GERAM = new Set(["coord_campanha", "coord_marketing", "redator_marketing"]);

export async function POST(request: Request) {
  const body = await request.json();
  const { formato, foco, duracao, variacoes_ab } = body as { formato: string; foco?: string; duracao?: string; variacoes_ab?: boolean };

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

  const campanha = Array.isArray(eu.campanhas) ? eu.campanhas[0] : eu.campanhas;
  const ctx = await carregarContexto(supabase, eu.campanha_id, ["identidade", "voz", "diretrizes", "temas"], campanha);

  const mensagemUsuario = montarMensagemContexto(ctx, [
    `FORMATO PEDIDO: ${formato}`,
    duracao?.trim() ? `DURAÇÃO / TEMPO DISPONÍVEL: ${duracao.trim()}` : null,
    foco?.trim() ? `FOCO / TEMA ESPECÍFICO: ${foco.trim()}` : null,
    variacoes_ab
      ? `MODO VARIAÇÕES A/B: Gere EXATAMENTE 3 variações da mesma peça. Cada variação deve ter um hook/abertura DIFERENTE e um CTA diferente, mantendo o mesmo tema e mensagem central. Separe claramente como "═══ VARIAÇÃO A ═══", "═══ VARIAÇÃO B ═══", "═══ VARIAÇÃO C ═══". Após as 3 variações, adicione uma linha "RECOMENDAÇÃO: [explique brevemente qual variação tende a performar melhor e por quê]."`
      : null,
  ]);

  let sugestao: string;
  try {
    sugestao = await ia.gerar({
      sistema: SISTEMA_GERADOR_PECAS,
      mensagens: [{ role: "user", content: mensagemUsuario }],
      maxTokens: variacoes_ab ? 6000 : 3000,
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
