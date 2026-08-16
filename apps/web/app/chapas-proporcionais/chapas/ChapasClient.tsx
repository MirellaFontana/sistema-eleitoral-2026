"use client";

import { useState } from "react";
import { Plus, ChevronDown, ChevronRight } from "lucide-react";
import {
  analisarCotaGenero,
  obterRegra,
  limiteMaxCandidaturas,
} from "@/lib/regras-eleitorais";

type Eleicao = Record<string, unknown>;
type Chapa = Record<string, unknown>;
type Candidatura = Record<string, unknown>;

const CARGO_LABELS: Record<string, string> = {
  deputado_federal: "Dep. Federal",
  deputado_estadual: "Dep. Estadual",
  deputado_distrital: "Dep. Distrital",
  vereador: "Vereador",
};

const GENERO_BADGE: Record<string, string> = {
  OK: "bg-teal-100 text-teal-800",
  ATENCAO: "bg-amber-100 text-amber-800",
  IRREGULAR: "bg-red-100 text-red-800",
};

export function ChapasClient({ eleicoes }: { eleicoes: Eleicao[] }) {
  const [eleicaoId, setEleicaoId] = useState("");
  const [chapas, setChapas] = useState<Chapa[]>([]);
  const [expandida, setExpandida] = useState<string | null>(null);
  const [candidaturas, setCandidaturas] = useState<Record<string, Candidatura[]>>({});
  const [carregando, setCarregando] = useState(false);

  const [mostrarFormChapa, setMostrarFormChapa] = useState(false);
  const [mostrarFormCand, setMostrarFormCand] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const eleicaoSel = eleicoes.find((e) => e.id === eleicaoId);
  const regra = obterRegra((eleicaoSel?.ano as number) ?? 2026);
  const maxCand = eleicaoSel ? limiteMaxCandidaturas(eleicaoSel.vagas as number, regra) : 0;

  async function selecionarEleicao(id: string) {
    setEleicaoId(id);
    setExpandida(null);
    if (!id) { setChapas([]); return; }
    setCarregando(true);
    const res = await fetch(`/api/chapas-proporcionais/${id}/chapas`);
    if (res.ok) setChapas(await res.json());
    setCarregando(false);
  }

  async function carregarCandidaturas(chapaId: string) {
    if (candidaturas[chapaId]) return;
    const res = await fetch(`/api/chapas-proporcionais/${eleicaoId}/chapas/${chapaId}/candidaturas`);
    if (res.ok) {
      const data = await res.json();
      setCandidaturas((prev) => ({ ...prev, [chapaId]: data }));
    }
  }

  async function toggleChapa(chapaId: string) {
    if (expandida === chapaId) {
      setExpandida(null);
    } else {
      setExpandida(chapaId);
      await carregarCandidaturas(chapaId);
    }
  }

  async function criarChapa(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSalvando(true);
    setErro(null);
    const fd = new FormData(e.currentTarget);
    const res = await fetch(`/api/chapas-proporcionais/${eleicaoId}/chapas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        partido: fd.get("partido"),
        federacao: fd.get("federacao") || null,
        nome_coligacao: fd.get("nome_coligacao") || null,
        votos_legenda_estimados: Number(fd.get("votos_legenda_estimados")) || 0,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErro(data.error ?? "Erro ao criar chapa.");
    } else {
      setMostrarFormChapa(false);
      await selecionarEleicao(eleicaoId);
    }
    setSalvando(false);
  }

  async function criarCandidatura(e: React.FormEvent<HTMLFormElement>, chapaId: string) {
    e.preventDefault();
    setSalvando(true);
    setErro(null);
    const fd = new FormData(e.currentTarget);
    const chapa = chapas.find((c) => c.id === chapaId);
    const res = await fetch(`/api/chapas-proporcionais/${eleicaoId}/chapas/${chapaId}/candidaturas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome: fd.get("nome"),
        nome_urna: fd.get("nome_urna"),
        numero: fd.get("numero"),
        genero: fd.get("genero"),
        partido: (chapa?.partido as string) ?? fd.get("partido"),
        votos_historicos: Number(fd.get("votos_historicos")) || 0,
        votos_projetados: Number(fd.get("votos_projetados")) || 0,
        territorio_principal: fd.get("territorio_principal") || null,
        municipios_forca: fd.get("municipios_forca") ? (fd.get("municipios_forca") as string).split(",").map((s) => s.trim()).filter(Boolean) : null,
        status: fd.get("status") || "convidado",
        observacoes_estrategicas: fd.get("observacoes") || null,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErro(data.error ?? "Erro ao adicionar candidatura.");
    } else {
      setMostrarFormCand(null);
      setCandidaturas((prev) => ({ ...prev, [chapaId]: undefined as unknown as Candidatura[] }));
      await carregarCandidaturas(chapaId);
      await selecionarEleicao(eleicaoId);
    }
    setSalvando(false);
  }

  if (eleicoes.length === 0) {
    return (
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <h1 className="text-lg font-semibold text-neutral-800">Chapas</h1>
        <p className="mt-2 text-sm text-neutral-400">
          Crie uma eleição primeiro na <a href="/chapas-proporcionais" className="text-teal-600 hover:underline">Visão Geral</a>.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-4 py-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-neutral-800">Chapas</h1>
          <p className="text-sm text-neutral-500">Gerencie chapas e candidaturas por eleição.</p>
        </div>
      </div>

      <div className="flex items-end gap-4">
        <label className="space-y-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Eleição</span>
          <select
            value={eleicaoId}
            onChange={(e) => selecionarEleicao(e.target.value)}
            className="rounded border px-2.5 py-1.5 text-sm"
          >
            <option value="">Selecione uma eleição</option>
            {eleicoes.map((el) => (
              <option key={el.id as string} value={el.id as string}>
                {CARGO_LABELS[el.cargo as string] ?? el.cargo} - {el.estado as string} ({el.vagas as number} vagas)
              </option>
            ))}
          </select>
        </label>

        {!!eleicaoId && (
          <button
            onClick={() => setMostrarFormChapa(!mostrarFormChapa)}
            className="rounded bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
          >
            <Plus size={14} className="mr-1 inline" />
            Nova Chapa
          </button>
        )}
      </div>

      {!!erro && <p className="rounded bg-rose-50 px-3 py-2 text-sm text-rose-700">{erro}</p>}

      {mostrarFormChapa && !!eleicaoId && (
        <form onSubmit={criarChapa} className="rounded-lg border border-neutral-200 p-4 space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Nova chapa</h2>
          <div className="grid gap-3 sm:grid-cols-4">
            <label className="space-y-1">
              <span className="text-xs font-medium text-neutral-500">Partido *</span>
              <input name="partido" required className="w-full rounded border px-2.5 py-1.5 text-sm" />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-neutral-500">Federação</span>
              <input name="federacao" className="w-full rounded border px-2.5 py-1.5 text-sm" />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-neutral-500">Coligação</span>
              <input name="nome_coligacao" className="w-full rounded border px-2.5 py-1.5 text-sm" />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-neutral-500">Votos legenda estimados</span>
              <input name="votos_legenda_estimados" type="number" defaultValue={0} className="w-full rounded border px-2.5 py-1.5 text-sm" />
            </label>
          </div>
          <button type="submit" disabled={salvando} className="rounded bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50">
            {salvando ? "Salvando..." : "Criar Chapa"}
          </button>
        </form>
      )}

      {carregando && <p className="text-sm text-neutral-400">Carregando...</p>}

      {!!eleicaoId && !carregando && chapas.length === 0 && (
        <p className="text-sm text-neutral-400">Nenhuma chapa cadastrada nesta eleição.</p>
      )}

      {!!eleicaoId && (
        <div className="text-xs text-neutral-500">
          Limite de candidaturas por chapa: <strong>{maxCand}</strong> (vagas + {regra.limiteOffset})
        </div>
      )}

      <div className="space-y-3">
        {chapas.map((chapa) => {
          const chapaId = chapa.id as string;
          const isExpanded = expandida === chapaId;
          const cotaGenero = chapa.cota_genero as { situacao: string; motivo: string | null; total: number; masculino: number; feminino: number } | undefined;
          const totalCand = (chapa.total_candidaturas as number) ?? 0;

          return (
            <div key={chapaId} className="rounded-lg border border-neutral-200">
              <button
                onClick={() => toggleChapa(chapaId)}
                className="flex w-full items-center justify-between p-4 text-left hover:bg-neutral-50"
              >
                <div className="flex items-center gap-3">
                  {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  <div>
                    <span className="text-sm font-semibold text-neutral-800">
                      {chapa.partido as string}
                    </span>
                    {!!(chapa.federacao) && (
                      <span className="ml-2 text-xs text-neutral-400">Fed. {chapa.federacao as string}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-neutral-500">{totalCand} candidato{totalCand !== 1 ? "s" : ""}</span>
                  {!!cotaGenero && (
                    <span className={`rounded px-2 py-0.5 text-xs font-medium ${GENERO_BADGE[cotaGenero.situacao] ?? "bg-neutral-100 text-neutral-600"}`}>
                      Gênero: {cotaGenero.situacao}
                    </span>
                  )}
                  {totalCand > maxCand && maxCand > 0 && (
                    <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
                      Excede limite
                    </span>
                  )}
                </div>
              </button>

              {isExpanded && (
                <div className="border-t border-neutral-100 p-4 space-y-4">
                  {!!cotaGenero && cotaGenero.motivo && (
                    <p className={`rounded px-3 py-2 text-xs ${cotaGenero.situacao === "IRREGULAR" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}`}>
                      {cotaGenero.motivo}
                    </p>
                  )}

                  {!!cotaGenero && cotaGenero.total > 0 && (
                    <div className="flex gap-4 text-xs text-neutral-500">
                      <span>Masc: {cotaGenero.masculino}</span>
                      <span>Fem: {cotaGenero.feminino}</span>
                      <span>Total: {cotaGenero.total}</span>
                    </div>
                  )}

                  {(candidaturas[chapaId] ?? []).length === 0 ? (
                    <p className="text-sm text-neutral-400">Nenhuma candidatura cadastrada.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-left text-xs font-medium uppercase tracking-wide text-neutral-400">
                            <th className="pb-2 pr-3">Nome de urna</th>
                            <th className="pb-2 pr-3">Número</th>
                            <th className="pb-2 pr-3">Gênero</th>
                            <th className="pb-2 pr-3">Votos proj.</th>
                            <th className="pb-2 pr-3">Território</th>
                            <th className="pb-2 pr-3">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(candidaturas[chapaId] ?? []).map((c) => (
                            <tr key={c.id as string} className="border-b border-neutral-100">
                              <td className="py-2 pr-3 font-medium">{c.nome_urna as string}</td>
                              <td className="py-2 pr-3">{c.numero as string}</td>
                              <td className="py-2 pr-3">{c.genero === "feminino" ? "F" : "M"}</td>
                              <td className="py-2 pr-3">{((c.votos_projetados as number) ?? 0).toLocaleString("pt-BR")}</td>
                              <td className="py-2 pr-3 text-neutral-500">{(c.territorio_principal as string) ?? "—"}</td>
                              <td className="py-2 pr-3">
                                <span className="rounded bg-neutral-100 px-2 py-0.5 text-xs font-medium">
                                  {c.status as string}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {mostrarFormCand === chapaId ? (
                    <form onSubmit={(e) => criarCandidatura(e, chapaId)} className="rounded border border-neutral-200 p-3 space-y-3">
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Nova candidatura</h3>
                      <div className="grid gap-3 sm:grid-cols-3">
                        <input name="nome" required placeholder="Nome completo *" className="rounded border px-2.5 py-1.5 text-sm" />
                        <input name="nome_urna" required placeholder="Nome de urna *" className="rounded border px-2.5 py-1.5 text-sm" />
                        <input name="numero" required placeholder="Número *" className="rounded border px-2.5 py-1.5 text-sm" />
                        <select name="genero" required className="rounded border px-2.5 py-1.5 text-sm">
                          <option value="">Gênero *</option>
                          <option value="masculino">Masculino</option>
                          <option value="feminino">Feminino</option>
                        </select>
                        <input name="votos_historicos" type="number" placeholder="Votos históricos" defaultValue={0} className="rounded border px-2.5 py-1.5 text-sm" />
                        <input name="votos_projetados" type="number" placeholder="Votos projetados" defaultValue={0} className="rounded border px-2.5 py-1.5 text-sm" />
                        <input name="territorio_principal" placeholder="Território principal" className="rounded border px-2.5 py-1.5 text-sm" />
                        <input name="municipios_forca" placeholder="Municípios-força (separados por vírgula)" className="rounded border px-2.5 py-1.5 text-sm" />
                        <select name="status" className="rounded border px-2.5 py-1.5 text-sm">
                          <option value="convidado">Convidado</option>
                          <option value="provavel">Provável</option>
                          <option value="confirmado">Confirmado</option>
                          <option value="descartado">Descartado</option>
                        </select>
                      </div>
                      <textarea name="observacoes" rows={2} placeholder="Observações estratégicas" className="w-full rounded border px-2.5 py-1.5 text-sm" />
                      <div className="flex gap-2">
                        <button type="submit" disabled={salvando} className="rounded bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50">
                          {salvando ? "Salvando..." : "Adicionar"}
                        </button>
                        <button type="button" onClick={() => setMostrarFormCand(null)} className="rounded border px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-50">
                          Cancelar
                        </button>
                      </div>
                    </form>
                  ) : (
                    <button
                      onClick={() => setMostrarFormCand(chapaId)}
                      className="rounded bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
                    >
                      <Plus size={14} className="mr-1 inline" />
                      Adicionar Candidatura
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}
