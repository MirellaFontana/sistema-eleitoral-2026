import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import { proximaRotaMfa } from "@/lib/mfa";
import { labelTerritorio } from "@/lib/territorio";
import { ApoiadorForm } from "./ApoiadorForm";
import { ApoiadoresTable } from "./ApoiadoresTable";

const PAPEL_LABEL: Record<string, string> = {
  embaixador: "Liderança de campo (legado)",
  advogado_responsavel: "Advogado responsável",
  assistente_juridico: "Assistente jurídico",
  coord_marketing: "Coord. de marketing",
  redator_marketing: "Redator de marketing",
  coord_campanha: "Coord. de campanha",
  candidato: "Candidato",
};

const PAPEIS_QUE_GERENCIAM = new Set(["coord_campanha", "coord_marketing"]);

export default async function ApoiadoresPage() {
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

  const podeGerenciar = PAPEIS_QUE_GERENCIAM.has(eu.papel);
  const podeVincularCidadao = eu.papel === "coord_campanha";
  const campanha = Array.isArray(eu.campanhas) ? eu.campanhas[0] : eu.campanhas;

  const [{ data: apoiadores }, { data: territorios }, cidadaosRes] = await Promise.all([
    supabase
      .from("apoiadores")
      .select(
        "id, nome, telefone, cidade, bairro, territorio_id, formas_ajuda, detalhe_ajuda, disponibilidade, status, territorios(nome_bairro, cidade), cidadaos(nome)"
      )
      .order("created_at", { ascending: false }),
    supabase.from("territorios").select("id, nome_bairro, cidade").order("nome_bairro"),
    // Só quem pode vincular (coord_campanha) tem RLS pra ler cidadaos — pros outros papéis essa
    // query volta vazia por policy, não é um bug: reflete a mesma trava de PII de sempre.
    podeVincularCidadao
      ? supabase.from("cidadaos").select("id, nome").order("nome")
      : Promise.resolve({ data: [] as { id: string; nome: string }[] }),
  ]);

  const linhas = (apoiadores ?? []).map((a) => {
    const terr = Array.isArray(a.territorios) ? a.territorios[0] : a.territorios;
    const cidadao = Array.isArray(a.cidadaos) ? a.cidadaos[0] : a.cidadaos;
    return {
      id: a.id,
      nome: a.nome,
      telefone: a.telefone,
      cidade: a.cidade,
      bairro: a.bairro,
      territorioId: a.territorio_id,
      localizacao: a.bairro || a.cidade ? labelTerritorio(a.bairro, a.cidade) : labelTerritorio(terr?.nome_bairro, terr?.cidade),
      formasAjuda: a.formas_ajuda ?? [],
      detalheAjuda: a.detalhe_ajuda,
      disponibilidade: a.disponibilidade,
      status: a.status,
      cidadaoNome: cidadao?.nome ?? null,
    };
  });

  return (
    <AppShell campanhaNome={campanha?.nome_candidato ?? undefined} papel={PAPEL_LABEL[eu.papel]}>
      <main className="mx-auto w-full max-w-4xl flex-1 space-y-8 px-4 py-8">
        <div>
          <h1 className="text-lg font-semibold">Apoiadores</h1>
          <p className="text-sm text-neutral-500">
            Pessoas que se oferecem pra ajudar a campanha — não precisa já ser eleitor cadastrado.
            Cadastro mais leve que o de eleitor (sem o mesmo formalismo de consentimento LGPD).
          </p>
        </div>

        {podeGerenciar && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
              Novo apoiador
            </h2>
            <ApoiadorForm
              campanhaId={eu.campanha_id}
              territorios={territorios ?? []}
              cidadaos={podeVincularCidadao ? (cidadaosRes.data ?? []) : null}
            />
          </section>
        )}

        <section className="space-y-3">
          <ApoiadoresTable linhas={linhas} territorios={territorios ?? []} podeGerenciar={podeGerenciar} />
        </section>
      </main>
    </AppShell>
  );
}
