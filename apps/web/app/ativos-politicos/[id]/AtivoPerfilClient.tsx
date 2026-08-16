"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, MapPin, Phone, Mail, Pencil, Save, X, Calendar, Flag, ClipboardList, Eye, MessageSquare } from "lucide-react";

type Categoria = { id: string; nome: string; grupo: string };

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

const GRUPOS_LABEL: Record<string, string> = {
  liderancas: "Lideranças",
  executivo: "Poder Executivo",
  legislativo: "Poder Legislativo",
  partidario: "Estrutura Partidária",
  sociedade: "Sociedade Organizada",
  outros: "Outros",
};

type Ativo = Record<string, unknown>;
type Relacionamento = {
  id: string;
  ativo_origem_id: string;
  ativo_destino_id: string;
  observacoes: string | null;
  tipos_relacionamento_ativo: { nome: string } | { nome: string }[] | null;
  origem: { id: string; nome: string; cargo_atual: string | null } | { id: string; nome: string; cargo_atual: string | null }[] | null;
  destino: { id: string; nome: string; cargo_atual: string | null } | { id: string; nome: string; cargo_atual: string | null }[] | null;
};
type Historico = {
  id: string;
  tipo: string;
  titulo: string;
  descricao: string | null;
  data_ocorrencia: string;
};

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex justify-between">
      <span className="text-neutral-500">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

