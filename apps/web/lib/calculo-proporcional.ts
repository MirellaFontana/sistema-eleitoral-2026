import { type RegraEleitoral } from "./regras-eleitorais";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export type PartidoInput = {
  id: string;
  nome: string;
  votosNominais: number;
  votosLegenda: number;
  candidatos: CandidatoInput[];
};

export type CandidatoInput = {
  id: string;
  nome: string;
  votos: number;
  genero: "masculino" | "feminino";
};

export type ResultadoCandidato = CandidatoInput & {
  pctQe: number;
  atingeMinimo: boolean;
  distanciaMinimo: number;
  eleito: boolean;
  suplente: boolean;
  fase: "quociente" | "sobras_fase1" | "sobras_fase2" | "nao_eleito";
};

export type ResultadoPartido = {
  id: string;
  nome: string;
  votosTotal: number;
  votosNominais: number;
  votosLegenda: number;
  qp: number;
  cadeirasQp: number;
  cadeirasQpFinal: number;
  cadeirasSobras: number;
  cadeirasTotal: number;
  mediaSobras: number;
  candidatos: ResultadoCandidato[];
};

export type ResultadoSimulacao = {
  votosValidos: number;
  vagas: number;
  qe: number;
  regra: { ano: number; fonteLegal: string };
  partidos: ResultadoPartido[];
  vagasDistribuidas: number;
  vagasSobras: number;
  alertas: string[];
};

// ---------------------------------------------------------------------------
// Cálculos
// ---------------------------------------------------------------------------

/** Quociente Eleitoral = votos válidos / vagas (arredonda para baixo, mín 1) */
export function calcularQE(votosValidos: number, vagas: number): number {
  if (vagas <= 0) return 0;
  return Math.floor(votosValidos / vagas) || 1;
}

/** Quociente Partidário = votos do partido / QE (parte inteira) */
export function calcularQP(votosPartido: number, qe: number): number {
  if (qe <= 0) return 0;
  return Math.floor(votosPartido / qe);
}

/**
 * Simulação proporcional completa conforme regras de 2026.
 *
 * Implementa:
 * 1. Quociente eleitoral (QE)
 * 2. Quociente partidário (QP) → cadeiras iniciais
 * 3. Votação individual mínima (10% do QE para QP)
 * 4. Sobras fase 1 (80% do QE)
 * 5. Sobras fase 2 (20% do QE) — todos os partidos participam
 * 6. Ranking e classificação de candidatos
 */
export function simular(
  votosValidos: number,
  vagas: number,
  partidos: PartidoInput[],
  regra: RegraEleitoral,
): ResultadoSimulacao {
  const alertas: string[] = [];
  const qe = calcularQE(votosValidos, vagas);
  const minimoIndividual = Math.floor(qe * (regra.votacaoMinimaPctQe / 100));
  const limiarFase1 = Math.floor(qe * (regra.sobrasPctQeFase1 / 100));
  const limiarFase2 = Math.floor(qe * (regra.sobrasPctQeFase2 / 100));

  // Fase 1: Quociente partidário
  const resultados: ResultadoPartido[] = partidos.map((p) => {
    const votosTotal = p.votosNominais + p.votosLegenda;
    const qp = calcularQP(votosTotal, qe);

    const candidatosOrdenados = [...p.candidatos].sort((a, b) => b.votos - a.votos);

    const candidatosResult: ResultadoCandidato[] = candidatosOrdenados.map((c) => ({
      ...c,
      pctQe: qe > 0 ? Math.round((c.votos / qe) * 10000) / 100 : 0,
      atingeMinimo: c.votos >= minimoIndividual,
      distanciaMinimo: c.votos - minimoIndividual,
      eleito: false,
      suplente: false,
      fase: "nao_eleito" as const,
    }));

    // Preencher cadeiras do QP com candidatos que atingem mínimo
    let cadeirasQpFinal = 0;
    for (let i = 0; i < candidatosResult.length && cadeirasQpFinal < qp; i++) {
      if (candidatosResult[i].atingeMinimo) {
        candidatosResult[i].eleito = true;
        candidatosResult[i].fase = "quociente";
        cadeirasQpFinal++;
      }
    }

    if (cadeirasQpFinal < qp) {
      alertas.push(
        `${p.nome}: ${qp - cadeirasQpFinal} cadeira(s) do QP não preenchida(s) por falta de candidatos com votação mínima.`,
      );
    }

    return {
      id: p.id,
      nome: p.nome,
      votosTotal,
      votosNominais: p.votosNominais,
      votosLegenda: p.votosLegenda,
      qp,
      cadeirasQp: qp,
      cadeirasQpFinal,
      cadeirasSobras: 0,
      cadeirasTotal: cadeirasQpFinal,
      mediaSobras: 0,
      candidatos: candidatosResult,
    };
  });

  let vagasDistribuidas = resultados.reduce((s, p) => s + p.cadeirasQpFinal, 0);
  let vagasRestantes = vagas - vagasDistribuidas;

  // Fase 2: Sobras — primeira rodada (80% do QE)
  if (vagasRestantes > 0) {
    distribuirSobras(resultados, vagasRestantes, limiarFase1, "sobras_fase1", alertas);
    const novoTotal = resultados.reduce((s, p) => s + p.cadeirasTotal, 0);
    vagasRestantes = vagas - novoTotal;
    vagasDistribuidas = novoTotal;
  }

  // Fase 3: Sobras — segunda rodada (20% do QE, todos participam)
  if (vagasRestantes > 0) {
    distribuirSobras(resultados, vagasRestantes, limiarFase2, "sobras_fase2", alertas);
    const novoTotal = resultados.reduce((s, p) => s + p.cadeirasTotal, 0);
    vagasRestantes = vagas - novoTotal;
    vagasDistribuidas = novoTotal;
  }

  // Marcar suplentes
  for (const p of resultados) {
    const eleitos = p.candidatos.filter((c) => c.eleito);
    const naoEleitos = p.candidatos
      .filter((c) => !c.eleito && c.atingeMinimo)
      .sort((a, b) => b.votos - a.votos);
    for (const c of naoEleitos) {
      c.suplente = true;
    }
    p.cadeirasSobras = p.cadeirasTotal - p.cadeirasQpFinal;

    // Reordenar: eleitos primeiro (por fase, depois votos), depois suplentes, depois resto
    const ordem = (c: ResultadoCandidato) => {
      if (c.eleito) return 0;
      if (c.suplente) return 1;
      return 2;
    };
    p.candidatos.sort((a, b) => ordem(a) - ordem(b) || b.votos - a.votos);
  }

  if (vagasRestantes > 0) {
    alertas.push(`${vagasRestantes} vaga(s) não distribuída(s) — não há candidatos elegíveis suficientes.`);
  }

  return {
    votosValidos,
    vagas,
    qe,
    regra: { ano: regra.ano, fonteLegal: regra.fonteLegal },
    partidos: resultados.sort((a, b) => b.cadeirasTotal - a.cadeirasTotal || b.votosTotal - a.votosTotal),
    vagasDistribuidas,
    vagasSobras: vagas - resultados.reduce((s, p) => s + p.cadeirasQpFinal, 0),
    alertas,
  };
}

