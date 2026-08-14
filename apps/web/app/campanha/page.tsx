import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import { proximaRotaMfa } from "@/lib/mfa";
import { CampanhaForm } from "./CampanhaForm";
import { FotosCampanha } from "./FotosCampanha";
import { ChavesApiPanel } from "./ChavesApiPanel";
import { ExcluirCampanha } from "./ExcluirCampanha";

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

export default async function CampanhaPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: eu } = await supabase
    .from("usuarios_internos")
    .select(
      "papel, campanha_id, campanhas(id, nome_candidato, cargo, uf, partido, numero_candidato, nome_urna, cnpj_campanha, coligacao, voz_candidato)"
    )
    .eq("id", user.id)
    .maybeSingle();

  if (!eu) redirect("/onboarding");

  const rotaMfa = await proximaRotaMfa(supabase, eu.papel);
  if (rotaMfa) redirect(rotaMfa);

  const isCoordCampanha = eu.papel === "coord_campanha";
  const campanha = Array.isArray(eu.campanhas) ? eu.campanhas[0] : eu.campanhas;

  const [{ data: fotos }, { data: chavesData }] = await Promise.all([
    supabase
      .from("fotos_campanha")
      .select("id, tipo, nome_original, path, largura, altura")
      .order("tipo"),
    isCoordCampanha
      ? supabase
          .from("chaves_api")
          .select("provedor, ativo, auxiliar")
      : Promise.resolve({ data: null }),
  ]);

  const TODOS_PROVEDORES = [
    "anthropic", "openai", "google_gemini", "xai_grok", "google_cse",
    "meta_ad_library", "whatsapp_campanha", "whatsapp_denuncias",
  ];
  const chavesStatus = TODOS_PROVEDORES.map((p) => {
    const found = (chavesData ?? []).find((c: { provedor: string }) => c.provedor === p);
    return {
      provedor: p,
      configurada: !!found?.ativo,
      auxiliar: (found as { auxiliar?: string | null } | undefined)?.auxiliar ?? null,
    };
  });

  return (
    <AppShell campanhaNome={campanha?.nome_candidato ?? undefined} papel={PAPEL_LABEL[eu.papel]}>
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-8 px-4 py-8">
        <div>
          <h1 className="text-lg font-semibold">Cadastro de campanha</h1>
          <p className="text-sm text-neutral-500">
            Identidade eleitoral do candidato — nome de urna, número, CNPJ da campanha e
            coligação, usados na identificação legal das peças e nas sugestões geradas por IA.
          </p>
        </div>

        {isCoordCampanha && campanha ? (
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
              vozCandidato: campanha.voz_candidato ?? null,
            }}
          />
        ) : (
          <p className="text-sm text-neutral-400">
            Somente a coordenação de campanha edita esses dados.
          </p>
        )}

        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
              Fotos e logotipos
            </h2>
            <p className="text-sm text-neutral-400">
              Usadas na geração de peças de conteúdo e templates de arte.
            </p>
          </div>
          {campanha && (
            <FotosCampanha
              campanhaId={campanha.id}
              fotos={fotos ?? []}
              podeEditar={isCoordCampanha}
            />
          )}
        </section>

        {isCoordCampanha && (
          <ChavesApiPanel chavesIniciais={chavesStatus} />
        )}

        {isCoordCampanha && campanha && (
          <section className="space-y-3 border-t border-neutral-200 pt-8">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-red-500">
                Zona de perigo
              </h2>
              <p className="text-sm text-neutral-400">
                Excluir a campanha remove permanentemente todos os dados — usuários, propostas,
                monitoramento, agenda, conteúdo e histórico.
              </p>
            </div>
            <ExcluirCampanha campanhaId={campanha.id} nomeCandidato={campanha.nome_candidato} />
          </section>
        )}
      </main>
    </AppShell>
  );
}
