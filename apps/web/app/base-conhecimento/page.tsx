import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import { proximaRotaMfa } from "@/lib/mfa";
import { TemaForm } from "./TemaForm";
import { ItemForm } from "./ItemForm";
import { ItemCard } from "./ItemCard";

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

// Slug do nome do tema vira âncora — permite o menu linkar direto pra um tema (ex.: "Código
// eleitoral") sem precisar saber o UUID dele, que é diferente por campanha.
function slugTema(nome: string) {
  return nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default async function BaseConhecimentoPage() {
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

  const { data: temas } = await supabase
    .from("temas_campanha")
    .select("id, nome, ordem")
    .order("ordem");

  const { data: itens } = await supabase
    .from("base_conhecimento_itens")
    .select("id, tema_id, titulo, descricao, created_at")
    .order("created_at", { ascending: false });

  const { data: arquivos } = await supabase
    .from("base_conhecimento_arquivos")
    .select("id, item_id, arquivo_path, arquivo_nome_original");

  const proximaOrdem = (temas?.length ?? 0) + 1;

  return (
    <AppShell campanhaNome={campanha?.nome_candidato ?? undefined} papel={PAPEL_LABEL[eu.papel]}>
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-8 px-4 py-8">
        <div>
          <h1 className="text-lg font-semibold">Base de conhecimento da campanha</h1>
          <p className="text-sm text-neutral-500">
            Propostas, biografia e demais informações de referência — não gera conteúdo
            automaticamente ainda, é consulta manual pra quem escreve peça ou responde demanda.
          </p>
        </div>

        {podeEditar && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
              Temas
            </h2>
            <TemaForm campanhaId={eu.campanha_id} proximaOrdem={proximaOrdem} />
          </section>
        )}

        {podeEditar && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
              Adicionar item
            </h2>
            <ItemForm campanhaId={eu.campanha_id} temas={temas ?? []} />
          </section>
        )}

        <section className="space-y-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Conteúdo cadastrado
          </h2>

          {(temas ?? []).length === 0 && (
            <p className="text-sm text-neutral-400">Nenhum tema cadastrado ainda.</p>
          )}

          {(temas ?? []).map((tema) => {
            const itensDoTema = (itens ?? []).filter((i) => i.tema_id === tema.id);
            return (
              <div key={tema.id} id={`tema-${slugTema(tema.nome)}`} className="scroll-mt-6 space-y-2">
                <h3 className="text-sm font-semibold">{tema.nome}</h3>
                {itensDoTema.length === 0 ? (
                  <p className="text-sm text-neutral-400">Nenhum item neste tema ainda.</p>
                ) : (
                  <ul className="space-y-2">
                    {itensDoTema.map((item) => (
                      <ItemCard
                        key={item.id}
                        item={item}
                        arquivos={(arquivos ?? []).filter((a) => a.item_id === item.id)}
                        campanhaId={eu.campanha_id}
                        podeEditar={podeEditar}
                      />
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </section>
      </main>
    </AppShell>
  );
}
