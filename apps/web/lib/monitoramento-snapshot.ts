import { type SupabaseClient } from "@supabase/supabase-js";
import { criarClienteIA } from "./ia-client";
import { SISTEMA_ANALISE_MONITORAMENTO } from "./anthropic";
import { buscarTermo, type GrupoResultado } from "./monitoramento-busca";
import { obterContextoDiretrizes } from "./diretrizes-context";

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

export async function executarSnapshotCampanha(
  supabase: SupabaseClient,
  campanhaId: string,
  nomeCandidato: string | null,
): Promise<{ ok: boolean; erro?: string }> {
  const { data: termos } = await supabase
    .from("termos_monitoramento")
    .select("id, termo, rotulo")
    .eq("campanha_id", campanhaId)
    .eq("ativo", true);

  if (!termos || termos.length === 0) {
    return { ok: true, erro: "sem termos ativos" };
  }

  const twitterToken = process.env.TWITTER_BEARER_TOKEN;

  let grupos: GrupoResultado[];
  try {
    grupos = await Promise.all(termos.map((t) => buscarTermo(t, twitterToken)));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "erro na busca";
    await supabase.from("monitoramento_snapshots").insert({
      campanha_id: campanhaId,
      total_mencoes: 0,
      resultados_brutos: [],
      erro: msg,
    });
    return { ok: false, erro: msg };
  }

  type MencaoFlat = {
    titulo: string;
    link: string;
    fonte: string;
    publicadoEm: string | null;
    termo: string;
  };
  const flat: MencaoFlat[] = [];
  for (const g of grupos) {
    for (const n of g.noticias) flat.push({ ...n, termo: g.termo });
    for (const r of g.redes.resultados) flat.push({ ...r, termo: g.termo });
  }

  let analise: Record<string, unknown> | null = null;
  let provedor: string | null = null;

  if (flat.length > 0) {
    const ia = await criarClienteIA(supabase);
    if (ia) {
      const flatLimitado = flat.slice(0, 40);
      const listaFormatada = flatLimitado
        .map(
          (m, i) =>
            `[${i}] "${m.titulo}" — Fonte: ${m.fonte}${m.publicadoEm ? ` | Data: ${m.publicadoEm}` : ""} | Termo buscado: ${m.termo}`,
        )
        .join("\n");

      const diretrizes = await obterContextoDiretrizes(supabase, campanhaId);
      const mensagem = [
        `CANDIDATO DA CAMPANHA: ${nomeCandidato ?? "(não cadastrado)"}`,
        diretrizes || null,
        `TOTAL DE MENÇÕES: ${flatLimitado.length}`,
        `\nLISTA DE MENÇÕES:\n${listaFormatada}`,
      ].filter(Boolean).join("\n");

      try {
        const raw = await ia.gerar({
          sistema: SISTEMA_ANALISE_MONITORAMENTO,
          mensagens: [{ role: "user", content: mensagem }],
          maxTokens: 8000,
          jsonMode: true,
        });
        analise = parseJsonSeguro(raw);
        provedor = ia.provedor;
      } catch {
        // salva brutos mesmo assim
      }
    }
  }

  const { data: snapshotRow } = await supabase
    .from("monitoramento_snapshots")
    .insert({
      campanha_id: campanhaId,
      total_mencoes: flat.length,
      resultados_brutos: grupos,
      analise_ia: analise,
      provedor_ia: provedor,
    })
    .select("id")
    .single();

  if (analise) {
    const alertasIA = (analise as Record<string, unknown>).alertas as string[] | undefined;
    if (alertasIA && alertasIA.length > 0) {
      const registros = alertasIA.flatMap((texto) => [
        {
          campanha_id: campanhaId,
          destinatario_papel: "advogado_responsavel" as const,
          texto_ia: texto,
          canal: "app" as const,
          snapshot_id: snapshotRow?.id ?? null,
        },
        {
          campanha_id: campanhaId,
          destinatario_papel: "coord_campanha" as const,
          texto_ia: texto,
          canal: "app" as const,
          snapshot_id: snapshotRow?.id ?? null,
        },
      ]);
      await supabase.from("alertas").insert(registros);
    }
  }

  return { ok: true };
}
