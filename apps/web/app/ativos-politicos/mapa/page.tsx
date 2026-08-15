import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import { proximaRotaMfa } from "@/lib/mfa";
import { MapaAtivosWrapper } from "./MapaAtivosWrapper";
import { UF_COORDENADAS } from "@/lib/uf-coordenadas";

const PAPEL_LABEL: Record<string, string> = {
  coord_campanha: "Coord. de campanha",
  candidato: "Candidato",
  coord_marketing: "Coord. de marketing",
  redator_marketing: "Redator de marketing",
  advogado_responsavel: "Advogado responsável",
  assistente_juridico: "Assistente jurídico",
  embaixador: "Liderança de campo (legado)",
  apoio_marketing: "Apoio de marketing",
  apoio_campanha: "Apoio de campanha",
  apoio_coordenacao: "Apoio de coordenação",
};

export default async function MapaAtivosPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
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

  const { data: pontos } = await supabase.rpc("mapa_ativos_politicos");

  const [{ count: total }, { count: geo }] = await Promise.all([
    supabase.from("ativos_politicos").select("id", { count: "exact", head: true }),
    supabase.from("ativos_politicos").select("id", { count: "exact", head: true }).not("geolocalizacao", "is", null),
  ]);

  const pontosFormatados = ((pontos ?? []) as { lat: number; lng: number; nome: string; categoria: string; nivel: string }[]).map((p) => ({
    lat: Number(p.lat),
    lng: Number(p.lng),
    nome: p.nome,
    categoria: p.categoria,
    nivel: p.nivel,
  }));

  return (
    <AppShell campanhaNome={campanha?.nome_candidato ?? undefined} papel={PAPEL_LABEL[eu.papel]}>
      <main className="mx-auto w-full max-w-4xl flex-1 space-y-6 px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-lg font-semibold">Mapa — Ativos Políticos</h1>
            <p className="text-sm text-neutral-500">
              Distribuição territorial da rede de poder político.
            </p>
          </div>
          <div className="flex gap-3 text-xs text-neutral-600">
            <span className="rounded-full border border-neutral-200 px-3 py-1">
              {pontosFormatados.length} no mapa
            </span>
            <span className="rounded-full border border-neutral-200 px-3 py-1">
              {(total ?? 0) - (geo ?? 0)} sem coordenada
            </span>
          </div>
        </div>

        {pontosFormatados.length === 0 && (
          <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Nenhum ativo com localização definida. Cadastre ativos com geolocalização ou
            vincule a um território com coordenadas.
          </p>
        )}

        <MapaAtivosWrapper
          pontos={pontosFormatados}
          centroPadrao={centroUf}
        />
      </main>
    </AppShell>
  );
}
