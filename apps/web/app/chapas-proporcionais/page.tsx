import { redirect } from "next/navigation";
import { Users, Vote, MapPin } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import { proximaRotaMfa } from "@/lib/mfa";
import { EleicaoForm } from "./EleicaoForm";

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

const CARGO_LABELS: Record<string, string> = {
  deputado_federal: "Deputado Federal",
  deputado_estadual: "Deputado Estadual",
  deputado_distrital: "Deputado Distrital",
  vereador: "Vereador",
};

export default async function ChapasPropPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: eu } = await supabase
    .from("usuarios_internos")
    .select("papel, campanha_id, campanhas(nome_candidato)")
    .eq("id", user.id)
    .maybeSingle();
  if (!eu) redirect("/onboarding");

  const rotaMfa = await proximaRotaMfa(supabase, eu.papel);
  if (rotaMfa) redirect(rotaMfa);

  const campanha = Array.isArray(eu.campanhas) ? eu.campanhas[0] : eu.campanhas;

  const { data: eleicoes } = await supabase
    .from("eleicoes_proporcionais")
    .select("*, chapas_proporcionais(count)")
    .eq("campanha_id", eu.campanha_id)
    .order("created_at", { ascending: false });

  const lista = (eleicoes ?? []) as Record<string, unknown>[];

  const totalEleicoes = lista.length;
  const totalChapas = lista.reduce((acc, e) => {
    const chapas = e.chapas_proporcionais as { count: number }[] | undefined;
    return acc + (chapas?.[0]?.count ?? 0);
  }, 0);

  return (
    <AppShell campanhaNome={campanha?.nome_candidato ?? undefined} papel={PAPEL_LABEL[eu.papel]}>
      <main className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-4 py-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-neutral-800">Chapas Proporcionais</h1>
            <p className="text-sm text-neutral-500">
              Gerencie eleições proporcionais, chapas e candidaturas.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-neutral-200 p-4">
            <div className="flex items-center gap-2 text-neutral-500">
              <Vote size={16} />
              <span className="text-xs font-semibold uppercase tracking-wide">Eleições</span>
            </div>
            <p className="mt-1 text-2xl font-bold">{totalEleicoes}</p>
          </div>
          <div className="rounded-lg border border-neutral-200 p-4">
            <div className="flex items-center gap-2 text-neutral-500">
              <Users size={16} />
              <span className="text-xs font-semibold uppercase tracking-wide">Chapas</span>
            </div>
            <p className="mt-1 text-2xl font-bold">{totalChapas}</p>
          </div>
          <div className="rounded-lg border border-neutral-200 p-4">
            <div className="flex items-center gap-2 text-neutral-500">
              <MapPin size={16} />
              <span className="text-xs font-semibold uppercase tracking-wide">Estados</span>
            </div>
            <p className="mt-1 text-2xl font-bold">
              {new Set(lista.map((e) => e.estado as string)).size}
            </p>
          </div>
        </div>

        <EleicaoForm />

        {lista.length === 0 ? (
          <p className="text-sm text-neutral-400">Nenhuma eleição cadastrada ainda.</p>
        ) : (
          <div className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Eleições cadastradas
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {lista.map((e) => {
                const chapas = e.chapas_proporcionais as { count: number }[] | undefined;
                const chapaCount = chapas?.[0]?.count ?? 0;
                return (
                  <div key={e.id as string} className="rounded-lg border border-neutral-200 p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-neutral-800">
                        {CARGO_LABELS[e.cargo as string] ?? e.cargo}
                      </span>
                      <span className="rounded bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600">
                        {e.estado as string}
                      </span>
                    </div>
                    <div className="flex gap-4 text-xs text-neutral-500">
                      <span>{e.vagas as number} vagas</span>
                      <span>{chapaCount} chapa{chapaCount !== 1 ? "s" : ""}</span>
                      <span>Ano {e.ano as number}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </AppShell>
  );
}
