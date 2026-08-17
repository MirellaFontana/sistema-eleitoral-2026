import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { SISTEMA_BRIEFING_DIARIO } from "@/lib/anthropic";
import { criarClienteIA, respostaErroIA } from "@/lib/ia-client";
import { carregarContexto } from "@/lib/contexto-campanha";
import { hojeBR, inicioDiasAtrasBR } from "@/lib/fuso";

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
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
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

  const hojeIso = hojeBR();
  const inicioDia = new Date(`${hojeIso}T00:00:00-03:00`);
  const fimDia = new Date(inicioDia.getTime() + 86_400_000);

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
  const tresDiasAtras = inicioDiasAtrasBR(3);
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

  const campanha = Array.isArray(eu.campanhas) ? eu.campanhas[0] : eu.campanhas;
  const ctx = await carregarContexto(supabase, eu.campanha_id, ["identidade", "diretrizes", "temas"], campanha);

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

  const mensagemUsuario = [
    ctx.identidade ? `IDENTIDADE DA CAMPANHA:\n${ctx.identidade}` : null,
    ctx.diretrizes || null,
    `AGENDA DE HOJE (${hojeIso}):\n${blocosEventos}`,
    blocoDemandas
      ? `DEMANDAS OBSERVADAS DA POPULAÇÃO (mais recentes primeiro):\n${blocoDemandas}`
      : "DEMANDAS OBSERVADAS: nenhuma registrada na campanha.",
    ctx.temas
      ? `BASE DE CONHECIMENTO DA CAMPANHA (propostas, posições, público-alvo e regiões por tema):\n${ctx.temas}`
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
    return respostaErroIA(err);
  }

  const contextoUsado = `${eventos.length} evento(s) da agenda, ${demandas?.length ?? 0} demanda(s) observada(s), ${vinculos?.length ?? 0} vínculo(s) de liderança, base de conhecimento carregada, ${(sinaisCampo ?? []).length} sinal(is) de campo, ${(sinaisConcorrentes ?? []).length} sinal(is) de concorrentes`;

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
