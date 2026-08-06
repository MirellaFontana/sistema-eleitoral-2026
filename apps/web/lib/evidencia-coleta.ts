import { type SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "crypto";

const CATEGORIAS_AMEACA = new Set(["ameaca_juridica", "deepfake_suspeito", "gestao_crise"]);

type MencaoComUrl = {
  titulo: string;
  link: string;
  fonte: string;
  termo: string;
  categoria: string | null;
};

/**
 * Para cada menção de ameaça que tenha URL, captura o HTML da página,
 * calcula SHA-256 como prova de existência e salva no bucket + monitoramento_itens.
 * Roda fire-and-forget após os alertas — falhas não impedem o snapshot.
 */
export async function coletarEvidencias(
  supabase: SupabaseClient,
  campanhaId: string,
  mencoes: MencaoComUrl[],
): Promise<{ coletadas: number; erros: number }> {
  const ameacas = mencoes.filter(
    (m) => m.link && m.categoria && CATEGORIAS_AMEACA.has(m.categoria),
  );

  if (ameacas.length === 0) return { coletadas: 0, erros: 0 };

  let coletadas = 0;
  let erros = 0;

  for (const m of ameacas) {
    try {
      const conteudo = await capturarConteudo(m.link);
      if (!conteudo) {
        erros++;
        continue;
      }

      const hash = createHash("sha256").update(conteudo.buffer).digest("hex");
      const agora = new Date().toISOString();
      const ext = conteudo.tipo === "html" ? "html" : extFromMime(conteudo.mime);
      const nomeArquivo = `${campanhaId}/${agora.replace(/[:.]/g, "-")}_${hash.slice(0, 8)}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("monitoramento")
        .upload(nomeArquivo, conteudo.buffer, {
          contentType: conteudo.mime,
          upsert: false,
        });

      if (uploadError) {
        erros++;
        continue;
      }

      const gravidade = m.categoria === "gestao_crise" ? "alta" : "alta";

      await supabase.from("monitoramento_itens").insert({
        campanha_id: campanhaId,
        url: m.link,
        descricao: `[Captura automática] ${m.titulo} — Fonte: ${m.fonte} | Termo: ${m.termo}`,
        categoria: m.categoria as "ameaca_juridica" | "deepfake_suspeito" | "gestao_crise",
        gravidade,
        status: "novo",
        captura_path: nomeArquivo,
        hash_evidencia: hash,
        hash_calculado_em: agora,
      });

      coletadas++;
    } catch {
      erros++;
    }
  }

  return { coletadas, erros };
}

async function capturarConteudo(
  url: string,
): Promise<{ buffer: Buffer; mime: string; tipo: "html" | "media" } | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,*/*",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) return null;

    const contentType = res.headers.get("content-type") ?? "text/html";
    const buffer = Buffer.from(await res.arrayBuffer());

    // ponytail: 50MB limit do bucket
    if (buffer.length > 50 * 1024 * 1024) return null;

    const isMedia =
      contentType.startsWith("image/") ||
      contentType.startsWith("video/") ||
      contentType.startsWith("audio/");

    return {
      buffer,
      mime: contentType.split(";")[0].trim(),
      tipo: isMedia ? "media" : "html",
    };
  } catch {
    return null;
  }
}

function extFromMime(mime: string): string {
  const map: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
    "image/gif": "gif",
    "video/mp4": "mp4",
    "audio/mpeg": "mp3",
    "audio/ogg": "ogg",
  };
  return map[mime] ?? "bin";
}
