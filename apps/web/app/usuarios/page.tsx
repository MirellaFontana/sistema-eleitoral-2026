import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import { InviteUserForm } from "./InviteUserForm";
import { TerritorioForm } from "./TerritorioForm";
import { UsuariosTable } from "./UsuariosTable";
import { CampanhaForm } from "./CampanhaForm";
import { proximaRotaMfa } from "@/lib/mfa";

const PAPEL_LABEL: Record<string, string> = {
  embaixador: "Embaixador",
  advogado_responsavel: "Advogado responsável",
  assistente_juridico: "Assistente jurídico",
  coord_marketing: "Coord. de marketing",
  redator_marketing: "Redator de marketing",
  coord_campanha: "Coord. de campanha",
  candidato: "Candidato",
};

export default async function UsuariosPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: eu } = await supabase
    .from("usuarios_internos")
    .select("papel, nome, campanha_id, campanhas(id, nome_candidato, cargo, uf, partido, numero_candidato, nome_urna, cnpj_campanha, coligacao)")
    .eq("id", user.id)
    .maybeSingle();

  if (!eu) redirect("/onboarding");

  const rotaMfa = await proximaRotaMfa(supabase, eu.papel);
  if (rotaMfa) redirect(rotaMfa);

  const isCoordCampanha = eu.papel === "coord_campanha";

  const { data: usuarios } = await supabase
    .from("usuarios_internos")
    .select("id, nome, papel, status, expira_em, territorio_id, territorios(nome_bairro)")
    .order("nome");

  const linhas = (usuarios ?? []).map((u) => {
    const territorio = Array.isArray(u.territorios) ? u.territorios[0] : u.territorios;
    return {
      id: u.id,
      nome: u.nome,
      papel: u.papel,
      status: u.status,
      expiraEm: u.expira_em,
      territorioId: u.territorio_id,
      territorioNome: territorio?.nome_bairro ?? null,
    };
  });

  const { data: territorios } = await supabase
    .from("territorios")
    .select("id, nome_bairro")
    .order("nome_bairro");

  const campanha = Array.isArray(eu.campanhas) ? eu.campanhas[0] : eu.campanhas;

  return (
    <AppShell campanhaNome={campanha?.nome_candidato ?? undefined} papel={PAPEL_LABEL[eu.papel]}>
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-8 px-4 py-8">
        {isCoordCampanha && campanha && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
              Dados da campanha
            </h2>
            <CampanhaForm
              dados={{
                campanhaId: campanha.id,
                nomeCandidato: campanha.nome_candidato,
                cargo: campanha.cargo,
                uf: campanha.uf,
                partido: campanha.partido,
                numeroCandidato: campanha.numero_candidato ?? null,
                nomeUrna: campanha.nome_urna ?? null,
                cnpjCampanha: campanha.cnpj_campanha ?? null,
                coligacao: campanha.coligacao ?? null,
              }}
            />
          </section>
        )}

        {isCoordCampanha && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
              Territórios
            </h2>
            <TerritorioForm campanhaId={eu.campanha_id} />
          </section>
        )}

        {isCoordCampanha && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
              Convidar usuário
            </h2>
            <InviteUserForm territorios={territorios ?? []} />
          </section>
        )}

        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Usuários da campanha
          </h2>
          <UsuariosTable
            linhas={linhas}
            territorios={territorios ?? []}
            podeGerenciar={isCoordCampanha}
            meuId={user.id}
          />
        </section>
      </main>
    </AppShell>
  );
}
