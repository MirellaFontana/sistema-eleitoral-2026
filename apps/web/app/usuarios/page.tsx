import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/AppHeader";
import { InviteUserForm } from "./InviteUserForm";
import { TerritorioForm } from "./TerritorioForm";
import { proximaRotaMfa } from "@/lib/mfa";

// expira_em é data (sem hora) — formatar em UTC evita que o fuso local jogue pro dia anterior.
function formatarDataUTC(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

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
    .select("papel, nome, campanha_id, campanhas(nome_candidato)")
    .eq("id", user.id)
    .maybeSingle();

  if (!eu) redirect("/onboarding");

  const rotaMfa = await proximaRotaMfa(supabase, eu.papel);
  if (rotaMfa) redirect(rotaMfa);

  const isCoordCampanha = eu.papel === "coord_campanha";

  const { data: usuarios } = await supabase
    .from("usuarios_internos")
    .select("id, nome, papel, status, expira_em, exige_mfa, territorios(nome_bairro)")
    .order("nome");

  const { data: territorios } = await supabase
    .from("territorios")
    .select("id, nome_bairro")
    .order("nome_bairro");

  const campanha = Array.isArray(eu.campanhas) ? eu.campanhas[0] : eu.campanhas;

  return (
    <div className="flex flex-col flex-1">
      <AppHeader
        campanhaNome={campanha?.nome_candidato ?? undefined}
        papel={PAPEL_LABEL[eu.papel]}
      />

      <main className="mx-auto w-full max-w-3xl flex-1 space-y-8 px-4 py-8">
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
          <div className="overflow-x-auto rounded border border-neutral-200">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 text-left text-xs uppercase text-neutral-500">
                <tr>
                  <th className="px-3 py-2">Nome</th>
                  <th className="px-3 py-2">Papel</th>
                  <th className="px-3 py-2">Território</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Expira em</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {(usuarios ?? []).map((u) => {
                  const territorio = Array.isArray(u.territorios) ? u.territorios[0] : u.territorios;
                  return (
                    <tr key={u.id}>
                      <td className="px-3 py-2">{u.nome}</td>
                      <td className="px-3 py-2">{PAPEL_LABEL[u.papel] ?? u.papel}</td>
                      <td className="px-3 py-2 text-neutral-500">
                        {territorio?.nome_bairro ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-neutral-500">{u.status}</td>
                      <td className="px-3 py-2 text-neutral-500">
                        {u.expira_em ? formatarDataUTC(u.expira_em) : "—"}
                      </td>
                    </tr>
                  );
                })}
                {(usuarios ?? []).length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-neutral-400">
                      Nenhum usuário ainda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
