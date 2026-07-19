import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import { proximaRotaMfa } from "@/lib/mfa";
import { RespostaForm } from "./RespostaForm";

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

const PAPEIS_QUE_GERAM = new Set(["coord_campanha", "coord_marketing", "redator_marketing"]);

const CANAL_LABEL: Record<string, string> = {
  site: "Site",
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  tiktok: "TikTok",
  facebook: "Facebook",
  radio: "Rádio",
  tv: "TV",
  outro: "Outro",
};

export default async function RespostasPage() {
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

  const podeGerar = PAPEIS_QUE_GERAM.has(eu.papel);
  const campanha = Array.isArray(eu.campanhas) ? eu.campanhas[0] : eu.campanhas;

  const { data: respostas } = await supabase
    .from("respostas_redes_sociais")
    .select("id, pergunta, canal_origem, resposta_sugerida, created_at")
    .order("created_at", { ascending: false })
    .limit(20);

  return (
    <AppShell campanhaNome={campanha?.nome_candidato ?? undefined} papel={PAPEL_LABEL[eu.papel]}>
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-8 px-4 py-8">
        <div>
          <h1 className="text-lg font-semibold">Respostas</h1>
          <p className="text-sm text-neutral-500">
            Cole uma pergunta recebida nas redes sociais e receba uma sugestão de resposta baseada
            no conhecimento já cadastrado na campanha — a IA sugere, a publicação é sempre humana.
          </p>
        </div>

        {podeGerar && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
              Nova pergunta
            </h2>
            <RespostaForm />
          </section>
        )}

        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Histórico de respostas
          </h2>
          {(respostas ?? []).length === 0 && (
            <p className="text-sm text-neutral-400">Nenhuma resposta gerada ainda.</p>
          )}
          <ul className="space-y-2">
            {(respostas ?? []).map((r) => (
              <li key={r.id} className="rounded border border-neutral-200 p-3 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-full bg-neutral-100 px-2 py-0.5 font-medium">
                    {CANAL_LABEL[r.canal_origem] ?? r.canal_origem}
                  </span>
                </div>
                <p className="text-sm font-medium">{r.pergunta}</p>
                <p className="whitespace-pre-wrap text-sm text-neutral-600">{r.resposta_sugerida}</p>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </AppShell>
  );
}
