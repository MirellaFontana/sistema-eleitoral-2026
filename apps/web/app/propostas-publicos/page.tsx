import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import { proximaRotaMfa } from "@/lib/mfa";
import { PropostasPublicosClient } from "./PropostasPublicosClient";

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

const PAPEIS_QUE_EDITAM = new Set(["coord_campanha", "coord_marketing"]);

const PUBLICOS_PADRAO = [
  "Produtores rurais",
  "Agricultura familiar",
  "Cooperativas",
  "Empresários e comerciantes",
  "Microempreendedores",
  "Trabalhadores formais",
  "Servidores públicos",
  "Professores",
  "Profissionais de saúde",
  "Policiais e agentes penitenciários",
  "Mulheres",
  "Jovens",
  "Idosos",
  "Pessoas com deficiência",
  "Mães atípicas",
  "Moradores de periferias",
  "População rural",
  "Estudantes",
  "Comunidades indígenas e tradicionais",
  "Organizações sociais",
  "Prefeitos e vereadores",
  "Lideranças religiosas",
  "Setor cultural",
  "Setor de turismo",
  "Sindicatos e associações profissionais",
];

export default async function PropostasPublicosPage() {
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

  const { data: existentes } = await supabase
    .from("propostas_publicos")
    .select("id, publico, demandas_reclamacoes, propostas")
    .order("created_at");

  if (!existentes || existentes.length === 0) {
    const inserts = PUBLICOS_PADRAO.map((p) => ({
      campanha_id: eu.campanha_id,
      publico: p,
    }));
    await supabase.from("propostas_publicos").insert(inserts);
  }

  const { data: registros } = await supabase
    .from("propostas_publicos")
    .select("id, publico, demandas_reclamacoes, propostas")
    .order("created_at");

  return (
    <AppShell campanhaNome={campanha?.nome_candidato ?? undefined} papel={PAPEL_LABEL[eu.papel]}>
      <main className="mx-auto w-full max-w-4xl flex-1 space-y-8 px-4 py-8">
        <div>
          <h1 className="text-lg font-semibold">Propostas x Públicos</h1>
          <p className="text-sm text-neutral-500">
            Mapeamento de demandas, reclamações e propostas por segmento de público-alvo.
          </p>
        </div>

        <PropostasPublicosClient
          registros={registros ?? []}
          podeEditar={podeEditar}
          campanhaId={eu.campanha_id}
        />
      </main>
    </AppShell>
  );
}
