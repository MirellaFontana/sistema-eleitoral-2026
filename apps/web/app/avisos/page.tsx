import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import { proximaRotaMfa } from "@/lib/mfa";
import { AvisoForm } from "./AvisoForm";
import { AvisoCard, type AvisoView } from "./AvisoCard";

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

const PAPEIS_QUE_POSTAM = new Set([
  "coord_campanha",
  "coord_marketing",
  "redator_marketing",
  "advogado_responsavel",
  "assistente_juridico",
]);

type LinhaAviso = {
  id: string;
  categoria: string;
  titulo: string;
  mensagem: string;
  destinatario_papel: string | null;
  created_at: string;
  criado_por: { nome: string } | { nome: string }[] | null;
};

export default async function AvisosPage() {
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

  const campanha = Array.isArray(eu.campanhas) ? eu.campanhas[0] : eu.campanhas;
  const podePostar = PAPEIS_QUE_POSTAM.has(eu.papel);

  const [avisosRes, lidosRes] = await Promise.all([
    supabase
      .from("avisos_internos")
      .select(
        "id, categoria, titulo, mensagem, destinatario_papel, created_at, criado_por:usuarios_internos!criado_por(nome)"
      )
      .order("created_at", { ascending: false })
      .limit(50),
    supabase.from("avisos_internos_lidos").select("aviso_id").eq("usuario_id", user.id),
  ]);

  const lidosSet = new Set((lidosRes.data ?? []).map((l) => l.aviso_id));

  const avisos: AvisoView[] = ((avisosRes.data ?? []) as unknown as LinhaAviso[]).map((a) => {
    const criador = Array.isArray(a.criado_por) ? a.criado_por[0] : a.criado_por;
    return {
      id: a.id,
      categoria: a.categoria,
      titulo: a.titulo,
      mensagem: a.mensagem,
      destinatarioPapel: a.destinatario_papel,
      criadoPorNome: criador?.nome ?? null,
      createdAt: a.created_at,
      lido: lidosSet.has(a.id),
    };
  });

  const naoLidos = avisos.filter((a) => !a.lido).length;

  return (
    <AppShell campanhaNome={campanha?.nome_candidato ?? undefined} papel={PAPEL_LABEL[eu.papel]}>
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-8 px-4 py-8">
        <div>
          <h1 className="text-lg font-semibold">
            Avisos internos
            {naoLidos > 0 && (
              <span className="ml-2 rounded-full bg-indigo-100 px-2 py-0.5 align-middle text-xs font-semibold text-indigo-700">
                {naoLidos} novo{naoLidos > 1 ? "s" : ""}
              </span>
            )}
          </h1>
          <p className="text-sm text-neutral-500">
            Quadro de avisos do dia a dia da campanha — agenda, tarefas, aprovações, território e
            segurança. Diferente dos Alertas (que são só ameaça jurídica/crise automática).
          </p>
        </div>

        {podePostar && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
              Publicar aviso
            </h2>
            <AvisoForm campanhaId={eu.campanha_id} />
          </section>
        )}

        <section className="space-y-3">
          {avisos.length === 0 && (
            <p className="text-sm text-neutral-400">Nenhum aviso publicado ainda.</p>
          )}
          <ul className="space-y-2">
            {avisos.map((a) => (
              <AvisoCard key={a.id} aviso={a} currentUserId={user.id} />
            ))}
          </ul>
        </section>
      </main>
    </AppShell>
  );
}
