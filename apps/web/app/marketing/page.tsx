import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import { proximaRotaMfa } from "@/lib/mfa";
import { FaqForm } from "./FaqForm";
import { SugestaoForm } from "./SugestaoForm";
import { AvaliacaoForm } from "./AvaliacaoForm";
import { AnaliseButton } from "./AnaliseButton";
import { AdaptarForm } from "./AdaptarForm";
import { GerarImagemForm } from "./GerarImagemForm";
import { GeracaoInteligenteButton } from "./GeracaoInteligenteButton";

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

const PAPEIS_QUE_GERAM  = new Set(["coord_campanha", "coord_marketing", "redator_marketing"]);
const PAPEIS_QUE_AVALIAM = new Set([
  "coord_campanha", "coord_marketing", "redator_marketing",
  "advogado_responsavel", "assistente_juridico",
]);

const FORMATO_LABEL: Record<string, string> = {
  post: "Post",
  whatsapp: "WhatsApp",
  carrossel: "Carrossel",
  roteiro_video: "Roteiro de vídeo",
  reel: "Reel",
  stories: "Stories",
  thread: "Thread",
  live: "Live",
  roteiro_radio: "Rádio",
  roteiro_tv: "TV",
  outro: "Outro",
};

const DECISAO_LABEL: Record<string, { label: string; cls: string }> = {
  aprovar:             { label: "Aprovado",          cls: "bg-green-100 text-green-800" },
  aprovar_com_ajustes: { label: "Com ajustes",       cls: "bg-yellow-100 text-yellow-800" },
  reprovar:            { label: "Reprovado",          cls: "bg-red-100 text-red-800" },
};

