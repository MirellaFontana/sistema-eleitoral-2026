import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { obterChaveApi } from "@/lib/chaves-api";

type AdLibraryAd = {
  id: string;
  ad_creative_bodies?: string[];
  ad_creative_link_captions?: string[];
  ad_creative_link_titles?: string[];
  ad_delivery_start_time?: string;
  ad_delivery_stop_time?: string;
  currency?: string;
  spend?: { lower_bound: string; upper_bound: string };
  impressions?: { lower_bound: string; upper_bound: string };
  page_name?: string;
  bylines?: string;
  publisher_platforms?: string[];
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const nome = searchParams.get("nome");
  if (!nome?.trim()) {
    return NextResponse.json({ error: "parâmetro 'nome' obrigatório" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const token = await obterChaveApi(supabase, "meta_ad_library");
  if (!token) {
    return NextResponse.json(
      { error: "Chave da Meta Ad Library não configurada. Cadastre em Configurações > Chaves de API." },
      { status: 400 },
    );
  }

  const params = new URLSearchParams({
    access_token: token,
    search_terms: nome.trim(),
    ad_reached_countries: '["BR"]',
    ad_type: "POLITICAL_AND_ISSUE_ADS",
    ad_active_status: "ALL",
    fields: "id,ad_creative_bodies,ad_creative_link_captions,ad_creative_link_titles,ad_delivery_start_time,ad_delivery_stop_time,currency,spend,impressions,page_name,bylines,publisher_platforms",
    limit: "25",
  });

  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/ads_archive?${params.toString()}`,
    );
    const data = await res.json();

    if (!res.ok) {
      const msg = data?.error?.message ?? `Meta API respondeu ${res.status}`;
      return NextResponse.json({ error: msg }, { status: 502 });
    }

    const anuncios = (data.data ?? []) as AdLibraryAd[];

    return NextResponse.json({
      anuncios: anuncios.map((ad) => ({
        id: ad.id,
        pagina: ad.page_name ?? null,
        patrocinador: ad.bylines ?? null,
        texto: ad.ad_creative_bodies?.[0] ?? null,
        titulo: ad.ad_creative_link_titles?.[0] ?? null,
        legenda: ad.ad_creative_link_captions?.[0] ?? null,
        inicio: ad.ad_delivery_start_time ?? null,
        fim: ad.ad_delivery_stop_time ?? null,
        gastoMin: ad.spend?.lower_bound ?? null,
        gastoMax: ad.spend?.upper_bound ?? null,
        moeda: ad.currency ?? null,
        impressoesMin: ad.impressions?.lower_bound ?? null,
        impressoesMax: ad.impressions?.upper_bound ?? null,
        plataformas: ad.publisher_platforms ?? [],
      })),
      total: anuncios.length,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "falha de conexão com Meta";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
