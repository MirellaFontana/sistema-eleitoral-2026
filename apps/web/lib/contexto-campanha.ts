import { type SupabaseClient } from "@supabase/supabase-js";
import { montarContextoConhecimento, type TemaComItens } from "./anthropic";
import { obterContextoDiretrizes } from "./diretrizes-context";

type DadosCampanha = {
  nome_candidato?: string | null;
  nome_urna?: string | null;
  numero_candidato?: string | null;
  cargo?: string | null;
  uf?: string | null;
  partido?: string | null;
  coligacao?: string | null;
  cnpj_campanha?: string | null;
  voz_candidato?: string | null;
};

export type ContextoCampanha = {
  identidade: string;
  voz: string;
  diretrizes: string;
  temas: string;
  concorrentes: string;
  demandas: string;
};

export type CamadaContexto = keyof ContextoCampanha;

function formatarIdentidade(c: DadosCampanha): string {
  return [
    `Candidato: ${c.nome_candidato ?? "–"}`,
    `Nome de urna: ${c.nome_urna ?? "–"}`,
    `Número: ${c.numero_candidato ?? "–"}`,
    `Cargo: ${c.cargo ?? "–"} – ${c.uf ?? "–"}`,
    `Partido: ${c.partido ?? "–"}`,
    `Coligação: ${c.coligacao ?? "–"}`,
    `CNPJ da campanha: ${c.cnpj_campanha ?? "–"}`,
  ].join("\n");
}

async function carregarTemas(supabase: SupabaseClient): Promise<string> {
  const { data } = await supabase
    .from("temas_campanha")
    .select("id, nome, publicos_alvo, regioes_prioritarias, base_conhecimento_itens(titulo, descricao)")
    .order("ordem")
    .limit(30);

  const temas: TemaComItens[] = (data ?? []).map((t) => ({
    nome: t.nome,
    publicos_alvo: t.publicos_alvo ?? [],
    regioes_prioritarias: t.regioes_prioritarias ?? [],
    itens: (Array.isArray(t.base_conhecimento_itens) ? t.base_conhecimento_itens : []) as { titulo: string; descricao: string | null }[],
  }));

  return montarContextoConhecimento(temas);
}

async function carregarConcorrentes(supabase: SupabaseClient): Promise<string> {
  const { data } = await supabase
    .from("concorrentes")
    .select("nome, partido, pontos_fortes, pontos_fracos, promessas");

  return (data ?? [])
    .map((c) => `- ${c.nome} (${c.partido ?? "sem partido"}): promessas: ${c.promessas ?? "?"} | fortes: ${c.pontos_fortes ?? "?"} | fracos: ${c.pontos_fracos ?? "?"}`)
    .join("\n") || "(nenhum concorrente cadastrado)";
}

async function carregarDemandas(supabase: SupabaseClient): Promise<string> {
  const { data } = await supabase
    .from("demandas_observadas")
    .select("regiao, cidades, tema, demanda");

  return (data ?? [])
    .map((d) => {
      const cidades = Array.isArray(d.cidades) && d.cidades.length > 0 ? d.cidades.join(", ") : "";
      return `- [${d.tema ?? "sem tema"}] ${d.regiao ?? ""} ${cidades}: ${d.demanda}`;
    })
    .join("\n") || "(nenhuma demanda observada)";
}

export async function carregarContexto(
  supabase: SupabaseClient,
  campanhaId: string,
  camadas: CamadaContexto[],
  campanha?: DadosCampanha | null,
): Promise<ContextoCampanha> {
  const set = new Set(camadas);
  const resultado: ContextoCampanha = { identidade: "", voz: "", diretrizes: "", temas: "", concorrentes: "", demandas: "" };

  const tarefas: Promise<void>[] = [];

  if (set.has("identidade") || set.has("voz")) {
    if (campanha) {
      if (set.has("identidade")) resultado.identidade = formatarIdentidade(campanha);
      if (set.has("voz") && campanha.voz_candidato) resultado.voz = campanha.voz_candidato.slice(0, 4000);
    }
  }

  if (set.has("diretrizes")) {
    tarefas.push(obterContextoDiretrizes(supabase, campanhaId).then((d) => { resultado.diretrizes = d; }));
  }
  if (set.has("temas")) {
    tarefas.push(carregarTemas(supabase).then((t) => { resultado.temas = t; }));
  }
  if (set.has("concorrentes")) {
    tarefas.push(carregarConcorrentes(supabase).then((c) => { resultado.concorrentes = c; }));
  }
  if (set.has("demandas")) {
    tarefas.push(carregarDemandas(supabase).then((d) => { resultado.demandas = d; }));
  }

  await Promise.all(tarefas);
  return resultado;
}

export function montarMensagemContexto(ctx: ContextoCampanha, extras?: (string | null | undefined)[]): string {
  const partes: string[] = [];
  if (ctx.identidade) partes.push(`IDENTIDADE DA CAMPANHA:\n${ctx.identidade}`);
  if (ctx.voz) partes.push(`VOZ DO CANDIDATO (copie expressões, ritmo, jeito de falar):\n${ctx.voz}`);
  if (ctx.diretrizes) partes.push(ctx.diretrizes);
  if (ctx.temas) partes.push(`BASE DE CONHECIMENTO DA CAMPANHA:\n${ctx.temas}`);
  if (ctx.concorrentes) partes.push(`CONCORRENTES:\n${ctx.concorrentes}`);
  if (ctx.demandas) partes.push(`DEMANDAS OBSERVADAS:\n${ctx.demandas}`);
  if (extras) {
    for (const e of extras) { if (e) partes.push(e); }
  }
  return partes.join("\n\n");
}
