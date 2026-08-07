import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  SISTEMA_BRIEFING_DIARIO,
  montarContextoConhecimento,
  type TemaComItens,
} from "@/lib/anthropic";
import { criarClienteIA } from "@/lib/ia-client";
import { obterContextoDiretrizes } from "@/lib/diretrizes-context";

// Quem pode gerar direto pelo papel (candidato é o dono do briefing; coordenação prepara
// pra ele). Outros papéis passam pela permissão delegável 'usar_ia' (migration 0040).
const PAPEIS_DIRETOS = new Set(["candidato", "coord_campanha"]);

const TIPO_EVENTO_LABEL: Record<string, string> = {
  caminhada: "Caminhada",
  reuniao: "Reunião",
  comicio: "Comício",
  carreata: "Carreata",
  entrevista: "Entrevista",
  agenda_interna: "Agenda interna",
  outro: "Evento",
};

function horaLocal(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  }
  const limited = checkRateLimit(user.id);
  if (limited) return limited;

  const { data: eu } = await supabase
    .from("usuarios_internos")
    .select(
      "papel, campanha_id, campanhas(nome_candidato, cargo, uf, partido, numero_candidato, nome_urna)"
    )
    .eq("id", user.id)
    .maybeSingle();

  if (!eu) {
    return NextResponse.json({ error: "usuário sem vínculo de campanha" }, { status: 403 });
  }

  if (!PAPEIS_DIRETOS.has(eu.papel)) {
    const { data: podeIa } = await supabase.rpc("has_permission", { p: "usar_ia" });
    if (!podeIa) {
      return NextResponse.json(
        { error: "sua função não tem permissão para gerar briefing" },
        { status: 403 }
      );
    }
  }

  // Eventos de hoje (dia local do servidor, mesmo critério do dashboard).
  const hoje = new Date();
  const inicioDia = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const fimDia = new Date(inicioDia.getTime() + 86_400_000);
  const hojeIso = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;

  const { data: eventos, error: errEventos } = await supabase
    .from("eventos_campanha")
    .select(
      "id, titulo, tipo, status, data_inicio, data_fim, local_texto, descricao, publico_estimado, territorios(nome_bairro, zona_eleitoral)"
    )
    .gte("data_inicio", inicioDia.toISOString())
    .lt("data_inicio", fimDia.toISOString())
    .neq("status", "cancelado")
    .order("data_inicio");

  if (errEventos) {
    return NextResponse.json({ error: errEventos.message }, { status: 400 });
  }

  if (!eventos || eventos.length === 0) {
    return NextResponse.json({ semEventos: true, data: hojeIso });
  }

  const ia = await criarClienteIA(supabase);
  if (!ia) {
    return NextResponse.json(
      { error: "Nenhuma chave de IA configurada. Vá em Cadastro de Campanha > Chaves de API e configure Anthropic, OpenAI ou Gemini." },
      { status: 400 }
    );
  }

  // Lideranças vinculadas aos eventos do dia.
  const { data: vinculos } = await supabase
    .from("eventos_liderancas")
    .select("evento_id, liderancas(nome, bairro, cidade)")
    .in(
      "evento_id",
      eventos.map((e) => e.id)
    );

  // Demandas recentes da campanha (todas as regiões — o modelo seleciona as relevantes
  // por evento e indica a origem quando usar demanda de outra região).
  const { data: demandas } = await supabase
    .from("demandas_observadas")
    .select("regiao, cidades, tema, demanda, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  // Sinais de campo recentes (intensidade forte/moderada dos últimos 3 dias).
  const tresDiasAtras = new Date(hoje.getTime() - 3 * 86_400_000).toISOString();
  const { data: sinaisCampo } = await supabase
    .from("sinais_campo")
    .select("tema, frase_representativa, intensidade, local_descricao, created_at")
    .in("intensidade", ["forte", "moderada"])
    .gte("created_at", tresDiasAtras)
    .order("created_at", { ascending: false })
    .limit(15);

  // Sinais recentes de concorrentes.
  const { data: sinaisConcorrentes } = await supabase
    .from("sinais_concorrentes")
    .select("titulo, descricao, concorrentes(nome), created_at")
    .gte("created_at", tresDiasAtras)
    .order("created_at", { ascending: false })
    .limit(10);

  // Temas + itens agrupados — público-alvo e regiões prioritárias enriquecem o contexto.
  const { data: temasDb } = await supabase
    .from("temas_campanha")
    .select("id, nome, publicos_alvo, regioes_prioritarias, base_conhecimento_itens(titulo, descricao)")
    .order("ordem")
    .limit(30);

  const temasCtx: TemaComItens[] = (temasDb ?? []).map((t) => ({
    nome: t.nome,
    publicos_alvo: t.publicos_alvo ?? [],
    regioes_prioritarias: t.regioes_prioritarias ?? [],
    itens: (Array.isArray(t.base_conhecimento_itens) ? t.base_conhecimento_itens : []) as { titulo: string; descricao: string | null }[],
  }));

  const campanha = Array.isArray(eu.campanhas) ? eu.campanhas[0] : eu.campanhas;

  const identidade = [
    `Candidato: ${campanha?.nome_candidato ?? "–"} (${campanha?.nome_urna ?? "–"}, nº ${campanha?.numero_candidato ?? "–"})`,
    `Cargo: ${campanha?.cargo ?? "–"} – ${campanha?.uf ?? "–"} | Partido: ${campanha?.partido ?? "–"}`,
  ].join("\n");

  const liderancasPorEvento = new Map<string, string[]>();
  for (const v of vinculos ?? []) {
    const l = Array.isArray(v.liderancas) ? v.liderancas[0] : v.liderancas;
    if (!l) continue;
    const onde = [l.bairro, l.cidade].filter(Boolean).join(", ");
    const linha = onde ? `${l.nome} (${onde})` : l.nome;
    const lista = liderancasPorEvento.get(v.evento_id) ?? [];
    lista.push(linha);
    liderancasPorEvento.set(v.evento_id, lista);
  }

  const blocosEventos = eventos
    .map((e) => {
      const t = Array.isArray(e.territorios) ? e.territorios[0] : e.territorios;
      const regiao = [t?.nome_bairro, t?.zona_eleitoral ? `zona ${t.zona_eleitoral}` : null]
        .filter(Boolean)
        .join(", ");
      const liderancas = liderancasPorEvento.get(e.id) ?? [];
      return [
        `- ${horaLocal(e.data_inicio)} | ${TIPO_EVENTO_LABEL[e.tipo] ?? e.tipo}: ${e.titulo}`,
        `  Região: ${regiao || "não informada"} | Local: ${e.local_texto ?? "não informado"}`,
        e.publico_estimado != null ? `  Público estimado: ${e.publico_estimado}` : null,
        e.descricao ? `  Descrição: ${e.descricao}` : null,
        `  Lideranças vinculadas: ${liderancas.length > 0 ? liderancas.join("; ") : "nenhuma vinculada"}`,
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n");

  const blocoDemandas = (demandas ?? [])
    .map((d) => {
      const cidadesTxt = Array.isArray(d.cidades) && d.cidades.length > 0 ? d.cidades.join(", ") : null;
      const onde = [d.regiao, cidadesTxt].filter(Boolean).join(", ");
      return `- [${onde || "região não informada"}]${d.tema ? ` (${d.tema})` : ""} ${d.demanda}`;
    })
    .join("\n");

  const conhecimento = montarContextoConhecimento(temasCtx);
  const diretrizes = await obterContextoDiretrizes(supabase, eu.campanha_id);

  const mensagemUsuario = [
    `IDENTIDADE DA CAMPANHA:\n${identidade}`,
    diretrizes || null,
    `AGENDA DE HOJE (${hojeIso}):\n${blocosEventos}`,
    blocoDemandas
      ? `DEMANDAS OBSERVADAS DA POPULAÇÃO (mais recentes primeiro):\n${blocoDemandas}`
      : "DEMANDAS OBSERVADAS: nenhuma registrada na campanha.",
    conhecimento
      ? `BASE DE CONHECIMENTO DA CAMPANHA (propostas, posições, público-alvo e regiões por tema):\n${conhecimento}`
      : "BASE DE CONHECIMENTO: nenhum item cadastrado.",
    (sinaisCampo ?? []).length > 0
      ? `SINAIS DE CAMPO (últimos 3 dias, intensidade forte/moderada):\n${(sinaisCampo ?? []).map((s) => `- [${s.intensidade}] ${s.tema ? `(${s.tema}) ` : ""}${s.frase_representativa ?? s.local_descricao ?? "sem detalhe"}`).join("\n")}`
      : null,
    (sinaisConcorrentes ?? []).length > 0
      ? `MOVIMENTAÇÕES DOS CONCORRENTES (últimos 3 dias):\n${(sinaisConcorrentes ?? []).map((s) => { const nome = Array.isArray(s.concorrentes) ? (s.concorrentes[0] as { nome: string } | undefined)?.nome : (s.concorrentes as { nome: string } | null)?.nome; return `- ${nome ? `[${nome}] ` : ""}${s.titulo}${s.descricao ? `: ${s.descricao.slice(0, 200)}` : ""}`; }).join("\n")}`
      : null,
  ].filter(Boolean).join("\n\n");

  let conteudo: string;
  try {
    conteudo = await ia.gerar({
      sistema: SISTEMA_BRIEFING_DIARIO,
      mensagens: [{ role: "user", content: mensagemUsuario }],
      maxTokens: 4000,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "erro desconhecido ao chamar IA";
    return NextResponse.json({ error: `Falha ao gerar briefing: ${msg}` }, { status: 502 });
  }

  const contextoUsado = `${eventos.length} evento(s) da agenda, ${demandas?.length ?? 0} demanda(s) observada(s), ${vinculos?.length ?? 0} vínculo(s) de liderança, ${temasCtx.reduce((n, t) => n + t.itens.length, 0)} item(ns) da base de conhecimento em ${temasCtx.length} tema(s), ${(sinaisCampo ?? []).length} sinal(is) de campo, ${(sinaisConcorrentes ?? []).length} sinal(is) de concorrentes`;

  const { data: row, error } = await supabase
    .from("briefings_diarios")
    .insert({
      campanha_id: eu.campanha_id,
      data: hojeIso,
      conteudo,
      contexto_usado: contextoUsado,
      modelo_ia: ia.provedor,
      gerado_por: user.id,
    })
    .select("id, data, conteudo, contexto_usado, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json(row);
}
