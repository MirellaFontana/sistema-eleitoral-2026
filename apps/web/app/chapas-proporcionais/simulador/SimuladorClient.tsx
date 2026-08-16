"use client";

import { useState } from "react";
import { obterRegra } from "@/lib/regras-eleitorais";

type Eleicao = Record<string, unknown>;
type ChapaData = Record<string, unknown>;
type CandData = Record<string, unknown>;

const CARGO_LABELS: Record<string, string> = {
  deputado_federal: "Dep. Federal",
  deputado_estadual: "Dep. Estadual",
  deputado_distrital: "Dep. Distrital",
  vereador: "Vereador",
};

type ChapaSimInput = {
  chapaId: string;
  partido: string;
  votosLegenda: number;
  candidatos: { id: string; nome_urna: string; votos: number; genero: string }[];
};

type ResultadoPartido = {
  partido: string;
  votosTotal: number;
  qp: number;
  cadeirasQp: number;
  cadeiras1aSobra: number;
  cadeiras2aSobra: number;
  cadeirasTotal: number;
  candidatos: {
    nome_urna: string;
    votos: number;
    pctQe: number;
    status: string;
    fase: string;
  }[];
};

type ResultadoSimulacao = {
  votosValidos: number;
  qe: number;
  alertas: string[];
  partidos: ResultadoPartido[];
};

function simular(
  votosValidos: number,
  chapasInput: ChapaSimInput[],
  vagas: number,
  regra: ReturnType<typeof obterRegra>,
): ResultadoSimulacao {
  const alertas: string[] = [];

  const qe = Math.floor(votosValidos / vagas);
  if (qe === 0) {
    return { votosValidos, qe: 0, alertas: ["QE é zero - votos válidos insuficientes."], partidos: [] };
  }

  const minVotosCand = qe * (regra.votacaoMinimaPctQe / 100);
  const minVotosPartido1a = qe * (regra.sobrasPctQeFase1 / 100);

  const partidos = chapasInput.map((ch) => {
    const votosTotal = ch.votosLegenda + ch.candidatos.reduce((s, c) => s + c.votos, 0);
    const qp = votosTotal / qe;
    const cadeirasQp = Math.floor(qp);

    const candsOrdenados = [...ch.candidatos].sort((a, b) => b.votos - a.votos);

    return {
      partido: ch.partido,
      votosTotal,
      qp,
      cadeirasQp,
      cadeiras1aSobra: 0,
      cadeiras2aSobra: 0,
      cadeirasTotal: cadeirasQp,
      candsOrdenados,
      resto: qp - cadeirasQp,
    };
  });

  let cadeirasDistribuidas = partidos.reduce((s, p) => s + p.cadeirasQp, 0);
  let sobras = vagas - cadeirasDistribuidas;

  // 1a fase de sobras - média maior com filtro 80% QE
  const aptos1a = partidos.filter((p) => p.votosTotal >= minVotosPartido1a);
  while (sobras > 0 && aptos1a.length > 0) {
    let melhor: (typeof partidos)[0] | null = null;
    let melhorMedia = 0;
    for (const p of aptos1a) {
      const media = p.votosTotal / (p.cadeirasTotal + 1);
      if (media > melhorMedia) {
        melhorMedia = media;
        melhor = p;
      }
    }
    if (!melhor) break;
    melhor.cadeiras1aSobra++;
    melhor.cadeirasTotal++;
    sobras--;
    cadeirasDistribuidas++;
  }

  // 2a fase de sobras - média maior com filtro 20% QE
  const minVotosPartido2a = qe * (regra.sobrasPctQeFase2 / 100);
  const aptos2a = partidos.filter((p) => p.votosTotal >= minVotosPartido2a);
  while (sobras > 0 && aptos2a.length > 0) {
    let melhor: (typeof partidos)[0] | null = null;
    let melhorMedia = 0;
    for (const p of aptos2a) {
      const media = p.votosTotal / (p.cadeirasTotal + 1);
      if (media > melhorMedia) {
        melhorMedia = media;
        melhor = p;
      }
    }
    if (!melhor) break;
    melhor.cadeiras2aSobra++;
    melhor.cadeirasTotal++;
    sobras--;
  }

  const resultado: ResultadoPartido[] = partidos.map((p) => {
    let cadeirasPreenchidas = 0;
    const candidatos = p.candsOrdenados.map((c) => {
      const pctQe = (c.votos / qe) * 100;
      let status: string;
      let fase: string;

      if (c.votos < minVotosCand) {
        status = "ABAIXO DO MINIMO";
        fase = "—";
      } else if (cadeirasPreenchidas < p.cadeirasTotal) {
        status = "ELEITO";
        cadeirasPreenchidas++;
        if (cadeirasPreenchidas <= p.cadeirasQp) fase = "QP";
        else if (cadeirasPreenchidas <= p.cadeirasQp + p.cadeiras1aSobra) fase = "1a sobra";
        else fase = "2a sobra";
      } else {
        status = "SUPLENTE";
        fase = "—";
      }

      return { nome_urna: c.nome_urna, votos: c.votos, pctQe: Math.round(pctQe * 100) / 100, status, fase };
    });

    if (cadeirasPreenchidas < p.cadeirasTotal) {
      alertas.push(`${p.partido}: ${p.cadeirasTotal - cadeirasPreenchidas} cadeira(s) sem candidato apto.`);
    }

    return {
      partido: p.partido,
      votosTotal: p.votosTotal,
      qp: Math.round(p.qp * 100) / 100,
      cadeirasQp: p.cadeirasQp,
      cadeiras1aSobra: p.cadeiras1aSobra,
      cadeiras2aSobra: p.cadeiras2aSobra,
      cadeirasTotal: p.cadeirasTotal,
      candidatos,
    };
  });

  return { votosValidos, qe, alertas, partidos: resultado };
}

