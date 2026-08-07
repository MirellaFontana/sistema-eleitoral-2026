import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { criarClienteIA } from "@/lib/ia-client";
import { sanitizarTexto } from "@/lib/sanitizar";
import { obterContextoDiretrizes } from "@/lib/diretrizes-context";
import {
  SISTEMA_PLANO_IMPULSIONAMENTO,
  montarContextoConhecimento,
  type TemaComItens,
} from "@/lib/anthropic";

const PAPEIS_QUE_GERAM = new Set(["coord_campanha", "coord_marketing", "redator_marketing"]);
import { parseJsonSeguro } from "@/lib/parse-json-seguro";

const OBJETIVOS_VALIDOS = new Set([
  "alcance",
  "trafego",
  "engajamento",
  "video_views",
  "conversao",
  "mensagens",
  "seguidores",
]);

export async function POST(request: Request) {
  const body = await request.json();
  const {
    peca_descricao,
    peca_conteudo_id,
    objetivo,
    publico_prioritario,
    orcamento_total,
    prazo_dias,
  } = body as {
    peca_descricao: string;
    peca_conteudo_id?: string;
    objetivo: string;
    publico_prioritario: string;
    orcamento_total: number;
    prazo_dias: number;
  };

  if (!peca_descricao?.trim()) {
    return NextResponse.json({ error: "descrição da peça é obrigatória" }, { status: 400 });
  }
  if (!objetivo || !OBJETIVOS_VALIDOS.has(objetivo)) {
    return NextResponse.json({ error: "objetivo inválido" }, { status: 400 });
  }
  if (!publico_prioritario?.trim()) {
    return NextResponse.json({ error: "público prioritário é obrigatório" }, { status: 400 });
  }
  if (!orcamento_total || orcamento_total <= 0) {
    return NextResponse.json({ error: "orçamento total deve ser maior que zero" }, { status: 400 });
  }
  if (!prazo_dias || prazo_dias <= 0) {
    return NextResponse.json({ error: "prazo em dias deve ser maior que zero" }, { status: 400 });
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
    .select(
      "papel, campanha_id, campanhas(nome_candidato, cargo, uf, partido, numero_candidato, nome_urna, coligacao, cnpj_campanha)",
    )
    .eq("id", user.id)
    .maybeSingle();

  if (!eu || !PAPEIS_QUE_GERAM.has(eu.papel)) {
    return NextResponse.json({ error: "sem permissão" }, { status: 403 });
  }

  const ia = await criarClienteIA(supabase);
  if (!ia) {
    return NextResponse.json(
      { error: "Nenhuma chave de IA configurada." },
      { status: 400 },
    );
  }

  const campanha = Array.isArray(eu.campanhas) ? eu.campanhas[0] : eu.campanhas;
  const identidade = campanha
    ? [
        `Candidato: ${campanha.nome_candidato ?? "–"}`,
        `Nome de urna: ${campanha.nome_urna ?? "–"}`,
        `Número: ${campanha.numero_candidato ?? "–"}`,
        `Cargo: ${campanha.cargo ?? "–"} – ${campanha.uf ?? "–"}`,
        `Partido: ${campanha.partido ?? "–"}`,
        `Coligação: ${campanha.coligacao ?? "–"}`,
        `CNPJ: ${campanha.cnpj_campanha ?? "–"}`,
      ].join("\n")
    : "(identidade da campanha não cadastrada)";

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

  const mensagemUsuario = [
    `IDENTIDADE DA CAMPANHA:\n${identidade}`,
    diretrizes || null,
    conhecimento ? `BASE DE CONHECIMENTO (temas, públicos e regiões):\n${conhecimento}` : "",
    `PEÇA A IMPULSIONAR:\n${peca_descricao.trim()}`,
    `OBJETIVO DESEJADO: ${objetivo}`,
    `PÚBLICO PRIORITÁRIO INFORMADO: ${publico_prioritario.trim()}`,
    `ORÇAMENTO TOTAL: R$ ${orcamento_total.toFixed(2)}`,
    `PRAZO: ${prazo_dias} dias`,
  ]
    .filter(Boolean)
    .join("\n\n");

  let raw: string;
  try {
    raw = await ia.gerar({
      sistema: SISTEMA_PLANO_IMPULSIONAMENTO,
      mensagens: [{ role: "user", content: mensagemUsuario }],
      maxTokens: 3500,
      jsonMode: true,
    });
  } catch (err) {
    const m = err instanceof Error ? err.message : "erro na IA";
    return NextResponse.json({ error: `falha ao gerar plano: ${m}` }, { status: 502 });
  }

  const plano = parseJsonSeguro(raw);
  if (!plano) {
    console.error("[impulsionamento] JSON invalido do modelo", {
      provedor: ia.provedor,
      preview: raw.slice(0, 500),
      length: raw.length,
    });
    return NextResponse.json(
      { error: "modelo retornou formato inesperado. Tente novamente." },
      { status: 502 },
    );
  }

  const { data: row, error } = await supabase
    .from("planos_impulsionamento")
    .insert({
      campanha_id: eu.campanha_id,
      peca_conteudo_id: peca_conteudo_id ?? null,
      peca_descricao: sanitizarTexto(peca_descricao, 2000),
      objetivo,
      publico_prioritario: sanitizarTexto(publico_prioritario, 500),
      orcamento_total,
      prazo_dias,
      plano_json: plano,
      modelo_ia: ia.provedor,
      solicitado_por: user.id,
    })
    .select("id, plano_json, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json(row);
}
