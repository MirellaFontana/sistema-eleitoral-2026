import { type SupabaseClient } from "@supabase/supabase-js";
import { criarClienteIA } from "./ia-client";
import { SISTEMA_ANALISE_MONITORAMENTO } from "./anthropic";
import { buscarTermo, type GrupoResultado } from "./monitoramento-busca";
import { obterContextoDiretrizes } from "./diretrizes-context";
import { parseJsonSeguro } from "./parse-json-seguro";
import { enviarWhatsApp } from "./whatsapp";
import { coletarEvidencias } from "./evidencia-coleta";

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

  const { data: snapshotRow, error: insertError } = await supabase
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

  if (insertError) {
    return { ok: false, erro: `busca concluída mas falhou ao salvar: ${insertError.message}` };
  }

  if (analise) {
    type AlertaIA = { texto: string; categoria?: string; recomendacao?: string } | string;
    const alertasRaw = (analise as Record<string, unknown>).alertas as AlertaIA[] | undefined;
    if (alertasRaw && alertasRaw.length > 0) {
      const parsed = alertasRaw.map((a) =>
        typeof a === "string"
          ? { texto: a, categoria: null, recomendacao: null }
          : { texto: a.texto, categoria: a.categoria ?? null, recomendacao: a.recomendacao ?? null }
      );

      const registros = parsed.flatMap((a) => [
        {
          campanha_id: campanhaId,
          destinatario_papel: "advogado_responsavel" as const,
          texto_ia: a.texto,
          categoria: a.categoria,
          canal: "app" as const,
          snapshot_id: snapshotRow?.id ?? null,
        },
        {
          campanha_id: campanhaId,
          destinatario_papel: "coord_campanha" as const,
          texto_ia: a.texto,
          categoria: a.categoria,
          canal: "app" as const,
          snapshot_id: snapshotRow?.id ?? null,
        },
      ]);
      await supabase.from("alertas").insert(registros);

      const CATEGORIA_LABEL: Record<string, string> = {
        ameaca_juridica: "AMEAÇA JURÍDICA",
        deepfake_suspeito: "DEEPFAKE SUSPEITO",
        gestao_crise: "GESTÃO DE CRISE",
      };

      const { data: destinatarios } = await supabase
        .from("usuarios_internos")
        .select("telefone")
        .eq("campanha_id", campanhaId)
        .in("papel", ["advogado_responsavel", "coord_campanha"])
        .not("telefone", "is", null);

      if (destinatarios && destinatarios.length > 0) {
        for (const a of parsed) {
          const tag = CATEGORIA_LABEL[a.categoria ?? ""] ?? "ALERTA";
          const msg = `⚠️ ${tag}\n\n${a.texto}\n\nAcesse o sistema para detalhes e marcar ciência.`;
          for (const d of destinatarios) {
            if (d.telefone) {
              await enviarWhatsApp(d.telefone, msg).catch(() => {});
            }
          }
        }
      }

      // Ameaças com recomendação viram recomendação crítica na Sala de Decisão
      const CATEGORIAS_AMEACA_REC = new Set(["ameaca_juridica", "deepfake_suspeito", "gestao_crise"]);
      const recsParaInserir = parsed
        .filter((a) => a.recomendacao && a.categoria && CATEGORIAS_AMEACA_REC.has(a.categoria))
        .map((a) => ({
          campanha_id: campanhaId,
          titulo: a.texto.length > 120 ? a.texto.slice(0, 117) + "…" : a.texto,
          descricao: a.recomendacao!,
          tipo: "risco",
          urgencia: "critica" as const,
          fatos_utilizados: `Detectado pelo monitoramento automático (snapshot ${snapshotRow?.id ?? "?"})`,
          fontes: "Monitoramento de menções",
          confianca: "media" as const,
          gerada_por_ia: true,
          provedor_ia: provedor,
        }));
      if (recsParaInserir.length > 0) {
        await supabase.from("recomendacoes").insert(recsParaInserir);
      }
    }

    // Coleta automática de evidências: captura HTML/mídia das menções de ameaça,
    // calcula hash SHA-256 e lacra no dossiê jurídico antes que saia do ar.
    type GrupoIA = {
      categoria_sugerida?: string;
      mencoes?: { indice: number; fonte: string; titulo_original: string }[];
    };
    const gruposIA = (analise as Record<string, unknown>).grupos as GrupoIA[] | undefined;
    const CATEGORIAS_AMEACA = new Set(["ameaca_juridica", "deepfake_suspeito", "gestao_crise"]);

    const mencoesParaColeta = (gruposIA ?? [])
      .filter((g) => g.categoria_sugerida && CATEGORIAS_AMEACA.has(g.categoria_sugerida))
      .flatMap((g) =>
        (g.mencoes ?? []).map((m) => {
          const original = flat[m.indice];
          return original
            ? { titulo: original.titulo, link: original.link, fonte: original.fonte, termo: original.termo, categoria: g.categoria_sugerida! }
            : null;
        }).filter((x): x is NonNullable<typeof x> => x !== null && !!x.link),
      );

    if (mencoesParaColeta.length > 0) {
      await coletarEvidencias(supabase, campanhaId, mencoesParaColeta).catch(() => {});
    }
  }

  return { ok: true };
}
