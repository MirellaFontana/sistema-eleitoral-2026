export type Resultado = {
  titulo: string;
  link: string;
  fonte: string;
  publicadoEm: string | null;
};

export type GrupoResultado = {
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

export async function buscarTermo(
  termoRow: { id: string; termo: string; rotulo: string | null },
  twitterToken: string | undefined,
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

  const redes: GrupoResultado["redes"] = {
    configurado: !!twitterToken,
    resultados: [],
    erro: null,
  };

  if (twitterToken) {
    try {
      const twUrl = `https://api.twitter.com/2/tweets/search/recent?query=${encodeURIComponent(
        `${query} -is:retweet`,
      )}&max_results=10&tweet.fields=created_at`;
      const res = await fetch(twUrl, {
        headers: { Authorization: `Bearer ${twitterToken}` },
      });
      if (res.ok) {
        const json = (await res.json()) as {
          data?: { id: string; text: string; created_at?: string }[];
        };
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