function distribuirSobras(
  partidos: ResultadoPartido[],
  vagasRestantes: number,
  limiarVotacao: number,
  fase: "sobras_fase1" | "sobras_fase2",
  alertas: string[],
) {
  let distribuidas = 0;

  while (distribuidas < vagasRestantes) {
    let melhorPartido: ResultadoPartido | null = null;
    let melhorMedia = -1;

    for (const p of partidos) {
      const proximoCandidato = p.candidatos.find((c) => !c.eleito && c.votos >= limiarVotacao);
      if (!proximoCandidato) continue;

      // Média = votos total / (cadeiras obtidas + 1)
      const media = p.votosTotal / (p.cadeirasTotal + 1);
      if (media > melhorMedia) {
        melhorMedia = media;
        melhorPartido = p;
      }
    }

    if (!melhorPartido) {
      if (fase === "sobras_fase1") {
        alertas.push(
          `Sobras fase 1: ${vagasRestantes - distribuidas} vaga(s) restante(s) para fase 2.`,
        );
      }
      break;
    }

    const candidato = melhorPartido.candidatos.find((c) => !c.eleito && c.votos >= limiarVotacao);
    if (candidato) {
      candidato.eleito = true;
      candidato.fase = fase;
      melhorPartido.cadeirasTotal++;
      melhorPartido.mediaSobras = melhorMedia;
      distribuidas++;
    } else {
      break;
    }
  }
}

// ---------------------------------------------------------------------------
// Análise de força da chapa
// ---------------------------------------------------------------------------

export type AnaliseChapa = {
  totalCandidatos: number;
  competitivos: number;
  acimaMinimo: number;
  abaixoMinimo: number;
  votosProjetadosTotal: number;
  votosHistoricosTotal: number;
  coberturaEstado: { municipio: string; candidatos: number }[];
  sobreposicoes: { municipio: string; candidatos: string[] }[];
  concentracao: { top3Pct: number; alerta: boolean };
};

export function analisarChapa(
  candidatos: { nome: string; votos_projetados: number; votos_historicos: number; municipios_forca: string[] }[],
  qe: number,
  regra: RegraEleitoral,
): AnaliseChapa {
  const minimoIndividual = Math.floor(qe * (regra.votacaoMinimaPctQe / 100));

  const competitivos = candidatos.filter((c) => c.votos_projetados >= qe * 0.5).length;
  const acimaMinimo = candidatos.filter((c) => c.votos_projetados >= minimoIndividual).length;
  const abaixoMinimo = candidatos.length - acimaMinimo;

  const votosProjetadosTotal = candidatos.reduce((s, c) => s + (c.votos_projetados || 0), 0);
  const votosHistoricosTotal = candidatos.reduce((s, c) => s + (c.votos_historicos || 0), 0);

  // Cobertura por município
  const munMap = new Map<string, string[]>();
  for (const c of candidatos) {
    for (const m of c.municipios_forca ?? []) {
      const arr = munMap.get(m);
      if (arr) arr.push(c.nome);
      else munMap.set(m, [c.nome]);
    }
  }

  const coberturaEstado = [...munMap.entries()]
    .map(([municipio, nomes]) => ({ municipio, candidatos: nomes.length }))
    .sort((a, b) => b.candidatos - a.candidatos);

  const sobreposicoes = coberturaEstado
    .filter((c) => c.candidatos >= 2)
    .map((c) => ({ municipio: c.municipio, candidatos: munMap.get(c.municipio)! }));

  // Concentração: % dos votos nos top 3 candidatos
  const votosOrdenados = candidatos
    .map((c) => c.votos_projetados || 0)
    .sort((a, b) => b - a);
  const top3 = votosOrdenados.slice(0, 3).reduce((s, v) => s + v, 0);
  const top3Pct = votosProjetadosTotal > 0 ? Math.round((top3 / votosProjetadosTotal) * 100) : 0;

  return {
    totalCandidatos: candidatos.length,
    competitivos,
    acimaMinimo,
    abaixoMinimo,
    votosProjetadosTotal,
    votosHistoricosTotal,
    coberturaEstado,
    sobreposicoes,
    concentracao: { top3Pct, alerta: top3Pct > 70 },
  };
}
