export type RegraEleitoral = {
  ano: number;
  limiteOffset: number;
  cotaGeneroMinPct: number;
  cotaGeneroMaxPct: number;
  votacaoMinimaPctQe: number;
  sobrasPctQeFase1: number;
  sobrasPctQeFase2: number;
  fonteLegal: string;
};

const REGRAS: Record<number, RegraEleitoral> = {
  2026: {
    ano: 2026,
    limiteOffset: 1,
    cotaGeneroMinPct: 30,
    cotaGeneroMaxPct: 70,
    votacaoMinimaPctQe: 10,
    sobrasPctQeFase1: 80,
    sobrasPctQeFase2: 20,
    fonteLegal: "Resolução TSE nº 23.748/2026; CE art. 109 e 109-A",
  },
  2024: {
    ano: 2024,
    limiteOffset: 1,
    cotaGeneroMinPct: 30,
    cotaGeneroMaxPct: 70,
    votacaoMinimaPctQe: 10,
    sobrasPctQeFase1: 80,
    sobrasPctQeFase2: 20,
    fonteLegal: "CE art. 109 e 109-A (redação dada pela EC 97/2017 e Lei 14.211/2021)",
  },
};

export function obterRegra(ano: number): RegraEleitoral {
  return REGRAS[ano] ?? REGRAS[2026];
}

export function limiteMaxCandidaturas(vagas: number, regra: RegraEleitoral): number {
  return vagas + regra.limiteOffset;
}

export type AnaliseGenero = {
  total: number;
  masculino: number;
  feminino: number;
  pctMasculino: number;
  pctFeminino: number;
  minimoNecessario: number;
  maximoPermitido: number;
  situacao: "OK" | "ATENCAO" | "IRREGULAR";
  motivo: string | null;
};

export function analisarCotaGenero(
  masculino: number,
  feminino: number,
  regra: RegraEleitoral,
): AnaliseGenero {
  const total = masculino + feminino;
  if (total === 0) {
    return {
      total: 0, masculino: 0, feminino: 0,
      pctMasculino: 0, pctFeminino: 0,
      minimoNecessario: 0, maximoPermitido: 0,
      situacao: "OK", motivo: null,
    };
  }

  const pctM = (masculino / total) * 100;
  const pctF = (feminino / total) * 100;
  const min = Math.ceil(total * (regra.cotaGeneroMinPct / 100));
  const max = Math.floor(total * (regra.cotaGeneroMaxPct / 100));

  let situacao: "OK" | "ATENCAO" | "IRREGULAR" = "OK";
  let motivo: string | null = null;

  if (feminino < min) {
    situacao = "IRREGULAR";
    motivo = `Mínimo de ${min} candidaturas femininas exigido (${regra.cotaGeneroMinPct}%). Faltam ${min - feminino}.`;
  } else if (masculino < min) {
    situacao = "IRREGULAR";
    motivo = `Mínimo de ${min} candidaturas masculinas exigido (${regra.cotaGeneroMinPct}%). Faltam ${min - masculino}.`;
  } else if (feminino === min || masculino === min) {
    situacao = "ATENCAO";
    motivo = "No limite mínimo da cota de gênero.";
  }

  return {
    total, masculino, feminino,
    pctMasculino: Math.round(pctM * 100) / 100,
    pctFeminino: Math.round(pctF * 100) / 100,
    minimoNecessario: min,
    maximoPermitido: max,
    situacao, motivo,
  };
}

/** Vagas de deputado federal por UF (representação vigente para 2026) */
export const VAGAS_DEP_FEDERAL: Record<string, number> = {
  SP: 70, MG: 53, RJ: 46, BA: 39, RS: 31, PR: 30, PE: 25,
  CE: 22, MA: 18, GO: 17, PA: 17, SC: 16, PB: 12, PI: 10,
  AM: 8, ES: 10, RN: 8, AL: 9, MT: 8, MS: 8, SE: 8,
  RO: 8, TO: 8, AC: 8, AP: 8, RR: 8, DF: 8,
};

export const VAGAS_DEP_ESTADUAL: Record<string, number> = {
  SP: 94, MG: 77, RJ: 70, BA: 63, RS: 55, PR: 54, PE: 49,
  CE: 46, MA: 42, GO: 41, PA: 41, SC: 40, PB: 36, PI: 30,
  AM: 24, ES: 30, RN: 24, AL: 27, MT: 24, MS: 24, SE: 24,
  RO: 24, TO: 24, AC: 24, AP: 24, RR: 24,
};

export const VAGAS_DEP_DISTRITAL = 24;
