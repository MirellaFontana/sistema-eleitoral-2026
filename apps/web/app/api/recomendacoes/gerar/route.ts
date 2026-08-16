import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { criarClienteIA, respostaErroIA } from "@/lib/ia-client";
import { montarContextoConhecimento, type TemaComItens } from "@/lib/anthropic";
import { parseJsonSeguro, parseJsonArraySeguro } from "@/lib/parse-json-seguro";
import { obterContextoDiretrizes } from "@/lib/diretrizes-context";

const PAPEIS_GERAM = new Set(["coord_campanha", "candidato", "coord_marketing"]);

const SISTEMA = `Você é consultor estratégico sênior de campanha eleitoral brasileira. Analise todos os dados
fornecidos (alertas, monitoramento, demandas, diretrizes, agenda, concorrentes, ativos políticos) e produza
RECOMENDAÇÕES ACIONÁVEIS para a coordenação.

Cada recomendação deve ser EXPLICÁVEL: registre os fatos que a fundamentam, as regras/lógica
aplicadas, as fontes, o grau de confiança e as limitações.

Responda APENAS um array JSON válido, sem markdown:
[
  {
    "titulo": "frase curta da recomendação (máx 100 chars)",
    "descricao": "explicação completa em 2-4 frases",
    "tipo": "comunicacao|posicionamento|campo|juridico|oportunidade|risco|operacional",
    "urgencia": "critica|alta|media|baixa",
    "fatos_utilizados": "quais dados concretos sustentam esta recomendação",
    "regras_aplicadas": "qual lógica ou critério foi usado para chegar a esta conclusão",
    "fontes": "de onde vieram os dados (alertas, monitoramento, demandas, etc.)",
    "confianca": "alta|media|baixa",
    "limitacoes": "o que esta recomendação NÃO considera ou onde pode falhar"
  }
]

Regras:
- Gere entre 3 e 8 recomendações, priorizadas por urgência.
- Baseie-se APENAS nos dados fornecidos. Nunca invente fatos.
- Se as diretrizes não cobrem um tema relevante, recomende definir posição (tipo: "posicionamento").
- Se há alertas negativos sem resposta, recomende ação (tipo: "comunicacao" ou "risco").
- Se há demandas recorrentes sem proposta, aponte (tipo: "campo" ou "oportunidade").
- Se há ativos políticos de alta influência sem contato realizado ou inativos, recomende ação de articulação.
- Se há ativos parceiros em regiões sem propostas, recomende ação de campo nessas regiões.
- Use os dados de ANÁLISE TERRITORIAL para identificar lacunas de cobertura, concentrações, territórios estratégicos e cruzamentos relevantes.
- Cruze ativos × municípios × demandas para encontrar territórios com alta relevância e baixa cobertura operacional.
- Cruze ativos × partido × cargo para mapear a estrutura política territorial.
- Identifique lacunas cadastrais (ativos sem município, sem contato, sem classificação de influência).
- NÃO invente fatos sobre pessoas. Apenas analise os dados fornecidos.
- Cada recomendação deve ser acionável — diga O QUE fazer, não apenas o que observar.
- Confiança "baixa" quando poucos dados sustentam; "alta" quando múltiplas fontes convergem.`;

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  const limited = checkRateLimit(user.id);
  if (limited) return limited;

  const { data: eu } = await supabase
    .from("usuarios_internos")
    .select("papel, campanha_id, campanhas(nome_candidato)")
    .eq("id", user.id)
    .maybeSingle();
  if (!eu) return NextResponse.json({ error: "sem campanha" }, { status: 403 });
  if (!PAPEIS_GERAM.has(eu.papel))
    return NextResponse.json({ error: "sem permissão" }, { status: 403 });

  const ia = await criarClienteIA(supabase);
  if (!ia)
    return NextResponse.json({ error: "Nenhuma chave de IA configurada." }, { status: 400 });

  const campanha = Array.isArray(eu.campanhas) ? eu.campanhas[0] : eu.campanhas;

  const umaSemanaAtras = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [
    alertasRes, demandasRes, concorrentesRes, temasRes, snapshotRes, tarefasRes,
    sinaisConcRes, propostasRes, sinaisCampoRes, ativosRes, ativosTodosRes, historicoAtivosRes,
  ] = await Promise.all([
    supabase.from("alertas").select("texto_ia, created_at")
      .eq("status_envio", "pendente_configuracao")
      .gte("created_at", umaSemanaAtras)
      .order("created_at", { ascending: false }).limit(20),
    supabase.from("demandas_observadas").select("regiao, cidades, tema, demanda")
      .order("created_at", { ascending: false }).limit(30),
    supabase.from("concorrentes").select("nome, partido, pontos_fortes, pontos_fracos, promessas"),
    supabase.from("temas_campanha")
      .select("nome, publicos_alvo, regioes_prioritarias, base_conhecimento_itens(titulo, descricao)")
      .order("ordem").limit(20),
    supabase.from("monitoramento_snapshots")
      .select("analise_ia, created_at")
      .gte("created_at", umaSemanaAtras)
      .order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("tarefas").select("titulo, status, prazo")
      .eq("status", "a_fazer").order("created_at", { ascending: false }).limit(15),
    supabase.from("sinais_concorrentes").select("titulo, tipo, descricao, impacto, concorrentes(nome)")
      .order("created_at", { ascending: false }).limit(20),
    supabase.from("propostas").select("titulo, tema, status")
      .in("status", ["aprovada", "em_revisao"]).order("created_at", { ascending: false }).limit(20),
    supabase.from("sinais_campo").select("tema, frase_representativa, intensidade, perguntas_objecoes, reacao_discurso")
      .order("created_at", { ascending: false }).limit(20),
    supabase.from("ativos_politicos")
      .select("nome, cargo_atual, partido, nivel_influencia, status_campanha, abrangencia, cidade, categorias_ativo_politico(nome, grupo)")
      .eq("campanha_id", eu.campanha_id)
      .in("nivel_influencia", ["muito_alto", "alto"])
      .order("created_at", { ascending: false }).limit(30),
    supabase.from("ativos_politicos")
      .select("id, cidade, partido, nivel_influencia, status_campanha, setor, categorias_ativo_politico(nome)")
      .eq("campanha_id", eu.campanha_id),
    supabase.from("historico_ativos")
      .select("ativo_id")
      .eq("campanha_id", eu.campanha_id),
  ]);

  const temasCtx: TemaComItens[] = (temasRes.data ?? []).map((t) => ({
    nome: t.nome,
    publicos_alvo: t.publicos_alvo ?? [],
    regioes_prioritarias: t.regioes_prioritarias ?? [],
    itens: (Array.isArray(t.base_conhecimento_itens) ? t.base_conhecimento_itens : []) as { titulo: string; descricao: string | null }[],
  }));

  const diretrizes = await obterContextoDiretrizes(supabase, eu.campanha_id);
  const conhecimento = montarContextoConhecimento(temasCtx);

  const alertasTxt = (alertasRes.data ?? [])
    .map((a) => `- ${a.texto_ia ?? "(sem texto)"}`)
    .join("\n") || "(nenhum alerta pendente)";

  const demandasTxt = (demandasRes.data ?? [])
    .map((d) => {
      const cidades = Array.isArray(d.cidades) && d.cidades.length > 0 ? d.cidades.join(", ") : "";
      return `- [${d.tema ?? "sem tema"}] ${d.regiao ?? ""} ${cidades}: ${d.demanda}`;
    })
    .join("\n") || "(nenhuma demanda)";

  const concorrentesTxt = (concorrentesRes.data ?? [])
    .map((c) => `- ${c.nome} (${c.partido ?? "?"}): promessas=${c.promessas ?? "?"} | fortes=${c.pontos_fortes ?? "?"} | fracos=${c.pontos_fracos ?? "?"}`)
    .join("\n") || "(nenhum concorrente)";

  const monitoramentoTxt = snapshotRes.data?.analise_ia
    ? `Último monitoramento (${new Date(snapshotRes.data.created_at).toLocaleDateString("pt-BR")}):\n${JSON.stringify(snapshotRes.data.analise_ia, null, 0).slice(0, 3000)}`
    : "(sem monitoramento recente)";

  const tarefasTxt = (tarefasRes.data ?? [])
    .map((t) => `- ${t.titulo}${t.prazo ? ` (prazo: ${t.prazo})` : ""}`)
    .join("\n") || "(nenhuma tarefa pendente)";

  const sinaisConcTxt = (sinaisConcRes.data ?? [])
    .map((s) => {
      const conc = Array.isArray(s.concorrentes) ? s.concorrentes[0] : s.concorrentes;
      return `- [${s.tipo}] ${conc?.nome ?? "?"}: ${s.titulo}${s.impacto ? ` (impacto: ${s.impacto})` : ""}`;
    })
    .join("\n") || "(nenhum sinal de concorrente)";

  const propostasTxt = (propostasRes.data ?? [])
    .map((p) => `- [${p.status}] ${p.titulo}${p.tema ? ` (tema: ${p.tema})` : ""}`)
    .join("\n") || "(nenhuma proposta ativa)";

  const sinaisCampoTxt = (sinaisCampoRes.data ?? [])
    .map((s) => {
      const partes = [`[${s.intensidade}]`];
      if (s.tema) partes.push(s.tema + ":");
      if (s.frase_representativa) partes.push(`"${s.frase_representativa}"`);
      if (s.reacao_discurso) partes.push(`reação: ${s.reacao_discurso}`);
      if (s.perguntas_objecoes?.length) partes.push(`perguntas: ${s.perguntas_objecoes.join("; ")}`);
      return `- ${partes.join(" ")}`;
    })
    .join("\n") || "(nenhum sinal de campo)";

  const ativosTxt = (ativosRes.data ?? [])
    .map((a) => {
      const cat = Array.isArray(a.categorias_ativo_politico) ? a.categorias_ativo_politico[0] : a.categorias_ativo_politico;
      return `- ${a.nome} (${cat?.nome ?? "?"}, ${a.cargo_atual ?? "sem cargo"}, ${a.partido ?? "sem partido"}) influência=${a.nivel_influencia} status=${a.status_campanha} abrangência=${a.abrangencia}${a.cidade ? ` cidade=${a.cidade}` : ""}`;
    })
    .join("\n") || "(nenhum ativo político de alta influência)";

  // Análise territorial agregada
  const todosAtivos = ativosTodosRes.data ?? [];
  const histAtivos = new Set((historicoAtivosRes.data ?? []).map((h) => h.ativo_id));
  let analiseTerritorial = "";
  if (todosAtivos.length > 0) {
    const porCidade = new Map<string, { total: number; semAcao: number; alta: number; semContato: number }>();
    const porPartido = new Map<string, number>();
    const porStatus = new Map<string, number>();
    const porSetor = new Map<string, number>();
    let semCidade = 0;

    for (const a of todosAtivos) {
      const cidade = (a.cidade as string) || "";
      if (!cidade) { semCidade++; continue; }
      const entry = porCidade.get(cidade) ?? { total: 0, semAcao: 0, alta: 0, semContato: 0 };
      entry.total++;
      if (!histAtivos.has(a.id)) entry.semAcao++;
      if (a.nivel_influencia === "muito_alto" || a.nivel_influencia === "alto") entry.alta++;
      if (a.status_campanha === "identificado" || a.status_campanha === "nao_relacionado") entry.semContato++;
      porCidade.set(cidade, entry);

      if (a.partido) porPartido.set(a.partido as string, (porPartido.get(a.partido as string) ?? 0) + 1);
      porStatus.set(a.status_campanha as string, (porStatus.get(a.status_campanha as string) ?? 0) + 1);
      if (a.setor) porSetor.set(a.setor as string, (porSetor.get(a.setor as string) ?? 0) + 1);
    }

    const cidadeEntries = [...porCidade.entries()].sort((a, b) => b[1].total - a[1].total);
    const top10 = cidadeEntries.slice(0, 10).map(([c, v]) => `  ${c}: ${v.total} ativos (${v.alta} alta influência, ${v.semContato} sem contato, ${v.semAcao} sem ação)`).join("\n");

    const statusTxt = [...porStatus.entries()].map(([s, n]) => `${s}: ${n}`).join(", ");
    const partidoTxt = [...porPartido.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([p, n]) => `${p}: ${n}`).join(", ");
    const setorTxt = [...porSetor.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([s, n]) => `${s}: ${n}`).join(", ");

    const baixaCobertura = cidadeEntries
      .filter(([, v]) => v.total >= 3 && v.semAcao / v.total > 0.6)
      .slice(0, 5)
      .map(([c, v]) => `  ${c}: ${v.total} ativos, ${v.semAcao} sem ação (${Math.round(100 * v.semAcao / v.total)}%)`)
      .join("\n");

    const polos = cidadeEntries
      .filter(([, v]) => v.alta >= 3)
      .slice(0, 5)
      .map(([c, v]) => `  ${c}: ${v.alta} de alta influência`)
      .join("\n");

    analiseTerritorial = [
      `Total de ativos: ${todosAtivos.length} (${semCidade} sem município registrado)`,
      `Status da rede: ${statusTxt}`,
      partidoTxt ? `Distribuição partidária: ${partidoTxt}` : null,
      setorTxt ? `Distribuição por setor: ${setorTxt}` : null,
      top10 ? `Municípios com mais ativos:\n${top10}` : null,
      baixaCobertura ? `ALERTA — Territórios com alta concentração e baixa cobertura operacional:\n${baixaCobertura}` : null,
      polos ? `Polos estratégicos (alta influência):\n${polos}` : null,
    ].filter(Boolean).join("\n");
  }

  const mensagem = [
    `CANDIDATO: ${campanha?.nome_candidato ?? "(não cadastrado)"}`,
    diretrizes || null,
    conhecimento ? `BASE DE CONHECIMENTO:\n${conhecimento}` : null,
    `ALERTAS PENDENTES:\n${alertasTxt}`,
    `DEMANDAS OBSERVADAS:\n${demandasTxt}`,
    `CONCORRENTES:\n${concorrentesTxt}`,
    `SINAIS DE INTELIGÊNCIA CONCORRENTES:\n${sinaisConcTxt}`,
    `PROPOSTAS DA CAMPANHA:\n${propostasTxt}`,
    `SINAIS DE CAMPO:\n${sinaisCampoTxt}`,
    `MONITORAMENTO:\n${monitoramentoTxt}`,
    `TAREFAS PENDENTES:\n${tarefasTxt}`,
    `ATIVOS POLÍTICOS (alta influência):\n${ativosTxt}`,
    analiseTerritorial ? `ANÁLISE TERRITORIAL (dados agregados da rede de ativos):\n${analiseTerritorial}` : null,
  ].filter(Boolean).join("\n\n");

  let raw: string;
  try {
    raw = await ia.gerar({
      sistema: SISTEMA,
      mensagens: [{ role: "user", content: mensagem }],
      maxTokens: 6000,
      jsonMode: true,
    });
  } catch (err) {
    return respostaErroIA(err);
  }

  const arrayParsed = parseJsonArraySeguro(raw);
  const objParsed = !arrayParsed ? parseJsonSeguro(raw) : null;
  const recs: Record<string, unknown>[] = arrayParsed as Record<string, unknown>[]
    ?? (objParsed as Record<string, unknown> & { recomendacoes?: unknown[] })?.recomendacoes as Record<string, unknown>[]
    ?? [];
  if (recs.length === 0) {
    return NextResponse.json({ error: "IA retornou formato inválido", raw: raw.slice(0, 500) }, { status: 502 });
  }

  const registros = recs.map((r) => ({
    campanha_id: eu.campanha_id,
    titulo: String(r.titulo ?? "").slice(0, 200),
    descricao: String(r.descricao ?? ""),
    tipo: String(r.tipo ?? "geral"),
    urgencia: String(r.urgencia ?? "media"),
    fatos_utilizados: r.fatos_utilizados ? String(r.fatos_utilizados) : null,
    regras_aplicadas: r.regras_aplicadas ? String(r.regras_aplicadas) : null,
    fontes: r.fontes ? String(r.fontes) : null,
    confianca: String(r.confianca ?? "media"),
    limitacoes: r.limitacoes ? String(r.limitacoes) : null,
    gerada_por_ia: true,
    provedor_ia: ia.provedor,
    criado_por: user.id,
    status: "aguardando_revisao" as const,
  }));

  const { error } = await supabase.from("recomendacoes").insert(registros);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, total: registros.length });
}
