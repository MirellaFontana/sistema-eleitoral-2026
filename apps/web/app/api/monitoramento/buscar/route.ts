import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const PAPEIS_QUE_BUSCAM = new Set([
  "coord_campanha",
  "advogado_responsavel",
  "assistente_juridico",
  "coord_marketing",
  "redator_marketing",
]);

type Resultado = { titulo: string; link: string; fonte: string; publicadoEm: string | null };

type GrupoResultado = {
  termoId: string;
  termo: string;
  rotulo: string | null;
  noticias: Resultado[];
  erroNoticias: string | null;
  redes: { configurado: boolean; resultados: Resultado[]; erro: string | null };
};

function decodificarHtml(texto: string) {
  return texto
    .replace(/<!\[CDATA\[/g, "")
    .replace(/\]\]>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

function extrairNoticiasRss(xml: string): Resultado[] {
  const blocos = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];
  return blocos
    .slice(0, 15)
    .map((bloco) => {
      const titulo = bloco.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? "";
      const link = bloco.match(/<link>([\s\S]*?)<\/link>/)?.[1] ?? "";
      const pubDate = bloco.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] ?? null;
      const fonte = bloco.match(/<source[^>]*>([\s\S]*?)<\/source>/)?.[1] ?? "";
      return {
        titulo: decodificarHtml(titulo),
        link: link.trim(),
        fonte: decodificarHtml(fonte),
        publicadoEm: pubDate,
      };
    })
    .filter((item) => item.titulo && item.link);
}

async function buscarTermo(
  termoRow: { id: string; termo: string; rotulo: string | null },
  twitterToken: string | undefined
): Promise<GrupoResultado> {
  const query = `"${termoRow.termo}"`;

  let noticias: Resultado[] = [];
  let erroNoticias: string | null = null;
  try {
    const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=pt-BR&gl=BR&ceid=BR:pt-419`;
    const res = await fetch(rssUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (res.ok) {
      noticias = extrairNoticiasRss(await res.text());
    } else {
      erroNoticias = `Google News respondeu ${res.status}`;
    }
  } catch (e) {
    erroNoticias = e instanceof Error ? e.message : "erro ao buscar notícias";
  }

  const redes: { configurado: boolean; resultados: Resultado[]; erro: string | null } = {
    configurado: !!twitterToken,
    resultados: [],
    erro: null,
  };

  if (twitterToken) {
    try {
      const twUrl = `https://api.twitter.com/2/tweets/search/recent?query=${encodeURIComponent(
        `${query} -is:retweet`
      )}&max_results=10&tweet.fields=created_at`;
      const res = await fetch(twUrl, { headers: { Authorization: `Bearer ${twitterToken}` } });
      if (res.ok) {
        const json = (await res.json()) as { data?: { id: string; text: string; created_at?: string }[] };
        redes.resultados = (json.data ?? []).map((t) => ({
          titulo: t.text,
          link: `https://twitter.com/i/web/status/${t.id}`,
          fonte: "X (Twitter)",
          publicadoEm: t.created_at ?? null,
        }));
      } else {
        redes.erro = `X respondeu ${res.status}`;
      }
    } catch (e) {
      redes.erro = e instanceof Error ? e.message : "erro ao buscar em redes sociais";
    }
  }

  return {
    termoId: termoRow.id,
    termo: termoRow.termo,
    rotulo: termoRow.rotulo,
    noticias,
    erroNoticias,
    redes,
  };
}

export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const { data: eu } = await supabase
    .from("usuarios_internos")
    .select("papel")
    .eq("id", user.id)
    .maybeSingle();

  if (!eu || !PAPEIS_QUE_BUSCAM.has(eu.papel)) {
    return NextResponse.json({ error: "sem permissão pra buscar menções" }, { status: 403 });
  }

  const { data: termos } = await supabase
    .from("termos_monitoramento")
    .select("id, termo, rotulo")
    .eq("ativo", true);

  if (!termos || termos.length === 0) {
    return NextResponse.json(
      { error: "Nenhum termo de monitoramento ativo — cadastre em \"O que monitorar\" antes de buscar." },
      { status: 400 }
    );
  }

  const twitterToken = process.env.TWITTER_BEARER_TOKEN;
  const grupos = await Promise.all(termos.map((t) => buscarTermo(t, twitterToken)));

  return NextResponse.json({ grupos });
}
