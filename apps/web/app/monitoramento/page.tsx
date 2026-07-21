import { redirect } from "next/navigation";
import { Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import { proximaRotaMfa } from "@/lib/mfa";
import { MonitoramentoWorkspace } from "./MonitoramentoWorkspace";
import { VerCapturaButton } from "./VerCapturaButton";
import type { TermoView } from "./TermosMonitoramento";

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

const PAPEIS_QUE_REGISTRAM = new Set([
  "coord_campanha",
  "advogado_responsavel",
  "assistente_juridico",
  "coord_marketing",
  "redator_marketing",
]);

const CATEGORIA_LABEL: Record<string, string> = {
  ameaca_juridica: "Ameaça jurídica",
  deepfake_suspeito: "Deepfake suspeito",
  gestao_crise: "Gestão de crise",
  mencao_positiva: "Menção positiva",
  mencao_neutra: "Menção neutra",
  mencao_negativa: "Menção negativa",
  oportunidade_marketing: "Oportunidade de marketing",
  outro: "Outro",
};

const GRAVIDADE_LABEL: Record<string, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
};

export default async function MonitoramentoPage() {
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

  const podeRegistrar = PAPEIS_QUE_REGISTRAM.has(eu.papel);
  const campanha = Array.isArray(eu.campanhas) ? eu.campanhas[0] : eu.campanhas;

  // Semeia o próprio candidato como primeiro termo monitorado, uma única vez por campanha —
  // mantém o comportamento de antes (buscava o candidato automaticamente) sem exigir que
  // alguém cadastre isso manualmente antes de usar a busca pela primeira vez.
  if (podeRegistrar && campanha?.nome_candidato) {
    const { count } = await supabase
      .from("termos_monitoramento")
      .select("*", { count: "exact", head: true });
    if (count === 0) {
      await supabase.from("termos_monitoramento").insert({
        campanha_id: eu.campanha_id,
        termo: campanha.nome_candidato,
        rotulo: "Candidato",
      });
    }
  }

  const [{ data: itens }, { data: termosData }] = await Promise.all([
    supabase
      .from("monitoramento_itens")
      .select("id, url, descricao, categoria, gravidade, status, captura_path, hash_evidencia, created_at")
      .order("created_at", { ascending: false }),
    supabase
      .from("termos_monitoramento")
      .select("id, termo, rotulo, ativo")
      .order("created_at"),
  ]);

  const termos: TermoView[] = termosData ?? [];

  return (
    <AppShell campanhaNome={campanha?.nome_candidato ?? undefined} papel={PAPEL_LABEL[eu.papel]}>
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-8 px-4 py-8">
        <div>
          <h1 className="text-lg font-semibold">Monitoramento</h1>
          <p className="text-sm text-neutral-500">
            Menções ao candidato encontradas na internet — de ameaça jurídica e gestão de crise a
            menções de sentimento e oportunidades de marketing. Registro manual por enquanto.
          </p>
        </div>

        {podeRegistrar && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
              Registrar item
            </h2>
            <MonitoramentoWorkspace campanhaId={eu.campanha_id} termos={termos} />
          </section>
        )}

        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Itens registrados
          </h2>

          {(itens ?? []).length === 0 && (
            <p className="text-sm text-neutral-400">Nenhum item registrado ainda.</p>
          )}

          <ul className="space-y-2">
            {(itens ?? []).map((item) => (
              <li key={item.id} className="rounded border border-neutral-200 p-3 space-y-1">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-full bg-neutral-100 px-2 py-0.5 font-medium">
                    {CATEGORIA_LABEL[item.categoria] ?? item.categoria}
                  </span>
                  {item.gravidade && (
                    <span className="rounded-full bg-neutral-100 px-2 py-0.5">
                      Gravidade: {GRAVIDADE_LABEL[item.gravidade] ?? item.gravidade}
                    </span>
                  )}
                  <span className="text-neutral-400">{item.status}</span>
                  {item.hash_evidencia && (
                    <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-800">
                      <Lock size={12} strokeWidth={2} aria-hidden="true" />
                      Evidência lacrada
                    </span>
                  )}
                </div>
                <p className="text-sm">{item.descricao}</p>
                <div className="flex gap-3">
                  {item.url && (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-neutral-900 underline underline-offset-2"
                    >
                      Abrir link
                    </a>
                  )}
                  {item.captura_path && <VerCapturaButton path={item.captura_path} />}
                </div>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </AppShell>
  );
}
