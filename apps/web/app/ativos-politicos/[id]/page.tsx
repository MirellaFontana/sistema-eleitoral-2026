import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, MapPin, Phone, Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import { proximaRotaMfa } from "@/lib/mfa";

const PAPEL_LABEL: Record<string, string> = {
  coord_campanha: "Coord. de campanha",
  candidato: "Candidato",
  coord_marketing: "Coord. de marketing",
  redator_marketing: "Redator de marketing",
  advogado_responsavel: "Advogado responsável",
  assistente_juridico: "Assistente jurídico",
  embaixador: "Liderança de campo (legado)",
  apoio_marketing: "Apoio de marketing",
  apoio_campanha: "Apoio de campanha",
  apoio_coordenacao: "Apoio de coordenação",
};

const NIVEL_LABELS: Record<string, string> = {
  muito_alto: "Muito alto",
  alto: "Alto",
  medio: "Médio",
  baixo: "Baixo",
  nao_avaliado: "Não avaliado",
};

const STATUS_LABELS: Record<string, string> = {
  nao_relacionado: "Não relacionado",
  identificado: "Identificado",
  contato_realizado: "Contato realizado",
  relacionamento_ativo: "Relacionamento ativo",
  parceiro: "Parceiro",
  em_avaliacao: "Em avaliação",
  inativo: "Inativo",
};

const STATUS_CORES: Record<string, string> = {
  nao_relacionado: "bg-neutral-200",
  identificado: "bg-sky-200",
  contato_realizado: "bg-amber-200",
  relacionamento_ativo: "bg-emerald-200",
  parceiro: "bg-indigo-200",
  em_avaliacao: "bg-orange-200",
  inativo: "bg-neutral-300",
};

const ABRANGENCIA_LABELS: Record<string, string> = {
  local: "Local",
  municipal: "Municipal",
  regional: "Regional",
  estadual: "Estadual",
  nacional: "Nacional",
};

