import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { criarClienteIA } from "@/lib/ia-client";
import { SISTEMA_ANALISE_MONITORAMENTO } from "@/lib/anthropic";

const PAPEIS_QUE_ANALISAM = new Set([
  "coord_campanha",
  "advogado_responsavel",
  "assistente_juridico",
  "coord_marketing",
  "redator_marketing",
]);

type MencaoEntrada = {
  titulo: string;
  link: string;
  fonte: string;
  publicadoEm: string | null;
  termo: string;
};

function parseJsonSeguro(raw: string): Record<string, unknown> | null {
  let limpo = raw.replace(/```(?:json)?/gi, "").trim();
  const inicio = limpo.indexOf("{");
  if (inicio === -1) return null;
  limpo = limpo.slice(inicio);

  try {
    return JSON.parse(limpo);
  } catch {}

  let profundidade = 0;
  let dentroDeString = false;
  let escape = false;
  let fim = -1;
  for (let i = 0; i < limpo.length; i++) {
    const c = limpo[i];
    if (escape) { escape = false; continue; }
    if (c === "\\") { escape = true; continue; }
    if (c === '"') { dentroDeString = !dentroDeString; continue; }
    if (dentroDeString) continue;
    if (c === "{") profundidade++;
    else if (c === "}") {
      profundidade--;
      if (profundidade === 0) { fim = i; break; }
    }
  }
  if (fim === -1) return null;
  try {
    return JSON.parse(limpo.slice(0, fim + 1));
  } catch {
    return null;
  }
}

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

  const mensagemUsuario = [
    `CANDIDATO DA CAMPANHA: ${candidato}`,
    `TOTAL DE MENÇÕES: ${mencoesLimitadas.length}`,
    `\nLISTA DE MENÇÕES:\n${listaFormatada}`,
  ].join("\n");

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

  const alertasIA = analise.alertas as string[] | undefined;
  if (alertasIA && alertasIA.length > 0) {
    const registros = alertasIA.flatMap((texto) => [
      {
        campanha_id: eu.campanha_id,
        destinatario_papel: "advogado_responsavel" as const,
        texto_ia: texto,
        canal: "app" as const,
      },
      {
        campanha_id: eu.campanha_id,
        destinatario_papel: "coord_campanha" as const,
        texto_ia: texto,
        canal: "app" as const,
      },
    ]);
    await supabase.from("alertas").insert(registros);
  }

  return NextResponse.json({ analise, provedor: ia.provedor });
}
