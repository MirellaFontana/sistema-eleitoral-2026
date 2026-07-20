import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import { proximaRotaMfa } from "@/lib/mfa";
import { ModeloForm, SITUACOES } from "./ModeloForm";
import { ModeloCard, type ModeloView } from "./ModeloCard";

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

const PAPEIS_QUE_CRIAM = new Set(["coord_campanha", "coord_marketing", "redator_marketing"]);
const PAPEIS_QUE_APROVAM = new Set(["coord_campanha", "coord_marketing"]);

type LinhaModelo = {
  id: string;
  situacao: string;
  titulo: string;
  conteudo: string;
  versao: number;
  status: string;
  atualizado_em: string;
  criado_por: { nome: string } | { nome: string }[] | null;
  aprovado_por: { nome: string } | { nome: string }[] | null;
};

export default async function ModelosMensagemPage() {
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
  const podeCriar = PAPEIS_QUE_CRIAM.has(eu.papel);
  const podeAprovar = PAPEIS_QUE_APROVAM.has(eu.papel);
  const podeExcluir = eu.papel === "coord_campanha";

  const { data: modelos } = await supabase
    .from("modelos_mensagem")
    .select(
      "id, situacao, titulo, conteudo, versao, status, atualizado_em, criado_por:usuarios_internos!criado_por(nome), aprovado_por:usuarios_internos!aprovado_por(nome)"
    )
    .order("situacao")
    .order("titulo");

  const grupos = new Map<string, ModeloView[]>();
  for (const m of (modelos ?? []) as unknown as LinhaModelo[]) {
    const criador = Array.isArray(m.criado_por) ? m.criado_por[0] : m.criado_por;
    const aprovador = Array.isArray(m.aprovado_por) ? m.aprovado_por[0] : m.aprovado_por;
    const view: ModeloView = {
      id: m.id,
      titulo: m.titulo,
      conteudo: m.conteudo,
      versao: m.versao,
      status: m.status,
      criadoPorNome: criador?.nome ?? null,
      aprovadoPorNome: aprovador?.nome ?? null,
      atualizadoEm: m.atualizado_em,
    };
    const lista = grupos.get(m.situacao) ?? [];
    lista.push(view);
    grupos.set(m.situacao, lista);
  }

  return (
    <AppShell campanhaNome={campanha?.nome_candidato ?? undefined} papel={PAPEL_LABEL[eu.papel]}>
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-8 px-4 py-8">
        <div>
          <h1 className="text-lg font-semibold">Biblioteca de mensagens aprovadas</h1>
          <p className="text-sm text-neutral-500">
            Modelos de referência para situações recorrentes — não são enviados automaticamente,
            é um catálogo pra equipe consultar e adaptar na hora de responder.
          </p>
        </div>

        {podeCriar && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
              Novo modelo
            </h2>
            <ModeloForm campanhaId={eu.campanha_id} />
          </section>
        )}

        {SITUACOES.map((s) => {
          const lista = grupos.get(s.value) ?? [];
          if (lista.length === 0) return null;
          return (
            <section key={s.value} className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
                {s.label}
              </h2>
              <ul className="space-y-2">
                {lista.map((m) => (
                  <ModeloCard
                    key={m.id}
                    modelo={m}
                    podeEditar={podeCriar}
                    podeAprovar={podeAprovar}
                    podeExcluir={podeExcluir}
                    currentUserId={user.id}
                  />
                ))}
              </ul>
            </section>
          );
        })}

        {(modelos ?? []).length === 0 && (
          <p className="text-sm text-neutral-400">Nenhum modelo cadastrado ainda.</p>
        )}
      </main>
    </AppShell>
  );
}
