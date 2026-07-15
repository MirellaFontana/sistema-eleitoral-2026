import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/AppHeader";
import { proximaRotaMfa } from "@/lib/mfa";
import { FaqForm } from "./FaqForm";
import { SugestaoForm } from "./SugestaoForm";
import { AnaliseButton } from "./AnaliseButton";

const PAPEL_LABEL: Record<string, string> = {
  embaixador: "Embaixador",
  advogado_responsavel: "Advogado responsável",
  assistente_juridico: "Assistente jurídico",
  coord_marketing: "Coord. de marketing",
  redator_marketing: "Redator de marketing",
  coord_campanha: "Coord. de campanha",
  candidato: "Candidato",
};

const PAPEIS_QUE_GERAM = new Set(["coord_campanha", "coord_marketing", "redator_marketing"]);

const FORMATO_LABEL: Record<string, string> = {
  post: "Post",
  whatsapp: "WhatsApp",
  carrossel: "Carrossel",
  roteiro_video: "Roteiro de vídeo",
  outro: "Outro",
};

export default async function MarketingPage() {
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

  const [faqsRes, propostasRes, sugestoesRes, analisesRes] = await Promise.all([
    supabase.from("faqs").select("id, pergunta, resposta").order("created_at", { ascending: false }),
    supabase
      .from("base_conhecimento_itens")
      .select("id, titulo, descricao")
      .not("descricao", "is", null)
      .order("titulo"),
    supabase
      .from("sugestoes_conteudo")
      .select("id, formato, sugestao, created_at")
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("analises_campanha")
      .select("id, analise, created_at")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  return (
    <div className="flex flex-col flex-1">
      <AppHeader campanhaNome={campanha?.nome_candidato ?? undefined} papel={PAPEL_LABEL[eu.papel]} />

      <main className="mx-auto w-full max-w-3xl flex-1 space-y-10 px-4 py-8">
        <div>
          <h1 className="text-lg font-semibold">Marketing</h1>
          <p className="text-sm text-neutral-500">
            Sugestões de conteúdo, análise de pontos cegos e FAQs — a IA sugere estrutura e texto
            de referência; quem faz a arte final e publica é sempre humano.
          </p>
        </div>

        {podeGerar && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
              Gerar sugestão de conteúdo
            </h2>
            <SugestaoForm propostas={propostasRes.data ?? []} />
          </section>
        )}

        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Histórico de sugestões
          </h2>
          {(sugestoesRes.data ?? []).length === 0 && (
            <p className="text-sm text-neutral-400">Nenhuma sugestão gerada ainda.</p>
          )}
          <ul className="space-y-2">
            {(sugestoesRes.data ?? []).map((s) => (
              <li key={s.id} className="rounded border border-neutral-200 p-3 space-y-1">
                <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium">
                  {FORMATO_LABEL[s.formato] ?? s.formato}
                </span>
                <p className="whitespace-pre-wrap text-sm">{s.sugestao}</p>
              </li>
            ))}
          </ul>
        </section>

        {podeGerar && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
              Análise de pontos cegos
            </h2>
            <p className="text-sm text-neutral-500">
              Cruza nossas propostas com concorrentes e demandas observadas cadastradas.
            </p>
            <AnaliseButton />
          </section>
        )}

        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Histórico de análises
          </h2>
          {(analisesRes.data ?? []).length === 0 && (
            <p className="text-sm text-neutral-400">Nenhuma análise gerada ainda.</p>
          )}
          <ul className="space-y-2">
            {(analisesRes.data ?? []).map((a) => (
              <li key={a.id} className="rounded border border-neutral-200 p-3">
                <p className="whitespace-pre-wrap text-sm">{a.analise}</p>
              </li>
            ))}
          </ul>
        </section>

        {podeGerar && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
              Adicionar FAQ
            </h2>
            <FaqForm campanhaId={eu.campanha_id} />
          </section>
        )}

        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            FAQs cadastradas
          </h2>
          {(faqsRes.data ?? []).length === 0 && (
            <p className="text-sm text-neutral-400">Nenhuma FAQ cadastrada ainda.</p>
          )}
          <ul className="space-y-2">
            {(faqsRes.data ?? []).map((f) => (
              <li key={f.id} className="rounded border border-neutral-200 p-3 space-y-1">
                <p className="text-sm font-medium">{f.pergunta}</p>
                <p className="text-sm text-neutral-600">{f.resposta}</p>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
