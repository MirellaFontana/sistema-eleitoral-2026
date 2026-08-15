"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Search, X } from "lucide-react";

type Categoria = { id: string; nome: string; grupo: string };
type Territorio = { id: string; nome_bairro: string | null; cidade: string | null };
type Ativo = {
  id: string;
  nome: string;
  nome_social: string | null;
  cidade: string | null;
  estado: string | null;
  partido: string | null;
  cargo_atual: string | null;
  nivel_influencia: string;
  status_campanha: string;
  telefone: string | null;
  whatsapp: string | null;
  email: string | null;
  geolocalizacao: unknown;
  created_at: string;
  categoria_id: string;
  categorias_ativo_politico: { nome: string; grupo: string } | { nome: string; grupo: string }[] | null;
};

const STATUS_LABELS: Record<string, string> = {
  nao_relacionado: "Não relacionado",
  identificado: "Identificado",
  contato_realizado: "Contato realizado",
  relacionamento_ativo: "Rel. ativo",
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

const NIVEL_LABELS: Record<string, string> = {
  muito_alto: "Muito alto",
  alto: "Alto",
  medio: "Médio",
  baixo: "Baixo",
  nao_avaliado: "Não avaliado",
};

const GRUPOS_LABEL: Record<string, string> = {
  liderancas: "Lideranças",
  executivo: "Poder Executivo",
  legislativo: "Poder Legislativo",
  partidario: "Estrutura Partidária",
  sociedade: "Sociedade Organizada",
  outros: "Outros",
};

export function AtivosListaClient({
  ativosIniciais,
  totalInicial,
  categorias,
  territorios,
  podeGerenciar,
  campanhaId,
}: {
  ativosIniciais: Ativo[];
  totalInicial: number;
  categorias: Categoria[];
  territorios: Territorio[];
  podeGerenciar: boolean;
  campanhaId: string;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [ativos, setAtivos] = useState(ativosIniciais);
  const [total, setTotal] = useState(totalInicial);
  const [pagina, setPagina] = useState(1);
  const [carregando, setCarregando] = useState(false);
  const [busca, setBusca] = useState("");
  const [buscaApi, setBuscaApi] = useState("");
  const [mostrarForm, setMostrarForm] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const porPagina = 50;
  const totalPaginas = Math.max(1, Math.ceil(total / porPagina));

  const categoriasAgrupadas = categorias.reduce<Record<string, Categoria[]>>((acc, c) => {
    (acc[c.grupo] ??= []).push(c);
    return acc;
  }, {});

  async function carregarPagina(pag: number, buscarTexto?: string) {
    setCarregando(true);
    const params = new URLSearchParams({ pagina: String(pag) });
    const q = buscarTexto ?? buscaApi;
    if (q) params.set("busca", q);
    const res = await fetch(`/api/ativos-politicos?${params}`);
    if (res.ok) {
      const data = await res.json();
      setAtivos(data.ativos);
      setTotal(data.total);
      setPagina(pag);
    }
    setCarregando(false);
  }

  function handleBusca(valor: string) {
    setBusca(valor);
    if (valor.trim().length >= 2) {
      setBuscaApi(valor.trim());
      carregarPagina(1, valor.trim());
    } else if (valor.trim().length === 0 && buscaApi) {
      setBuscaApi("");
      carregarPagina(1, "");
    }
  }

  const filtrados = ativos;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSalvando(true);
    setErro(null);

    const fd = new FormData(e.currentTarget);
    const body = {
      nome: fd.get("nome"),
      nome_social: fd.get("nome_social"),
      telefone: fd.get("telefone"),
      whatsapp: fd.get("whatsapp"),
      email: fd.get("email"),
      cidade: fd.get("cidade"),
      estado: fd.get("estado"),
      bairro: fd.get("bairro"),
      categoria_id: fd.get("categoria_id"),
      cargo_atual: fd.get("cargo_atual"),
      partido: fd.get("partido"),
      entidade: fd.get("entidade"),
      territorio_id: fd.get("territorio_id") || null,
      nivel_influencia: fd.get("nivel_influencia") || "nao_avaliado",
      status_campanha: fd.get("status_campanha") || "identificado",
      observacoes: fd.get("observacoes"),
    };

    const res = await fetch("/api/ativos-politicos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErro(data.error ?? "Erro ao cadastrar.");
      setSalvando(false);
      return;
    }

    setSalvando(false);
    setMostrarForm(false);
    carregarPagina(1);
  }

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 py-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold">Lista de Ativos</h1>
          <p className="text-sm text-neutral-500">
            {totalInicial.toLocaleString("pt-BR")} ativos cadastrados
          </p>
        </div>
        {podeGerenciar && (
          <button
            onClick={() => setMostrarForm(!mostrarForm)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800"
          >
            {mostrarForm ? <X size={14} /> : <Plus size={14} />}
            {mostrarForm ? "Cancelar" : "Novo ativo"}
          </button>
        )}
      </div>

      {/* Formulário de cadastro */}
      {mostrarForm && podeGerenciar && (
        <form onSubmit={handleSubmit} className="rounded-lg border border-neutral-200 p-4 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Cadastrar ativo político</h2>

          {erro && <p className="rounded bg-rose-50 px-3 py-2 text-sm text-rose-700">{erro}</p>}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="space-y-1">
              <span className="text-xs font-medium text-neutral-500">Nome *</span>
              <input name="nome" required className="w-full rounded border px-2.5 py-1.5 text-sm" />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-neutral-500">Apelido / Nome social</span>
              <input name="nome_social" className="w-full rounded border px-2.5 py-1.5 text-sm" />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-neutral-500">Categoria *</span>
              <select name="categoria_id" required className="w-full rounded border px-2.5 py-1.5 text-sm">
                <option value="">Selecione</option>
                {Object.entries(categoriasAgrupadas).map(([grupo, cats]) => (
                  <optgroup key={grupo} label={GRUPOS_LABEL[grupo] ?? grupo}>
                    {cats.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </optgroup>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-neutral-500">Cargo atual</span>
              <input name="cargo_atual" className="w-full rounded border px-2.5 py-1.5 text-sm" />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-neutral-500">Partido</span>
              <input name="partido" className="w-full rounded border px-2.5 py-1.5 text-sm" />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-neutral-500">Entidade</span>
              <input name="entidade" className="w-full rounded border px-2.5 py-1.5 text-sm" />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-neutral-500">Telefone</span>
              <input name="telefone" className="w-full rounded border px-2.5 py-1.5 text-sm" />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-neutral-500">WhatsApp</span>
              <input name="whatsapp" className="w-full rounded border px-2.5 py-1.5 text-sm" />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-neutral-500">E-mail</span>
              <input name="email" type="email" className="w-full rounded border px-2.5 py-1.5 text-sm" />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-neutral-500">Cidade</span>
              <input name="cidade" className="w-full rounded border px-2.5 py-1.5 text-sm" />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-neutral-500">Estado</span>
              <input name="estado" maxLength={2} className="w-full rounded border px-2.5 py-1.5 text-sm" />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-neutral-500">Bairro</span>
              <input name="bairro" className="w-full rounded border px-2.5 py-1.5 text-sm" />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-neutral-500">Território</span>
              <select name="territorio_id" className="w-full rounded border px-2.5 py-1.5 text-sm">
                <option value="">Nenhum</option>
                {territorios.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nome_bairro ?? "Sem nome"}{t.cidade ? ` — ${t.cidade}` : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-neutral-500">Nível de influência</span>
              <select name="nivel_influencia" className="w-full rounded border px-2.5 py-1.5 text-sm">
                <option value="nao_avaliado">Não avaliado</option>
                <option value="baixo">Baixo</option>
                <option value="medio">Médio</option>
                <option value="alto">Alto</option>
                <option value="muito_alto">Muito alto</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-neutral-500">Status com a campanha</span>
              <select name="status_campanha" className="w-full rounded border px-2.5 py-1.5 text-sm">
                <option value="identificado">Identificado</option>
                <option value="nao_relacionado">Não relacionado</option>
                <option value="contato_realizado">Contato realizado</option>
                <option value="relacionamento_ativo">Relacionamento ativo</option>
                <option value="parceiro">Parceiro</option>
                <option value="em_avaliacao">Em avaliação</option>
                <option value="inativo">Inativo</option>
              </select>
            </label>
          </div>

          <label className="block space-y-1">
            <span className="text-xs font-medium text-neutral-500">Observações</span>
            <textarea name="observacoes" rows={2} className="w-full rounded border px-2.5 py-1.5 text-sm" />
          </label>

          <button
            type="submit"
            disabled={salvando}
            className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
          >
            {salvando ? "Salvando…" : "Cadastrar"}
          </button>
        </form>
      )}

      {/* Busca */}
      <div className="relative max-w-sm">
        <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
        <input
          type="search"
          value={busca}
          onChange={(e) => handleBusca(e.target.value)}
          placeholder="Buscar por nome, cargo, cidade…"
          className="w-full rounded border px-2.5 py-1.5 pl-8 text-sm"
        />
      </div>

      {/* Tabela */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs font-medium uppercase tracking-wide text-neutral-400">
              <th className="pb-2 pr-3">Nome</th>
              <th className="pb-2 pr-3">Categoria</th>
              <th className="pb-2 pr-3">Cargo</th>
              <th className="pb-2 pr-3">Cidade</th>
              <th className="pb-2 pr-3">Partido</th>
              <th className="pb-2 pr-3">Influência</th>
              <th className="pb-2 pr-3">Status</th>
              <th className="pb-2 pr-3">Geo</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.length === 0 && (
              <tr>
                <td colSpan={8} className="py-8 text-center text-neutral-400">
                  {busca ? "Nenhum resultado." : "Nenhum ativo cadastrado."}
                </td>
              </tr>
            )}
            {filtrados.map((a) => {
              const cat = (Array.isArray(a.categorias_ativo_politico) ? a.categorias_ativo_politico[0] : a.categorias_ativo_politico) as { nome: string } | null;
              return (
                <tr key={a.id} className="border-b border-neutral-100 hover:bg-neutral-50">
                  <td className="py-2 pr-3">
                    <Link href={`/ativos-politicos/${a.id}`} className="font-medium text-indigo-600 hover:underline">
                      {a.nome}
                    </Link>
                    {a.nome_social && <span className="ml-1 text-xs text-neutral-400">({a.nome_social})</span>}
                  </td>
                  <td className="py-2 pr-3 text-neutral-600">{cat?.nome ?? "—"}</td>
                  <td className="py-2 pr-3 text-neutral-600">{a.cargo_atual ?? "—"}</td>
                  <td className="py-2 pr-3 text-neutral-600">{a.cidade ?? "—"}{a.estado ? `/${a.estado}` : ""}</td>
                  <td className="py-2 pr-3 text-neutral-600">{a.partido ?? "—"}</td>
                  <td className="py-2 pr-3 text-neutral-600">{NIVEL_LABELS[a.nivel_influencia] ?? a.nivel_influencia}</td>
                  <td className="py-2 pr-3">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CORES[a.status_campanha] ?? "bg-neutral-200"}`}>
                      {STATUS_LABELS[a.status_campanha] ?? a.status_campanha}
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-center">
                    {a.geolocalizacao ? <span className="text-emerald-500" title="Geolocalizado">&#9679;</span> : <span className="text-neutral-300">&#9675;</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {total > porPagina && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-neutral-400">
            Página {pagina} de {totalPaginas} · {total.toLocaleString("pt-BR")} ativos
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => carregarPagina(pagina - 1)}
              disabled={pagina <= 1 || carregando}
              className="rounded border px-3 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-50 disabled:opacity-30"
            >
              Anterior
            </button>
            <button
              onClick={() => carregarPagina(pagina + 1)}
              disabled={pagina >= totalPaginas || carregando}
              className="rounded border px-3 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-50 disabled:opacity-30"
            >
              Próxima
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
