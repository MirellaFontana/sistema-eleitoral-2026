import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buscarRedesSociais, extrairNoticiasRss } from "@/lib/monitoramento-busca";

const PAPEIS_QUE_EXECUTAM = new Set([
  "coord_campanha",
  "advogado_responsavel",
  "assistente_juridico",
  "coord_marketing",
  "redator_marketing",
]);

export async function POST() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const { data: eu } = await supabase
    .from("usuarios_internos")
    .select("papel, campanha_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!eu || !PAPEIS_QUE_EXECUTAM.has(eu.papel)) {
    return NextResponse.json({ error: "sem permissão" }, { status: 403 });
  }

  const { data: termos } = await supabase
    .from("termos_monitoramento")
    .select("id, termo, rotulo")
    .eq("campanha_id", eu.campanha_id)
    .eq("ativo", true);

  if (!termos || termos.length === 0) {
    return NextResponse.json({ ok: true, total: 0, mensagem: "sem termos ativos" });
  }

  const resultadosPorTermo = await Promise.all(
    termos.map(async (t) => {
      const [noticias, redes] = await Promise.all([
        (async () => {
          try {
            const url = `https://news.google.com/rss/search?q=${encodeURIComponent(`"${t.termo}"`)}&hl=pt-BR&gl=BR&ceid=BR:pt-419`;
            const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
            return res.ok ? extrairNoticiasRss(await res.text()) : [];
          } catch {
            return [];
          }
        })(),
        buscarRedesSociais(t.termo),
      ]);

      return { termoId: t.id, termo: t.termo, rotulo: t.rotulo, noticias, redes };
    }),
  );

  const flat = resultadosPorTermo.flatMap((r) => [
    ...r.noticias.map((n) => ({ ...n, termo: r.termo })),
    ...r.redes.map((n) => ({ ...n, termo: r.termo })),
  ]);

  const vistos = new Set<string>();
  const unicos = flat.filter((m) => {
    if (vistos.has(m.link)) return false;
    vistos.add(m.link);
    return true;
  });

  const REDES_PREFIXOS = ["X (Twitter)", "YouTube", "Instagram", "Facebook", "TikTok", "Threads", "Bluesky"];
  const isRede = (fonte: string) => REDES_PREFIXOS.some((p) => fonte.startsWith(p));

  const snapshot = {
    campanha_id: eu.campanha_id,
    total_mencoes: unicos.length,
    resultados_brutos: resultadosPorTermo.map((r) => ({
      termoId: r.termoId,
      termo: r.termo,
      rotulo: r.rotulo,
      noticias: r.noticias,
      erroNoticias: null,
      redes: {
        configurado: true,
        resultados: r.redes,
        erro: null,
      },
    })),
  };

  const { error: insertError } = await supabase
    .from("monitoramento_snapshots")
    .insert(snapshot);

  if (insertError) {
    return NextResponse.json({ ok: false, erro: insertError.message }, { status: 500 });
  }

  let novos = 0;
  for (const m of unicos) {
    if (!m.link) continue;
    const { data: existe } = await supabase
      .from("monitoramento_itens")
      .select("id")
      .eq("campanha_id", eu.campanha_id)
      .eq("url", m.link)
      .limit(1)
      .maybeSingle();

    if (existe) continue;

    const isRede = isRede(m.fonte);
    const { error } = await supabase.from("monitoramento_itens").insert({
      campanha_id: eu.campanha_id,
      url: m.link,
      descricao: `[${isRede ? "Rede social" : "Busca profunda"}] ${m.titulo}`,
      categoria: "mencao_neutra",
      status: "novo",
    });
    if (!error) novos++;
  }

  return NextResponse.json({
    ok: true,
    total: unicos.length,
    novos,
    redes: unicos.filter((m) => isRede(m.fonte)).length,
  });
}