const STATUS_COR: Record<string, string> = {
  ELEITO: "bg-emerald-100 text-emerald-800",
  SUPLENTE: "bg-amber-100 text-amber-800",
  "ABAIXO DO MINIMO": "bg-red-100 text-red-800",
};

export function SimuladorClient({ eleicoes }: { eleicoes: Eleicao[] }) {
  const [eleicaoId, setEleicaoId] = useState("");
  const [chapasData, setChapasData] = useState<ChapaData[]>([]);
  const [votosValidos, setVotosValidos] = useState("");
  const [votosEditados, setVotosEditados] = useState<Record<string, number>>({});
  const [legendaEditada, setLegendaEditada] = useState<Record<string, number>>({});
  const [resultado, setResultado] = useState<ResultadoSimulacao | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [cenario, setCenario] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);

  const eleicaoSel = eleicoes.find((e) => e.id === eleicaoId);

  async function selecionarEleicao(id: string) {
    setEleicaoId(id);
    setResultado(null);
    setVotosEditados({});
    setLegendaEditada({});
    if (!id) { setChapasData([]); return; }
    setCarregando(true);

    const res = await fetch(`/api/chapas-proporcionais/${id}`);
    if (res.ok) {
      const eleicao = await res.json();
      setChapasData(eleicao.chapas_proporcionais ?? []);
    }
    setCarregando(false);
  }

  function executarSimulacao() {
    if (!eleicaoSel || !votosValidos) return;
    const vagas = eleicaoSel.vagas as number;
    const regra = obterRegra((eleicaoSel.ano as number) ?? 2026);

    const chapasInput: ChapaSimInput[] = chapasData.map((ch) => {
      const chapaId = ch.id as string;
      const cands = (ch.candidaturas_proporcionais ?? []) as CandData[];
      return {
        chapaId,
        partido: ch.partido as string,
        votosLegenda: legendaEditada[chapaId] ?? (ch.votos_legenda_estimados as number) ?? 0,
        candidatos: cands.map((c) => ({
          id: c.id as string,
          nome_urna: c.nome_urna as string,
          votos: votosEditados[c.id as string] ?? (c.votos_projetados as number) ?? 0,
          genero: c.genero as string,
        })),
      };
    });

    const res = simular(Number(votosValidos), chapasInput, vagas, regra);
    setResultado(res);
    setSalvo(false);
  }

  function buildApiPartidos() {
    return chapasData.map((ch) => {
      const chapaId = ch.id as string;
      const cands = (ch.candidaturas_proporcionais ?? []) as CandData[];
      return {
        id: chapaId,
        nome: ch.partido as string,
        votosLegenda: legendaEditada[chapaId] ?? (ch.votos_legenda_estimados as number) ?? 0,
        votosNominais: cands.reduce((s, c) => s + (votosEditados[c.id as string] ?? (c.votos_projetados as number) ?? 0), 0),
        candidatos: cands.map((c) => ({
          id: c.id as string,
          nome: c.nome_urna as string,
          votos: votosEditados[c.id as string] ?? (c.votos_projetados as number) ?? 0,
          genero: c.genero as string,
        })),
      };
    });
  }

  async function salvarSimulacao() {
    if (!titulo.trim()) return;
    setSalvando(true);
    const res = await fetch(`/api/chapas-proporcionais/${eleicaoId}/simular`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        votos_validos_estimados: Number(votosValidos),
        partidos: buildApiPartidos(),
        titulo: titulo.trim(),
        cenario: cenario || null,
      }),
    });
    setSalvando(false);
    if (res.ok) setSalvo(true);
  }

  if (eleicoes.length === 0) {
    return (
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <h1 className="text-lg font-semibold text-neutral-800">Simulador</h1>
        <p className="mt-2 text-sm text-neutral-400">
          Crie uma eleição primeiro na <a href="/chapas-proporcionais" className="text-teal-600 hover:underline">Visão Geral</a>.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 py-8">
      <h1 className="text-lg font-semibold text-neutral-800">Simulador de Quociente Eleitoral</h1>
      <p className="text-sm text-neutral-500">Simule a distribuição de cadeiras com base em votos projetados.</p>

      <div className="flex flex-wrap items-end gap-4">
        <label className="space-y-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Eleição</span>
          <select
            value={eleicaoId}
            onChange={(e) => selecionarEleicao(e.target.value)}
            className="rounded border px-2.5 py-1.5 text-sm"
          >
            <option value="">Selecione</option>
            {eleicoes.map((el) => (
              <option key={el.id as string} value={el.id as string}>
                {CARGO_LABELS[el.cargo as string] ?? el.cargo} - {el.estado as string} ({el.vagas as number} vagas)
              </option>
            ))}
          </select>
        </label>

        {!!eleicaoId && (
          <>
            <label className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Votos válidos estimados</span>
              <input
                type="number"
                value={votosValidos}
                onChange={(e) => setVotosValidos(e.target.value)}
                placeholder="Ex: 5000000"
                className="w-44 rounded border px-2.5 py-1.5 text-sm"
              />
            </label>
            <button
              onClick={executarSimulacao}
              disabled={!votosValidos}
              className="rounded bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
            >
              Simular
            </button>
          </>
        )}
      </div>

      {carregando && <p className="text-sm text-neutral-400">Carregando dados...</p>}

      {!!eleicaoId && !carregando && chapasData.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Dados de entrada</h2>
          {chapasData.map((ch) => {
            const chapaId = ch.id as string;
            const cands = (ch.candidaturas_proporcionais ?? []) as CandData[];
            return (
              <div key={chapaId} className="rounded-lg border border-neutral-200 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">{ch.partido as string}</span>
                  <label className="flex items-center gap-2 text-xs text-neutral-500">
                    Votos legenda:
                    <input
                      type="number"
                      value={legendaEditada[chapaId] ?? (ch.votos_legenda_estimados as number) ?? 0}
                      onChange={(e) => setLegendaEditada((p) => ({ ...p, [chapaId]: Number(e.target.value) }))}
                      className="w-28 rounded border px-2 py-1 text-sm"
                    />
                  </label>
                </div>
                {cands.length === 0 ? (
                  <p className="text-xs text-neutral-400">Sem candidaturas cadastradas.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs font-medium uppercase tracking-wide text-neutral-400">
                          <th className="pb-1 pr-3">Nome</th>
                          <th className="pb-1 pr-3">Votos projetados</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cands.map((c) => {
                          const cId = c.id as string;
                          return (
                            <tr key={cId} className="border-t border-neutral-100">
                              <td className="py-1 pr-3">{c.nome_urna as string}</td>
                              <td className="py-1 pr-3">
                                <input
                                  type="number"
                                  value={votosEditados[cId] ?? (c.votos_projetados as number) ?? 0}
                                  onChange={(e) => setVotosEditados((p) => ({ ...p, [cId]: Number(e.target.value) }))}
                                  className="w-28 rounded border px-2 py-1 text-sm"
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!!resultado && (
        <div className="space-y-6">
          {resultado.alertas.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-1">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-amber-700">Alertas</h3>
              {resultado.alertas.map((a, i) => (
                <p key={i} className="text-sm text-amber-700">{a}</p>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-neutral-200 p-4">
              <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Votos válidos</span>
              <p className="mt-1 text-xl font-bold">{resultado.votosValidos.toLocaleString("pt-BR")}</p>
            </div>
            <div className="rounded-lg border border-neutral-200 p-4">
              <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Quociente Eleitoral (QE)</span>
              <p className="mt-1 text-xl font-bold">{resultado.qe.toLocaleString("pt-BR")}</p>
            </div>
            <div className="rounded-lg border border-neutral-200 p-4">
              <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Vagas</span>
              <p className="mt-1 text-xl font-bold">{eleicaoSel?.vagas as number}</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs font-medium uppercase tracking-wide text-neutral-400">
                  <th className="pb-2 pr-3">Partido</th>
                  <th className="pb-2 pr-3">Votos total</th>
                  <th className="pb-2 pr-3">QP</th>
                  <th className="pb-2 pr-3">Cadeiras QP</th>
                  <th className="pb-2 pr-3">1a sobra</th>
                  <th className="pb-2 pr-3">2a sobra</th>
                  <th className="pb-2 pr-3">Total cadeiras</th>
                </tr>
              </thead>
              <tbody>
                {resultado.partidos.map((p) => (
                  <tr key={p.partido} className="border-b border-neutral-100">
                    <td className="py-2 pr-3 font-medium">{p.partido}</td>
                    <td className="py-2 pr-3">{p.votosTotal.toLocaleString("pt-BR")}</td>
                    <td className="py-2 pr-3">{p.qp}</td>
                    <td className="py-2 pr-3">{p.cadeirasQp}</td>
                    <td className="py-2 pr-3">{p.cadeiras1aSobra}</td>
                    <td className="py-2 pr-3">{p.cadeiras2aSobra}</td>
                    <td className="py-2 pr-3 font-bold">{p.cadeirasTotal}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Candidatos por partido</h2>
          {resultado.partidos.map((p) => (
            <div key={p.partido} className="rounded-lg border border-neutral-200 p-4 space-y-2">
              <h3 className="text-sm font-semibold">{p.partido} — {p.cadeirasTotal} cadeira{p.cadeirasTotal !== 1 ? "s" : ""}</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs font-medium uppercase tracking-wide text-neutral-400">
                      <th className="pb-1 pr-3">Candidato</th>
                      <th className="pb-1 pr-3">Votos</th>
                      <th className="pb-1 pr-3">% QE</th>
                      <th className="pb-1 pr-3">Status</th>
                      <th className="pb-1 pr-3">Fase</th>
                    </tr>
                  </thead>
                  <tbody>
                    {p.candidatos.map((c, i) => (
                      <tr key={i} className="border-t border-neutral-100">
                        <td className="py-1 pr-3">{c.nome_urna}</td>
                        <td className="py-1 pr-3">{c.votos.toLocaleString("pt-BR")}</td>
                        <td className="py-1 pr-3">{c.pctQe}%</td>
                        <td className="py-1 pr-3">
                          <span className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_COR[c.status] ?? "bg-neutral-100"}`}>
                            {c.status}
                          </span>
                        </td>
                        <td className="py-1 pr-3 text-neutral-500">{c.fase}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          <div className="rounded-lg border border-neutral-200 p-4 space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Salvar simulação</h3>
            <div className="flex flex-wrap gap-3">
              <input
                type="text"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Título da simulação *"
                className="rounded border px-2.5 py-1.5 text-sm"
              />
              <select
                value={cenario}
                onChange={(e) => setCenario(e.target.value)}
                className="rounded border px-2.5 py-1.5 text-sm"
              >
                <option value="">Cenário (opcional)</option>
                <option value="otimista">Otimista</option>
                <option value="moderado">Moderado</option>
                <option value="pessimista">Pessimista</option>
              </select>
              <button
                onClick={salvarSimulacao}
                disabled={salvando || !titulo.trim() || salvo}
                className="rounded bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
              >
                {salvo ? "Salva!" : salvando ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
