import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import { proximaRotaMfa } from "@/lib/mfa";
import { ProcessoForm } from "./ProcessoForm";
import { ProcessosList } from "./ProcessosList";

const PAPEL_LABEL: Record<string, string> = {
  embaixador: "Embaixador",
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

const PAPEIS_QUE_EDITAM = new Set(["advogado_responsavel", "assistente_juridico", "coord_campanha"]);

export default async function ProcessosPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: eu } = await supabase
    .from("usuarios_internos")
    .select("papel, campanha_id, campanhas(nome_candidato)")
    .eq("id", user.id)
    .maybeSingle();

  if (!eu) redirect("/onboarding");

  const rotaMfa = await proximaRotaMfa(supabase, eu.papel);
  if (rotaMfa) redirect(rotaMfa);

  const podeEditar = PAPEIS_QUE_EDITAM.has(eu.papel);
  const campanha = Array.isArray(eu.campanhas) ? eu.campanhas[0] : eu.campanhas;

  const [processosRes, evidenciasRes] = await Promise.all([
    supabase
      .from("processos_eleitorais")
      .select(`
        id, numero_processo, tipo, tribunal, status, titulo, descricao,
        parte_autora, parte_re, data_distribuicao, data_julgamento, resultado, created_at,
        prazos_processuais(id, titulo, data_limite, status, descricao),
        provas_processo(id, observacao, monitoramento_itens(id, descricao, url, hash_evidencia, hash_calculado_em))
      `)
      .order("created_at", { ascending: false }),
    supabase
      .from("monitoramento_itens")
      .select("id, descricao, hash_evidencia, hash_calculado_em")
      .not("hash_evidencia", "is", null)
      .order("created_at", { ascending: false }),
  ]);

  return (
    <AppShell campanhaNome={campanha?.nome_candidato ?? undefined} papel={PAPEL_LABEL[eu.papel]}>
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-8 px-4 py-8">
        <div>
          <h1 className="text-lg font-semibold">Processos Eleitorais</h1>
          <p className="text-sm text-neutral-500">
            Gestão de representações, ações e recursos — com prazos processuais e provas vinculadas.
          </p>
        </div>

        {podeEditar && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
              Novo processo
            </h2>
            <ProcessoForm campanhaId={eu.campanha_id} />
          </section>
        )}

        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Processos
          </h2>
          <ProcessosList
            processos={(processosRes.data as any) ?? []}
            campanhaId={eu.campanha_id}
            podeEditar={podeEditar}
            evidencias={evidenciasRes.data ?? []}
          />
        </section>
      </main>
    </AppShell>
  );
}