export default async function AtivoPerfilPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
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

  const [{ data: ativo }, { data: relacionamentos }, { data: historico }] = await Promise.all([
    supabase
      .from("ativos_politicos")
      .select("*, categorias_ativo_politico(nome, grupo, cor), territorios(nome_bairro, cidade)")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("relacionamentos_ativos")
      .select("id, ativo_origem_id, ativo_destino_id, observacoes, created_at, tipos_relacionamento_ativo(nome), origem:ativos_politicos!ativo_origem_id(id, nome, cargo_atual), destino:ativos_politicos!ativo_destino_id(id, nome, cargo_atual)")
      .or(`ativo_origem_id.eq.${id},ativo_destino_id.eq.${id}`)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("historico_ativos")
      .select("id, tipo, titulo, descricao, data_ocorrencia, created_at")
      .eq("ativo_id", id)
      .order("data_ocorrencia", { ascending: false })
      .limit(30),
  ]);

  if (!ativo) notFound();

  const cat = (Array.isArray(ativo.categorias_ativo_politico) ? ativo.categorias_ativo_politico[0] : ativo.categorias_ativo_politico) as { nome: string; grupo: string; cor: string | null } | null;
  const terr = (Array.isArray(ativo.territorios) ? ativo.territorios[0] : ativo.territorios) as { nome_bairro: string | null; cidade: string | null } | null;

  return (
    <AppShell campanhaNome={campanha?.nome_candidato ?? undefined} papel={PAPEL_LABEL[eu.papel]}>
      <main className="mx-auto w-full max-w-4xl flex-1 space-y-6 px-4 py-8">
        <Link href="/ativos-politicos/lista" className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-700">
          <ArrowLeft size={14} /> Voltar à lista
        </Link>

        {/* Cabeçalho */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">{ativo.nome}</h1>
            {ativo.nome_social && <p className="text-sm text-neutral-500">{ativo.nome_social}</p>}
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-neutral-600">
              {cat && <span className="rounded bg-neutral-100 px-2 py-0.5 text-xs font-medium">{cat.nome}</span>}
              {ativo.cargo_atual && <span>{ativo.cargo_atual}</span>}
              {ativo.partido && <span>· {ativo.partido}</span>}
            </div>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_CORES[ativo.status_campanha] ?? "bg-neutral-200"}`}>
            {STATUS_LABELS[ativo.status_campanha] ?? ativo.status_campanha}
          </span>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Informações */}
          <section className="rounded-lg border border-neutral-200 p-4 space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Informações</h2>
            <dl className="space-y-2 text-sm">
              {ativo.cidade && (
                <div className="flex items-center gap-2">
                  <MapPin size={14} className="text-neutral-400" />
                  <span>{ativo.cidade}{ativo.estado ? `/${ativo.estado}` : ""}{ativo.bairro ? ` — ${ativo.bairro}` : ""}</span>
                </div>
              )}
              {ativo.telefone && (
                <div className="flex items-center gap-2">
                  <Phone size={14} className="text-neutral-400" />
                  <span>{ativo.telefone}</span>
                </div>
              )}
              {ativo.whatsapp && ativo.whatsapp !== ativo.telefone && (
                <div className="flex items-center gap-2">
                  <Phone size={14} className="text-neutral-400" />
                  <span>WhatsApp: {ativo.whatsapp}</span>
                </div>
              )}
              {ativo.email && (
                <div className="flex items-center gap-2">
                  <Mail size={14} className="text-neutral-400" />
                  <span>{ativo.email}</span>
                </div>
              )}
              {ativo.entidade && <div><span className="text-neutral-400">Entidade:</span> {ativo.entidade}</div>}
              {ativo.setor && <div><span className="text-neutral-400">Setor:</span> {ativo.setor}</div>}
              {ativo.cargo_anterior && <div><span className="text-neutral-400">Cargo anterior:</span> {ativo.cargo_anterior}</div>}
              {terr && <div><span className="text-neutral-400">Território:</span> {terr.nome_bairro ?? "—"}{terr.cidade ? ` — ${terr.cidade}` : ""}</div>}
              {ativo.geolocalizacao && <div className="text-xs text-emerald-600">Geolocalizado</div>}
            </dl>
          </section>

          {/* Influência */}
          <section className="rounded-lg border border-neutral-200 p-4 space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Influência</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-neutral-500">Nível de influência</span>
                <span className="font-medium">{NIVEL_LABELS[ativo.nivel_influencia] ?? ativo.nivel_influencia}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Abrangência</span>
                <span className="font-medium">{ABRANGENCIA_LABELS[ativo.abrangencia] ?? ativo.abrangencia}</span>
              </div>
              {ativo.relevancia_estrategica && (
                <div className="flex justify-between">
                  <span className="text-neutral-500">Relevância estratégica</span>
                  <span className="font-medium">{ativo.relevancia_estrategica}/5</span>
                </div>
              )}
              {ativo.capacidade_mobilizacao && (
                <div className="flex justify-between">
                  <span className="text-neutral-500">Capacidade de mobilização</span>
                  <span className="font-medium">{ativo.capacidade_mobilizacao}/5</span>
                </div>
              )}
              {ativo.pessoas_alcancadas_est != null && ativo.pessoas_alcancadas_est > 0 && (
                <div className="flex justify-between">
                  <span className="text-neutral-500">Pessoas alcançadas (est.)</span>
                  <span className="font-medium">{ativo.pessoas_alcancadas_est.toLocaleString("pt-BR")}</span>
                </div>
              )}
            </dl>
          </section>
        </div>

        {/* Observações */}
        {ativo.observacoes && (
          <section className="rounded-lg border border-neutral-200 p-4 space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Observações</h2>
            <p className="text-sm whitespace-pre-wrap">{ativo.observacoes}</p>
          </section>
        )}

        {/* Relacionamentos */}
        <section className="rounded-lg border border-neutral-200 p-4 space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Relacionamentos ({(relacionamentos ?? []).length})
          </h2>
          {(relacionamentos ?? []).length === 0 ? (
            <p className="text-sm text-neutral-400">Nenhum relacionamento registrado.</p>
          ) : (
            <ul className="space-y-2">
              {(relacionamentos ?? []).map((r) => {
                const tipo = (Array.isArray(r.tipos_relacionamento_ativo) ? r.tipos_relacionamento_ativo[0] : r.tipos_relacionamento_ativo) as { nome: string } | null;
                const isOrigem = r.ativo_origem_id === id;
                const outro = (isOrigem
                  ? (Array.isArray(r.destino) ? r.destino[0] : r.destino)
                  : (Array.isArray(r.origem) ? r.origem[0] : r.origem)) as { id: string; nome: string; cargo_atual: string | null } | null;
                return (
                  <li key={r.id} className="flex items-center gap-2 text-sm">
                    <span className="text-neutral-400">{tipo?.nome ?? "Relação"}</span>
                    <span className="text-neutral-400">&rarr;</span>
                    {outro ? (
                      <Link href={`/ativos-politicos/${outro.id}`} className="font-medium text-indigo-600 hover:underline">
                        {outro.nome}
                        {outro.cargo_atual && <span className="ml-1 text-xs text-neutral-400">({outro.cargo_atual})</span>}
                      </Link>
                    ) : (
                      <span className="text-neutral-400">Desconhecido</span>
                    )}
                    {r.observacoes && <span className="text-xs text-neutral-400">— {r.observacoes}</span>}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Histórico */}
        <section className="rounded-lg border border-neutral-200 p-4 space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Histórico ({(historico ?? []).length})
          </h2>
          {(historico ?? []).length === 0 ? (
            <p className="text-sm text-neutral-400">Nenhuma interação registrada.</p>
          ) : (
            <ul className="space-y-2">
              {(historico ?? []).map((h) => (
                <li key={h.id} className="border-l-2 border-neutral-200 pl-3 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs font-medium uppercase">{h.tipo}</span>
                    <span className="font-medium">{h.titulo}</span>
                  </div>
                  {h.descricao && <p className="mt-0.5 text-neutral-500">{h.descricao}</p>}
                  <p className="mt-0.5 text-xs text-neutral-400">
                    {new Date(h.data_ocorrencia).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </AppShell>
  );
}
