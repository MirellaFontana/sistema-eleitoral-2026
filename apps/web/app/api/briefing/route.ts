import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAnthropicClient, MODELO_IA, SISTEMA_BRIEFING_DIARIO } from "@/lib/anthropic";

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

  const anthropic = createAnthropicClient();
  if (!anthropic) {
    return NextResponse.json(
      { error: "API key da Anthropic ainda não configurada — peça pro administrador configurar ANTHROPIC_API_KEY." },
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
    .select("regiao, cidade, tema, demanda, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  // Base de conhecimento (mesmo limite da rota de sugestão — não explodir tokens).
  const { data: itens } = await supabase
    .from("base_conhecimento_itens")
    .select("titulo, descricao")
    .not("descricao", "is", null)
    .order("titulo")
    .limit(30);

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
      const onde = [d.regiao, d.cidade].filter(Boolean).join(", ");
      return `- [${onde || "região não informada"}]${d.tema ? ` (${d.tema})` : ""} ${d.demanda}`;
    })
    .join("\n");

  const conhecimento = (itens ?? [])
    .map((item) => `### ${item.titulo}\n${item.descricao}`)
    .join("\n\n");

  const mensagemUsuario = [
    `IDENTIDADE DA CAMPANHA:\n${identidade}`,
    `AGENDA DE HOJE (${hojeIso}):\n${blocosEventos}`,
    blocoDemandas
      ? `DEMANDAS OBSERVADAS DA POPULAÇÃO (mais recentes primeiro):\n${blocoDemandas}`
      : "DEMANDAS OBSERVADAS: nenhuma registrada na campanha.",
    conhecimento
      ? `BASE DE CONHECIMENTO DA CAMPANHA (propostas e posições):\n${conhecimento}`
      : "BASE DE CONHECIMENTO: nenhum item cadastrado.",
  ].join("\n\n");

  let conteudo: string;
  try {
    const msg = await anthropic.messages.create({
      model: MODELO_IA,
      max_tokens: 2000,
      system: SISTEMA_BRIEFING_DIARIO,
      messages: [{ role: "user", content: mensagemUsuario }],
    });
    conteudo = msg.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("\n")
      .trim();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "erro desconhecido ao chamar a Anthropic";
    return NextResponse.json({ error: `Falha ao gerar briefing: ${msg}` }, { status: 502 });
  }

  const contextoUsado = `${eventos.length} evento(s) da agenda, ${demandas?.length ?? 0} demanda(s) observada(s), ${vinculos?.length ?? 0} vínculo(s) de liderança, ${itens?.length ?? 0} item(ns) da base de conhecimento`;

  const { data: row, error } = await supabase
    .from("briefings_diarios")
    .insert({
      campanha_id: eu.campanha_id,
      data: hojeIso,
      conteudo,
      contexto_usado: contextoUsado,
      modelo_ia: MODELO_IA,
      gerado_por: user.id,
    })
    .select("id, data, conteudo, contexto_usado, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json(row);
}