export function AtivoPerfilClient({
  ativo,
  categorias,
  relacionamentos,
  historico,
  podeEditar,
}: {
  ativo: Ativo;
  categorias: Categoria[];
  relacionamentos: Relacionamento[];
  historico: Historico[];
  podeEditar: boolean;
}) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const cat = (Array.isArray(ativo.categorias_ativo_politico) ? ativo.categorias_ativo_politico[0] : ativo.categorias_ativo_politico) as { nome: string; grupo: string; cor: string | null } | null;
  const terr = (Array.isArray(ativo.territorios) ? ativo.territorios[0] : ativo.territorios) as { nome_bairro: string | null; cidade: string | null } | null;

  const categoriasAgrupadas = categorias.reduce<Record<string, Categoria[]>>((acc, c) => {
    (acc[c.grupo] ??= []).push(c);
    return acc;
  }, {});

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSalvando(true);
    setErro(null);

    const fd = new FormData(e.currentTarget);
    const body = {
      nome: fd.get("nome"),
      nome_social: fd.get("nome_social") || null,
      telefone: fd.get("telefone") || null,
      whatsapp: fd.get("whatsapp") || null,
      email: fd.get("email") || null,
      cidade: fd.get("cidade") || null,
      estado: fd.get("estado") || null,
      bairro: fd.get("bairro") || null,
      categoria_id: fd.get("categoria_id"),
      cargo_atual: fd.get("cargo_atual") || null,
      cargo_anterior: fd.get("cargo_anterior") || null,
      partido: fd.get("partido") || null,
      entidade: fd.get("entidade") || null,
      setor: fd.get("setor") || null,
      nivel_influencia: fd.get("nivel_influencia"),
      abrangencia: fd.get("abrangencia"),
      relevancia_estrategica: fd.get("relevancia_estrategica") ? Number(fd.get("relevancia_estrategica")) : null,
      capacidade_mobilizacao: fd.get("capacidade_mobilizacao") ? Number(fd.get("capacidade_mobilizacao")) : null,
      pessoas_alcancadas_est: fd.get("pessoas_alcancadas_est") ? Number(fd.get("pessoas_alcancadas_est")) : null,
      status_campanha: fd.get("status_campanha"),
      observacoes: fd.get("observacoes") || null,
    };

    const res = await fetch(`/api/ativos-politicos/${ativo.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErro(data.error ?? "Erro ao salvar.");
      setSalvando(false);
      return;
    }

    setSalvando(false);
    setEditando(false);
    router.refresh();
  }

  const inputCls = "w-full rounded border px-2 py-1 text-sm";

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 space-y-6 px-4 py-8">
      <Link href="/ativos-politicos/lista" className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-700">
        <ArrowLeft size={14} /> Voltar à lista
      </Link>

      {erro && <p className="rounded bg-rose-50 px-3 py-2 text-sm text-rose-700">{erro}</p>}

      {editando ? (
        <form onSubmit={handleSave} className="space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold">Editando ativo</h1>
            <div className="flex gap-2">
              <button type="button" onClick={() => setEditando(false)} className="inline-flex items-center gap-1 rounded border px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-50">
                <X size={14} /> Cancelar
              </button>
              <button type="submit" disabled={salvando} className="inline-flex items-center gap-1 rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50">
                <Save size={14} /> {salvando ? "Salvando…" : "Salvar"}
              </button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="space-y-1">
              <span className="text-xs font-medium text-neutral-500">Nome *</span>
              <input name="nome" required defaultValue={ativo.nome as string} className={inputCls} />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-neutral-500">Apelido / Nome social</span>
              <input name="nome_social" defaultValue={(ativo.nome_social as string) ?? ""} className={inputCls} />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-neutral-500">Categoria *</span>
              <select name="categoria_id" required defaultValue={ativo.categoria_id as string} className={inputCls}>
                {Object.entries(categoriasAgrupadas).map(([grupo, cats]) => (
                  <optgroup key={grupo} label={GRUPOS_LABEL[grupo] ?? grupo}>
                    {cats.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </optgroup>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-neutral-500">Cargo atual</span>
              <input name="cargo_atual" defaultValue={(ativo.cargo_atual as string) ?? ""} className={inputCls} />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-neutral-500">Cargo anterior</span>
              <input name="cargo_anterior" defaultValue={(ativo.cargo_anterior as string) ?? ""} className={inputCls} />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-neutral-500">Partido</span>
              <input name="partido" defaultValue={(ativo.partido as string) ?? ""} className={inputCls} />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-neutral-500">Entidade</span>
              <input name="entidade" defaultValue={(ativo.entidade as string) ?? ""} className={inputCls} />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-neutral-500">Setor</span>
              <input name="setor" defaultValue={(ativo.setor as string) ?? ""} className={inputCls} />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-neutral-500">Telefone</span>
              <input name="telefone" defaultValue={(ativo.telefone as string) ?? ""} className={inputCls} />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-neutral-500">WhatsApp</span>
              <input name="whatsapp" defaultValue={(ativo.whatsapp as string) ?? ""} className={inputCls} />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-neutral-500">E-mail</span>
              <input name="email" type="email" defaultValue={(ativo.email as string) ?? ""} className={inputCls} />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-neutral-500">Cidade</span>
              <input name="cidade" defaultValue={(ativo.cidade as string) ?? ""} className={inputCls} />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-neutral-500">Estado</span>
              <input name="estado" maxLength={2} defaultValue={(ativo.estado as string) ?? ""} className={inputCls} />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-neutral-500">Bairro</span>
              <input name="bairro" defaultValue={(ativo.bairro as string) ?? ""} className={inputCls} />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-neutral-500">Nível de influência</span>
              <select name="nivel_influencia" defaultValue={ativo.nivel_influencia as string} className={inputCls}>
                <option value="nao_avaliado">Não avaliado</option>
                <option value="baixo">Baixo</option>
                <option value="medio">Médio</option>
                <option value="alto">Alto</option>
                <option value="muito_alto">Muito alto</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-neutral-500">Abrangência</span>
              <select name="abrangencia" defaultValue={ativo.abrangencia as string} className={inputCls}>
                <option value="local">Local</option>
                <option value="municipal">Municipal</option>
                <option value="regional">Regional</option>
                <option value="estadual">Estadual</option>
                <option value="nacional">Nacional</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-neutral-500">Status com a campanha</span>
              <select name="status_campanha" defaultValue={ativo.status_campanha as string} className={inputCls}>
                <option value="identificado">Identificado</option>
                <option value="nao_relacionado">Não relacionado</option>
                <option value="contato_realizado">Contato realizado</option>
                <option value="relacionamento_ativo">Relacionamento ativo</option>
                <option value="parceiro">Parceiro</option>
                <option value="em_avaliacao">Em avaliação</option>
                <option value="inativo">Inativo</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-neutral-500">Relevância estratégica (1-5)</span>
              <input name="relevancia_estrategica" type="number" min={1} max={5} defaultValue={(ativo.relevancia_estrategica as number) ?? ""} className={inputCls} />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-neutral-500">Capacidade de mobilização (1-5)</span>
              <input name="capacidade_mobilizacao" type="number" min={1} max={5} defaultValue={(ativo.capacidade_mobilizacao as number) ?? ""} className={inputCls} />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-neutral-500">Pessoas alcançadas (est.)</span>
              <input name="pessoas_alcancadas_est" type="number" min={0} defaultValue={(ativo.pessoas_alcancadas_est as number) ?? ""} className={inputCls} />
            </label>
          </div>

          <label className="block space-y-1">
            <span className="text-xs font-medium text-neutral-500">Observações</span>
            <textarea name="observacoes" rows={3} defaultValue={(ativo.observacoes as string) ?? ""} className={inputCls} />
          </label>
        </form>
      ) : (
        <>
          {/* Cabeçalho */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-semibold">{ativo.nome as string}</h1>
              {!!ativo.nome_social && <p className="text-sm text-neutral-500">{ativo.nome_social as string}</p>}
              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-neutral-600">
                {cat && <span className="rounded bg-neutral-100 px-2 py-0.5 text-xs font-medium">{cat.nome}</span>}
                {!!ativo.cargo_atual && <span>{ativo.cargo_atual as string}</span>}
                {!!ativo.partido && <span>· {ativo.partido as string}</span>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_CORES[ativo.status_campanha as string] ?? "bg-neutral-200"}`}>
                {STATUS_LABELS[ativo.status_campanha as string] ?? (ativo.status_campanha as string)}
              </span>
              {podeEditar && (
                <button onClick={() => setEditando(true)} className="inline-flex items-center gap-1 rounded border px-2.5 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-50">
                  <Pencil size={12} /> Editar
                </button>
              )}
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <section className="rounded-lg border border-neutral-200 p-4 space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Informações</h2>
              <dl className="space-y-2 text-sm">
                {!!ativo.cidade && (
                  <div className="flex items-center gap-2">
                    <MapPin size={14} className="text-neutral-400" />
                    <span>{ativo.cidade as string}{ativo.estado ? `/${ativo.estado}` : ""}{ativo.bairro ? ` — ${ativo.bairro}` : ""}</span>
                  </div>
                )}
                {!!ativo.telefone && (
                  <div className="flex items-center gap-2">
                    <Phone size={14} className="text-neutral-400" />
                    <span>{ativo.telefone as string}</span>
                  </div>
                )}
                {!!ativo.whatsapp && ativo.whatsapp !== ativo.telefone && (
                  <div className="flex items-center gap-2">
                    <Phone size={14} className="text-neutral-400" />
                    <span>WhatsApp: {ativo.whatsapp as string}</span>
                  </div>
                )}
                {!!ativo.email && (
                  <div className="flex items-center gap-2">
                    <Mail size={14} className="text-neutral-400" />
                    <span>{ativo.email as string}</span>
                  </div>
                )}
                {!!ativo.entidade && <div><span className="text-neutral-400">Entidade:</span> {ativo.entidade as string}</div>}
                {!!ativo.setor && <div><span className="text-neutral-400">Setor:</span> {ativo.setor as string}</div>}
                {!!ativo.cargo_anterior && <div><span className="text-neutral-400">Cargo anterior:</span> {ativo.cargo_anterior as string}</div>}
                {terr && <div><span className="text-neutral-400">Território:</span> {terr.nome_bairro ?? "—"}{terr.cidade ? ` — ${terr.cidade}` : ""}</div>}
                {!!ativo.geolocalizacao && <div className="text-xs text-emerald-600">Geolocalizado</div>}
              </dl>
            </section>

            <section className="rounded-lg border border-neutral-200 p-4 space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Influência</h2>
              <dl className="space-y-2 text-sm">
                <Field label="Nível de influência" value={NIVEL_LABELS[ativo.nivel_influencia as string] ?? (ativo.nivel_influencia as string)} />
                <Field label="Abrangência" value={ABRANGENCIA_LABELS[ativo.abrangencia as string] ?? (ativo.abrangencia as string)} />
                {(ativo.relevancia_estrategica as number) > 0 && <Field label="Relevância estratégica" value={`${ativo.relevancia_estrategica}/5`} />}
                {(ativo.capacidade_mobilizacao as number) > 0 && <Field label="Capacidade de mobilização" value={`${ativo.capacidade_mobilizacao}/5`} />}
                {(ativo.pessoas_alcancadas_est as number) > 0 && <Field label="Pessoas alcançadas (est.)" value={(ativo.pessoas_alcancadas_est as number).toLocaleString("pt-BR")} />}
              </dl>
            </section>
          </div>

          {!!ativo.observacoes && (
            <section className="rounded-lg border border-neutral-200 p-4 space-y-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Observações</h2>
              <p className="text-sm whitespace-pre-wrap">{ativo.observacoes as string}</p>
            </section>
          )}
        </>
      )}

      {/* Ações rápidas — integração com outros módulos */}
      <section className="rounded-lg border border-neutral-200 p-4 space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Ações rápidas</h2>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/agenda?participante=${encodeURIComponent(ativo.nome as string)}`}
            className="inline-flex items-center gap-1.5 rounded border px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50"
          >
            <Calendar size={13} /> Agendar encontro
          </Link>
          <Link
            href={`/campo?ativo=${encodeURIComponent(ativo.nome as string)}`}
            className="inline-flex items-center gap-1.5 rounded border px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50"
          >
            <Flag size={13} /> Registrar ação de campo
          </Link>
          <Link
            href={`/tarefas?responsavel=${encodeURIComponent(ativo.nome as string)}`}
            className="inline-flex items-center gap-1.5 rounded border px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50"
          >
            <ClipboardList size={13} /> Criar tarefa
          </Link>
          <Link
            href={`/monitoramento?busca=${encodeURIComponent(ativo.nome as string)}`}
            className="inline-flex items-center gap-1.5 rounded border px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50"
          >
            <Eye size={13} /> Monitorar menções
          </Link>
          {!!ativo.whatsapp && (
            <a
              href={`https://wa.me/55${(ativo.whatsapp as string).replace(/\D/g, "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded border border-emerald-300 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50"
            >
              <MessageSquare size={13} /> WhatsApp
            </a>
          )}
        </div>
      </section>

      {/* Relacionamentos */}
      <section className="rounded-lg border border-neutral-200 p-4 space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Relacionamentos ({relacionamentos.length})
        </h2>
        {relacionamentos.length === 0 ? (
          <p className="text-sm text-neutral-400">Nenhum relacionamento registrado.</p>
        ) : (
          <ul className="space-y-2">
            {relacionamentos.map((r) => {
              const tipo = (Array.isArray(r.tipos_relacionamento_ativo) ? r.tipos_relacionamento_ativo[0] : r.tipos_relacionamento_ativo) as { nome: string } | null;
              const isOrigem = r.ativo_origem_id === (ativo.id as string);
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
          Histórico ({historico.length})
        </h2>
        {historico.length === 0 ? (
          <p className="text-sm text-neutral-400">Nenhuma interação registrada.</p>
        ) : (
          <ul className="space-y-2">
            {historico.map((h) => (
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
  );
}