type AvaliacaoJson = {
  legislacao?: { veredicto?: string };
  praticas_midia?: { veredicto?: string };
  viralidade?: { nota?: number };
  clareza?: { nota?: number };
  score_geral?: number;
  sintese?: { decisao?: string; recomendacoes?: string[] };
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

  const podeGerar  = PAPEIS_QUE_GERAM.has(eu.papel);
  const podeAvaliar = PAPEIS_QUE_AVALIAM.has(eu.papel);
  const { data: podeAdaptarRpc } = await supabase.rpc("has_permission", { p: "usar_ia" });
  const podeAdaptar = podeAdaptarRpc === true;
  const campanha = Array.isArray(eu.campanhas) ? eu.campanhas[0] : eu.campanhas;

  const [faqsRes, sugestoesRes, analisesRes, adaptacoesRes] = await Promise.all([
    supabase.from("faqs").select("id, pergunta, resposta").order("created_at", { ascending: false }),
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
    supabase
      .from("adaptacoes_mensagem")
      .select("id, lote_id, publico_alvo, canal, variacao, mensagem_central, created_at")
      .order("created_at", { ascending: false })
      .limit(24),
  ]);

  // Agrupa o histórico de adaptações por lote_id (uma mensagem central → suas variações),
  // pra UI mostrar "essa mensagem gerou 3 variações" em vez de linhas soltas.
  type LinhaAdaptacao = {
    id: string;
    lote_id: string;
    publico_alvo: string;
    canal: string;
    variacao: string;
    mensagem_central: string;
    created_at: string;
  };
  const lotesAdaptacao = new Map<
    string,
    { lote_id: string; mensagem_central: string; created_at: string; variacoes: LinhaAdaptacao[] }
  >();
  for (const linha of (adaptacoesRes.data ?? []) as LinhaAdaptacao[]) {
    const lote = lotesAdaptacao.get(linha.lote_id);
    if (lote) lote.variacoes.push(linha);
    else
      lotesAdaptacao.set(linha.lote_id, {
        lote_id: linha.lote_id,
        mensagem_central: linha.mensagem_central,
        created_at: linha.created_at,
        variacoes: [linha],
      });
  }
  const lotesArr = Array.from(lotesAdaptacao.values()).slice(0, 5);

  const avaliacoes = podeAvaliar
    ? (
        await supabase
          .from("avaliacoes_pecas")
          .select("id, formato, canal, avaliacao_json, created_at")
          .order("created_at", { ascending: false })
          .limit(10)
      ).data ?? []
    : [];

  return (
    <AppShell campanhaNome={campanha?.nome_candidato ?? undefined} papel={PAPEL_LABEL[eu.papel]}>
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-10 px-4 py-8">
        <div>
          <h1 className="text-lg font-semibold">Marketing</h1>
          <p className="text-sm text-neutral-500">
            Ferramentas de IA para sugestão e avaliação de peças eleitorais. A arte final e a
            publicação são sempre responsabilidade de um humano da equipe.
          </p>
        </div>

        {/* ── GERAÇÃO INTELIGENTE ──────────────────────────────────── */}
        {podeGerar && (
          <section className="space-y-3">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
                Geração inteligente de conteúdo
              </h2>
              <p className="text-xs text-neutral-400 mt-0.5">
                A IA cruza monitoramento, demandas, sinais de campo e propostas para encontrar
                a melhor oportunidade de comunicação do momento e gerar conteúdo em 4 formatos
                automaticamente (post, stories, WhatsApp, carrossel).
              </p>
            </div>
            <GeracaoInteligenteButton />
          </section>
        )}

        {/* ── GERADOR DE PEÇAS ─────────────────────────────────────── */}
        {podeGerar && (
          <section className="space-y-3">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
                Gerar sugestão de peça
              </h2>
              <p className="text-xs text-neutral-400 mt-0.5">
                A IA sugere texto, roteiro e estrutura — com identidade da campanha carregada
                automaticamente da base de conhecimento.
              </p>
            </div>
            <SugestaoForm />
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

        {/* ── GERAR IMAGEM DE FUNDO (Gemini nano-banana) ─────────────── */}
        {podeGerar && (
          <section className="space-y-3">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
                Gerar imagem por IA
              </h2>
              <p className="text-xs text-neutral-400 mt-0.5">
                Escreva o prompt exato da cena. A Gemini nano-banana gera uma imagem crua
                (sem texto legal) — a equipe monta a arte final e sobe em Peças de Conteúdo
                para revisão de compliance.
              </p>
            </div>
            <GerarImagemForm />
          </section>
        )}

        {/* ── CENTRAL DE COPYWRITING (adaptação multi-público) ────── */}
        {podeAdaptar && (
          <section className="space-y-3">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
                Adaptar mensagem para vários públicos
              </h2>
              <p className="text-xs text-neutral-400 mt-0.5">
                Escreva uma mensagem-mãe (proposta, resposta, posicionamento) e a IA gera
                variações adaptadas a cada público+canal — mantendo a essência da mensagem
                e a persona da campanha, sem inventar dados novos.
              </p>
            </div>
            <AdaptarForm />
          </section>
        )}

        {podeAdaptar && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
              Histórico de adaptações
            </h2>
            {lotesArr.length === 0 && (
              <p className="text-sm text-neutral-400">Nenhuma adaptação gerada ainda.</p>
            )}
            <ul className="space-y-2">
              {lotesArr.map((lote) => (
                <li key={lote.lote_id} className="rounded border border-neutral-200 p-3 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-medium text-neutral-500">
                      {lote.variacoes.length} variação(ões)
                    </span>
                    <span className="ml-auto text-xs text-neutral-400">
                      {new Date(lote.created_at).toLocaleString("pt-BR", {
                        day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo",
                      })}
                    </span>
                  </div>
                  <p className="line-clamp-2 text-sm text-neutral-700" title={lote.mensagem_central}>
                    <span className="font-medium">Mensagem: </span>
                    {lote.mensagem_central}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {lote.variacoes.map((v) => (
                      <span
                        key={v.id}
                        className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600"
                        title={`${v.publico_alvo} · ${v.canal}`}
                      >
                        {v.publico_alvo} · {v.canal}
                      </span>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* ── AVALIADOR DE PEÇAS ───────────────────────────────────── */}
        {podeAvaliar && (
          <section className="space-y-3">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
                Avaliar peça do marketing
              </h2>
              <p className="text-xs text-neutral-400 mt-0.5">
                Cole ou descreva uma peça que a equipe produziu. A IA avalia em 4 dimensões:
                legislação eleitoral, boas práticas de mídia, viralidade e clareza.
              </p>
            </div>
            <AvaliacaoForm />
          </section>
        )}

        {podeAvaliar && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
              Histórico de avaliações
            </h2>
            {avaliacoes.length === 0 && (
              <p className="text-sm text-neutral-400">Nenhuma peça avaliada ainda.</p>
            )}
            <ul className="space-y-2">
              {avaliacoes.map((a) => {
                const av = a.avaliacao_json as unknown as AvaliacaoJson;
                const decisao = av.sintese?.decisao ? DECISAO_LABEL[av.sintese.decisao] : null;
                return (
                  <li key={a.id} className="rounded border border-neutral-200 p-3 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium">
                        {FORMATO_LABEL[a.formato] ?? a.formato}
                      </span>
                      <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium">
                        {a.canal}
                      </span>
                      {av.score_geral != null && (
                        <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                          av.score_geral >= 80 ? "bg-green-100 text-green-800" :
                          av.score_geral >= 60 ? "bg-yellow-100 text-yellow-800" :
                          av.score_geral >= 40 ? "bg-orange-100 text-orange-800" :
                          "bg-red-100 text-red-800"
                        }`}>
                          {av.score_geral}/100
                        </span>
                      )}
                      {decisao && (
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${decisao.cls}`}>
                          {decisao.label}
                        </span>
                      )}
                      <span className="ml-auto text-xs text-neutral-400">
                        {new Date(a.created_at).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                      </span>
                    </div>
                    {av.sintese?.recomendacoes?.[0] && (
                      <p className="text-xs text-neutral-500 line-clamp-2">
                        {av.sintese.recomendacoes[0]}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* ── ANÁLISE DE MARKETING DOS CONCORRENTES ─────────────── */}
        {podeGerar && (
          <section className="space-y-3">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
                Análise de marketing dos concorrentes
              </h2>
              <p className="text-xs text-neutral-400 mt-0.5">
                A IA analisa posicionamento, vulnerabilidades e oportunidades de comunicação
                com base nos concorrentes cadastrados.
              </p>
            </div>
            <AnaliseButton tipo="marketing_concorrentes" label="Analisar marketing dos concorrentes" />
          </section>
        )}

        {/* ── ANÁLISE DE PONTOS CEGOS ──────────────────────────────── */}
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

        {/* ── FAQs ─────────────────────────────────────────────────── */}
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
    </AppShell>
  );
}
