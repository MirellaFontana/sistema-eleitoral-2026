import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { criarClienteIA } from "@/lib/ia-client";
import { SISTEMA_ANALISE_MONITORAMENTO } from "@/lib/anthropic";
import { obterContextoDiretrizes } from "@/lib/diretrizes-context";

const PAPEIS_QUE_ANALISAM = new Set([
  "coord_campanha",
  "advogado_responsavel",
  "assistente_juridico",
  "coord_marketing",
  "redator_marketing",
]);

import { parseJsonSeguro } from "@/lib/parse-json-seguro";

type MencaoEntrada = {
  titulo: string;
  link: string;
  fonte: string;
  publicadoEm: string | null;
  termo: string;
};

export async function POST(request: Request) {
  const body = await request.json();
  const { mencoes } = body as { mencoes: MencaoEntrada[] };

  if (!mencoes || mencoes.length === 0) {
    return NextResponse.json({ error: "nenhuma menção para analisar" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const { data: eu } = await supabase
    .from("usuarios_internos")
    .select("papel, campanha_id, campanhas(nome_candidato)")
    .eq("id", user.id)
    .maybeSingle();

  if (!eu || !PAPEIS_QUE_ANALISAM.has(eu.papel)) {
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
  const candidato = campanha?.nome_candidato ?? "(candidato não cadastrado)";

  const mencoesLimitadas = mencoes.slice(0, 40);

  const listaFormatada = mencoesLimitadas
    .map(
      (m, i) =>
        `[${i}] "${m.titulo}" — Fonte: ${m.fonte}${m.publicadoEm ? ` | Data: ${m.publicadoEm}` : ""} | Termo buscado: ${m.termo}`,
    )
    .join("\n");

  const diretrizes = await obterContextoDiretrizes(supabase, eu.campanha_id);
  const mensagemUsuario = [
    `CANDIDATO DA CAMPANHA: ${candidato}`,
    diretrizes || null,
    `TOTAL DE MENÇÕES: ${mencoesLimitadas.length}`,
    `\nLISTA DE MENÇÕES:\n${listaFormatada}`,
  ].filter(Boolean).join("\n");

  let raw: string;
  try {
    raw = await ia.gerar({
      sistema: SISTEMA_ANALISE_MONITORAMENTO,
      mensagens: [{ role: "user", content: mensagemUsuario }],
      maxTokens: 8000,
      jsonMode: true,
    });
  } catch (err) {
    const m = err instanceof Error ? err.message : "erro na IA";
    return NextResponse.json({ error: `falha ao analisar menções: ${m}` }, { status: 502 });
  }

  const analise = parseJsonSeguro(raw);
  if (!analise) {
    console.error("[monitoramento/analisar] JSON inválido", {
      provedor: ia.provedor,
      preview: raw.slice(0, 500),
    });
    return NextResponse.json(
      { error: "modelo retornou formato inesperado. Tente novamente." },
      { status: 502 },
    );
  }

  type AlertaIA = { texto: string; categoria?: string; recomendacao?: string } | string;
  const alertasIA = analise.alertas as AlertaIA[] | undefined;
  if (alertasIA && alertasIA.length > 0) {
    const parsed = alertasIA.map((a) =>
      typeof a === "string"
        ? { texto: a, categoria: null, recomendacao: null }
        : { texto: a.texto, categoria: a.categoria ?? null, recomendacao: a.recomendacao ?? null }
    );

    const registros = parsed.flatMap((a) => [
      {
        campanha_id: eu.campanha_id,
        destinatario_papel: "advogado_responsavel" as const,
        texto_ia: a.texto,
        canal: "app" as const,
      },
      {
        campanha_id: eu.campanha_id,
        destinatario_papel: "coord_campanha" as const,
        texto_ia: a.texto,
        canal: "app" as const,
      },
    ]);
    await supabase.from("alertas").insert(registros);

    const CATEGORIAS_AMEACA = new Set(["ameaca_juridica", "deepfake_suspeito", "gestao_crise"]);
    const recsParaInserir = parsed
      .filter((a) => a.recomendacao && a.categoria && CATEGORIAS_AMEACA.has(a.categoria))
      .map((a) => ({
        campanha_id: eu.campanha_id,
        titulo: a.texto.length > 120 ? a.texto.slice(0, 117) + "…" : a.texto,
        descricao: a.recomendacao!,
        tipo: "risco",
        urgencia: "critica" as const,
        fatos_utilizados: "Detectado pelo monitoramento de menções (análise manual)",
        fontes: "Monitoramento de menções",
        confianca: "media" as const,
        gerada_por_ia: true,
        provedor_ia: ia.provedor,
      }));
    if (recsParaInserir.length > 0) {
      await supabase.from("recomendacoes").insert(recsParaInserir);
    }
  }

  return NextResponse.json({ analise, provedor: ia.provedor });
}
