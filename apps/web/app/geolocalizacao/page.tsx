import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import { proximaRotaMfa } from "@/lib/mfa";
import { MapaWrapper } from "./MapaWrapper";
import { UF_COORDENADAS } from "@/lib/uf-coordenadas";

const PAPEL_LABEL: Record<string, string> = {
  embaixador: "Liderança de campo (legado)",
  advogado_responsavel: "Advogado responsável",
  assistente_juridico: "Assistente jurídico",
  coord_marketing: "Coord. de marketing",
  redator_marketing: "Redator de marketing",
  coord_campanha: "Coord. de campanha",
  candidato: "Candidato",
  apoio_marketing: "Apoio de marketing",
  apoio_campanha: "Apoio de campanha",
  apoio_coordenacao: "Apoio de coordenação",
};

type TerritorioMapa = {
  territorio_id: string;
  bairro: string | null;
  cidade: string | null;
  lat: number;
  lng: number;
  cadastros: number;
  apoiadores: number;
  liderancas: number;
};

export default async function GeolocalizacaoPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: eu } = await supabase
    .from("usuarios_internos")
    .select("papel, campanha_id, campanhas(nome_candidato, uf)")
    .eq("id", user.id)
    .maybeSingle();

  if (!eu) redirect("/onboarding");

  const rotaMfa = await proximaRotaMfa(supabase, eu.papel);
  if (rotaMfa) redirect(rotaMfa);

  const campanha = Array.isArray(eu.campanhas) ? eu.campanhas[0] : eu.campanhas;
  const centroUf = campanha?.uf ? UF_COORDENADAS[campanha.uf] : undefined;

  const [terrRes, campRes, metasRes, eleitoresRes, apoiadoresRes, liderancasRes] = await Promise.all([
    supabase.rpc("mapa_territorios"),
    supabase.rpc("agregados_campanha"),
    supabase.from("metas").select("territorio_id, alvo_cadastros, periodo").eq("tipo", "territorio"),
    supabase.rpc("mapa_eleitores"),
    supabase.rpc("mapa_apoiadores"),
    supabase.rpc("mapa_liderancas"),
  ]);

  const territorios = (terrRes.data ?? []) as TerritorioMapa[];
  const campanhaAgg = (campRes.data?.[0] ?? { cadastros: 0, sem_coordenada: 0 }) as {
    cadastros: number;
    sem_coordenada: number;
  };

  const metaPorTerritorio = new Map<string, number>();
  for (const m of metasRes.data ?? []) {
    if (m.territorio_id && !metaPorTerritorio.has(m.territorio_id)) {
      metaPorTerritorio.set(m.territorio_id, m.alvo_cadastros);
    }
  }

  const circulos = territorios.map((t) => ({
    id: t.territorio_id,
    bairro: t.bairro,
    cidade: t.cidade,
    lat: Number(t.lat),
    lng: Number(t.lng),
    cadastros: Number(t.cadastros),
    apoiadores: Number(t.apoiadores),
    liderancas: Number(t.liderancas),
    metaAlvo: metaPorTerritorio.get(t.territorio_id) ?? null,
  }));

  const mapearPontos = (rows: unknown) =>
    ((rows ?? []) as { lat: number; lng: number }[]).map((p) => ({
      lat: Number(p.lat),
      lng: Number(p.lng),
    }));

  const eleitores = mapearPontos(eleitoresRes.data);
  const apoiadores = mapearPontos(apoiadoresRes.data);
  const liderancasPontos = mapearPontos(liderancasRes.data);

  return (
    <AppShell campanhaNome={campanha?.nome_candidato ?? undefined} papel={PAPEL_LABEL[eu.papel]}>
      <main className="mx-auto w-full max-w-4xl flex-1 space-y-6 px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-lg font-semibold">Geolocalização</h1>
            <p className="text-sm text-neutral-500">
              Mapa da base eleitoral e cobertura estratégica por bairro.
            </p>
          </div>
          <span className="rounded-full border border-neutral-200 px-3 py-1 text-xs text-neutral-600">
            {circulos.length} no mapa
          </span>
        </div>

        {circulos.length === 0 && (
          <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Nenhum território com coordenada definida ainda — o mapa abaixo está centralizado no
            estado da campanha. Em “Lideranças” → “Territórios”, informe cidade e use “Buscar
            coordenada” (ou lat/lng manual) para o bairro aparecer com o círculo de cobertura.
          </p>
        )}

        <MapaWrapper
          circulos={circulos}
          eleitores={eleitores}
          apoiadores={apoiadores}
          liderancas={liderancasPontos}
          semCoordenada={Number(campanhaAgg.sem_coordenada)}
          centroPadrao={centroUf}
        />

        <p className="text-xs text-neutral-400">
          {Number(campanhaAgg.sem_coordenada) > 0 &&
            `${campanhaAgg.sem_coordenada} cadastro(s) sem coordenada no mapa (sem território com centro definido). `}
          Cores: verde = meta atingida · âmbar = 70–99% · vermelho = abaixo de 70% · azul = sem meta.
        </p>
      </main>
    </AppShell>
  );
}
