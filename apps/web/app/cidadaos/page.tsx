import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import { proximaRotaMfa } from "@/lib/mfa";
import { CidadaoForm } from "./CidadaoForm";
import { CidadaoTable } from "./CidadaoTable";
import { labelTerritorio } from "@/lib/territorio";

const PAPEL_LABEL: Record<string, string> = {
  embaixador: "Liderança de campo (legado)",
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

// Base nominal: RLS libera leitura só pra coordenação e candidato (0006); digitação só coordenação.
const PAPEIS_QUE_LEEM = new Set(["coord_campanha", "candidato"]);

export default async function CidadaosPage() {
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
  const podeLer = PAPEIS_QUE_LEEM.has(eu.papel);
  const podeDigitar = eu.papel === "coord_campanha";

  if (!podeLer) {
    return (
      <AppShell campanhaNome={campanha?.nome_candidato ?? undefined} papel={PAPEL_LABEL[eu.papel]}>
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
          <h1 className="text-lg font-semibold">Eleitores</h1>
          <p className="mt-2 text-sm text-neutral-500">
            Seu papel não tem acesso à base nominal de eleitores — por design (LGPD): só
            coordenação e candidato enxergam dado pessoal de cidadão.
          </p>
        </main>
      </AppShell>
    );
  }

  const [{ data: cidadaos }, { data: liderancasAtivas }, { data: liderancasTodas }, { data: territorios }] =
    await Promise.all([
      supabase
        .from("cidadaos")
        .select(
          "id, nome, whatsapp, email, circulo, status, created_at, lideranca_id, liderancas(nome), territorio_id, territorios(nome_bairro, cidade)"
        )
        .order("created_at", { ascending: false }),
      supabase.from("liderancas").select("id, nome, status").eq("status", "ativa").order("nome"),
      // Sem filtro de status: um eleitor pode ter sido atribuído a uma liderança que foi desativada
      // depois — o dropdown de edição precisa continuar mostrando essa opção pra não "sumir" o vínculo.
      supabase.from("liderancas").select("id, nome").order("nome"),
      supabase.from("territorios").select("id, nome_bairro, cidade").order("nome_bairro"),
    ]);

  const linhas = (cidadaos ?? []).map((c) => {
    const lid = Array.isArray(c.liderancas) ? c.liderancas[0] : c.liderancas;
    const terr = Array.isArray(c.territorios) ? c.territorios[0] : c.territorios;
    return {
      id: c.id,
      nome: c.nome,
      whatsapp: c.whatsapp,
      email: c.email,
      circulo: c.circulo,
      status: c.status,
      liderancaId: c.lideranca_id,
      liderancaNome: lid?.nome ?? null,
      territorioId: c.territorio_id,
      territorioLabel: labelTerritorio(terr?.nome_bairro, terr?.cidade),
      createdAt: c.created_at,
    };
  });

  return (
    <AppShell campanhaNome={campanha?.nome_candidato ?? undefined} papel={PAPEL_LABEL[eu.papel]}>
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-8 px-4 py-8">
        <div>
          <h1 className="text-lg font-semibold">Eleitores — digitação de formulários</h1>
          <p className="text-sm text-neutral-500">
            Cadastro digitado a partir do formulário físico trazido pela liderança, um a um, com
            consentimento registrado. Não existe importação de lista — por design.
          </p>
        </div>

        {podeDigitar && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
              Digitar formulário
            </h2>
            {(liderancasAtivas ?? []).length === 0 ? (
              <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                Cadastre primeiro uma liderança ativa em “Lideranças” — todo formulário digitado
                precisa ser atribuído à liderança que o trouxe.
              </p>
            ) : (
              <CidadaoForm
                campanhaId={eu.campanha_id}
                liderancas={liderancasAtivas ?? []}
                territorios={territorios ?? []}
              />
            )}
          </section>
        )}

        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Eleitores cadastrados
          </h2>

          <CidadaoTable
            linhas={linhas}
            liderancas={liderancasTodas ?? []}
            territorios={territorios ?? []}
            podeGerenciar={podeDigitar}
          />
        </section>
      </main>
    </AppShell>
  );
}
