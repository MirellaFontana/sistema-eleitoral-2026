import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Item = {
  id: string;
  titulo: string;
  descricao: string;
  tipo: string;
  urgencia: string;
  fonte: string;
  porqueEstouVendo: string;
  link?: string;
};

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const { data: eu } = await supabase
    .from("usuarios_internos")
    .select("papel, campanha_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!eu) return NextResponse.json({ error: "sem campanha" }, { status: 403 });

  const hoje = new Date();
  const hojeIso = hoje.toISOString().slice(0, 10);
  const em3dias = new Date(hoje.getTime() + 3 * 86_400_000).toISOString().slice(0, 10);
  const ontem = new Date(hoje.getTime() - 86_400_000).toISOString();

  const [
    recsRes, alertasRes, tarefasRes, prazosRes, diretrizesRes,
    snapshotRes, recsRecentesRes, demandasRes, sinaisCampoRes, decisoesRes, fontesRes, normativasRes, recsAvaliadasRes,
  ] = await Promise.all([
    supabase.from("recomendacoes")
      .select("id, titulo, descricao, tipo, urgencia, status, fatos_utilizados, confianca")
      .in("status", ["aguardando_revisao", "aprovada", "convertida_acao"])
      .order("created_at", { ascending: false }).limit(20),
    supabase.from("alertas")
      .select("id, texto_ia, created_at")
      .eq("status_envio", "pendente_configuracao")
      .order("created_at", { ascending: false }).limit(10),
    supabase.from("tarefas")
      .select("id, titulo, prioridade, prazo")
      .eq("status", "a_fazer")
      .order("prioridade").order("prazo").limit(10),
    supabase.from("prazos_eleitorais")
      .select("data, titulo")
      .gte("data", hojeIso).lte("data", em3dias)
      .order("data").limit(5),
    supabase.from("diretrizes_posicoes")
      .select("id, tema_livre, status, temas_campanha(nome)")
      .eq("status", "sem_definicao").limit(5),
    supabase.from("monitoramento_snapshots")
      .select("analise_ia, created_at")
      .gte("created_at", ontem)
      .order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("recomendacoes")
      .select("id, titulo, tipo, urgencia, created_at")
      .gte("created_at", ontem)
      .order("created_at", { ascending: false }).limit(5),
    supabase.from("demandas_observadas")
      .select("id, tema, demanda, prioridade, status")
      .in("status", ["registrada", "em_analise"])
      .order("created_at", { ascending: false }).limit(5),
    supabase.from("sinais_campo")
      .select("id, tema, frase_representativa, intensidade, created_at")
      .eq("intensidade", "forte")
      .gte("created_at", new Date(hoje.getTime() - 3 * 86_400_000).toISOString())
      .order("created_at", { ascending: false }).limit(5),
    supabase.from("decisoes")
      .select("id, titulo, status, acao_planejada, prazo, resultado")
      .in("status", ["decidida", "em_execucao"])
      .order("updated_at", { ascending: false }).limit(5),
    supabase.from("fontes_monitoramento")
      .select("id, nome, falhas_consecutivas, ultimo_acesso_em")
      .eq("ativo", true)
      .gte("falhas_consecutivas", 3)
      .limit(5),
    supabase.from("fontes_normativas")
      .select("id, titulo, data_verificacao")
      .eq("status", "desatualizada")
      .limit(5),
    supabase.from("recomendacoes")
      .select("id, titulo, resultado_texto, avaliacao_qualidade, updated_at")
      .eq("status", "resultado_avaliado")
      .gte("updated_at", ontem)
      .order("updated_at", { ascending: false }).limit(5),
  ]);

  const recs = recsRes.data ?? [];
  const alertas = alertasRes.data ?? [];
  const tarefas = tarefasRes.data ?? [];
  const prazos = prazosRes.data ?? [];
  const diretSemDef = diretrizesRes.data ?? [];
  const snapshot = snapshotRes.data;
  const recsRecentes = recsRecentesRes.data ?? [];
  const demandasPendentes = demandasRes.data ?? [];
  const sinaisFortes = sinaisCampoRes.data ?? [];
  const decisoesAtivas = decisoesRes.data ?? [];
  const fontesComProblema = fontesRes.data ?? [];
  const normativasDesatualizadas = normativasRes.data ?? [];
  const recsAvaliadas = recsAvaliadasRes.data ?? [];

  const decidaAgora: Item[] = recs
    .filter((r) => r.urgencia === "critica" || r.status === "aguardando_revisao")
    .slice(0, 5)
    .map((r) => ({
      id: `rec-${r.id}`,
      titulo: r.titulo,
      descricao: r.descricao,
      tipo: r.tipo,
      urgencia: r.urgencia,
      fonte: "Recomendação IA",
      porqueEstouVendo: r.fatos_utilizados
        ? `Baseada em: ${r.fatos_utilizados.slice(0, 200)}`
        : `Recomendação com urgência ${r.urgencia} aguardando sua revisão (confiança: ${r.confianca}).`,
      link: "/recomendacoes",
    }));

  const facaHoje: Item[] = [];
  for (const t of tarefas.slice(0, 5)) {
    const prazoTxt = t.prazo
      ? `Prazo: ${new Date(t.prazo + "T12:00:00").toLocaleDateString("pt-BR")}`
      : "";
    facaHoje.push({
      id: `tar-${t.id}`,
      titulo: t.titulo,
      descricao: prazoTxt,
      tipo: "tarefa",
      urgencia: t.prioridade === "urgente" ? "alta" : "media",
      fonte: "Tarefas",
      porqueEstouVendo: t.prioridade === "urgente"
        ? "Tarefa marcada como urgente e ainda a fazer."
        : "Tarefa pendente na sua lista.",
      link: "/tarefas",
    });
  }
  for (const p of prazos) {
    const dias = Math.round((new Date(p.data + "T12:00:00").getTime() - hoje.getTime()) / 86_400_000);
    facaHoje.push({
      id: `prazo-${p.data}`,
      titulo: p.titulo,
      descricao: dias === 0 ? "É hoje!" : `Faltam ${dias} dia${dias === 1 ? "" : "s"}`,
      tipo: "prazo",
      urgencia: dias <= 1 ? "critica" : "alta",
      fonte: "Calendário eleitoral",
      porqueEstouVendo: `Prazo eleitoral em ${dias <= 0 ? "hoje" : dias + " dias"} — requer atenção imediata.`,
      link: "/calendario-eleitoral",
    });
  }

  for (const dec of decisoesAtivas) {
    const prazoTxt = dec.prazo
      ? `Prazo: ${new Date(dec.prazo + "T12:00:00").toLocaleDateString("pt-BR")}`
      : "";
    facaHoje.push({
      id: `dec-${dec.id}`,
      titulo: dec.titulo,
      descricao: dec.acao_planejada ?? prazoTxt,
      tipo: "decisao",
      urgencia: dec.status === "em_execucao" ? "alta" : "media",
      fonte: "Decisões",
      porqueEstouVendo: dec.status === "em_execucao"
        ? "Decisão em execução aguardando registro de resultado."
        : "Decisão tomada com ação pendente de execução.",
      link: "/decisoes",
    });
  }

  const fiqueAtento: Item[] = [];
  for (const a of alertas.slice(0, 5)) {
    fiqueAtento.push({
      id: `alr-${a.id}`,
      titulo: a.texto_ia ?? "Alerta sem texto",
      descricao: "",
      tipo: "alerta",
      urgencia: "media",
      fonte: "Alertas",
      porqueEstouVendo: "Alerta gerado pelo monitoramento de menções e ainda pendente de revisão.",
      link: "/alertas",
    });
  }
  for (const d of diretSemDef) {
    const tema = Array.isArray(d.temas_campanha)
      ? (d.temas_campanha[0] as { nome: string } | undefined)?.nome
      : (d.temas_campanha as { nome: string } | null)?.nome;
    const nome = tema ?? d.tema_livre ?? "?";
    fiqueAtento.push({
      id: `dir-${d.id}`,
      titulo: `Posição sem definição: ${nome}`,
      descricao: "A campanha não definiu posição sobre este tema.",
      tipo: "diretriz",
      urgencia: "baixa",
      fonte: "Diretrizes",
      porqueEstouVendo: "Este tema aparece nas diretrizes sem posição definida — a IA pode tratar inconsistentemente.",
      link: "/diretrizes",
    });
  }
  for (const r of recs.filter((r) => r.tipo === "risco")) {
    fiqueAtento.push({
      id: `risco-${r.id}`,
      titulo: r.titulo,
      descricao: r.descricao,
      tipo: "risco",
      urgencia: r.urgencia,
      fonte: "Recomendação IA",
      porqueEstouVendo: r.fatos_utilizados ?? "Risco identificado pela análise de IA.",
      link: "/recomendacoes",
    });
  }
  for (const dem of demandasPendentes) {
    fiqueAtento.push({
      id: `dem-${dem.id}`,
      titulo: `Demanda: ${dem.tema ?? "sem tema"}`,
      descricao: dem.demanda.slice(0, 150),
      tipo: "demanda",
      urgencia: dem.prioridade === "critica" ? "critica" : "media",
      fonte: "Demandas",
      porqueEstouVendo: `Demanda com status "${dem.status}" e prioridade ${dem.prioridade} aguardando ação.`,
      link: "/demandas-observadas",
    });
  }
  for (const sc of sinaisFortes) {
    fiqueAtento.push({
      id: `sc-${sc.id}`,
      titulo: sc.frase_representativa ?? `Sinal forte: ${sc.tema ?? "campo"}`,
      descricao: sc.tema ? `Tema: ${sc.tema}` : "",
      tipo: "campo",
      urgencia: "alta",
      fonte: "Escuta de campo",
      porqueEstouVendo: `Sinal de campo com intensidade forte nos últimos 3 dias${sc.tema ? ` sobre "${sc.tema}"` : ""}.`,
      link: "/campo",
    });
  }

  for (const n of normativasDesatualizadas) {
    fiqueAtento.push({
      id: `norm-${n.id}`,
      titulo: `Norma alterada: ${n.titulo}`,
      descricao: n.data_verificacao ? `Verificada em ${new Date(n.data_verificacao + "T12:00:00").toLocaleDateString("pt-BR")}` : "",
      tipo: "normativa",
      urgencia: "alta",
      fonte: "Base normativa",
      porqueEstouVendo: `A fonte normativa "${n.titulo}" foi detectada como alterada — o conteúdo pode ter mudado desde a última validação.`,
      link: "/base-normativa",
    });
  }

  for (const f of fontesComProblema) {
    fiqueAtento.push({
      id: `fonte-${f.id}`,
      titulo: `Fonte fora do ar: ${f.nome}`,
      descricao: `${f.falhas_consecutivas} falhas consecutivas`,
      tipo: "fonte",
      urgencia: f.falhas_consecutivas >= 5 ? "critica" : "alta",
      fonte: "Fontes de monitoramento",
      porqueEstouVendo: `A fonte "${f.nome}" está com ${f.falhas_consecutivas} falhas consecutivas — os dados de monitoramento podem estar desatualizados.`,
      link: "/monitoramento",
    });
  }

  const oQueMudou: Item[] = [];
  if (snapshot?.analise_ia) {
    const dt = new Date(snapshot.created_at).toLocaleDateString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    const analise = snapshot.analise_ia as Record<string, unknown>;
    const resumo = typeof analise.resumo === "string" ? analise.resumo : "Novo snapshot de monitoramento disponível.";
    oQueMudou.push({
      id: "snap-ultimo",
      titulo: `Monitoramento atualizado (${dt})`,
      descricao: resumo.slice(0, 200),
      tipo: "monitoramento",
      urgencia: "media",
      fonte: "Monitoramento",
      porqueEstouVendo: "Novo snapshot de monitoramento nas últimas 24h.",
      link: "/monitoramento",
    });
  }
  for (const r of recsRecentes) {
    if (decidaAgora.some((d) => d.id === `rec-${r.id}`)) continue;
    oQueMudou.push({
      id: `recnew-${r.id}`,
      titulo: r.titulo,
      descricao: `Gerada ${new Date(r.created_at).toLocaleDateString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`,
      tipo: r.tipo,
      urgencia: r.urgencia,
      fonte: "Recomendação nova",
      porqueEstouVendo: "Recomendação gerada nas últimas 24h.",
      link: "/recomendacoes",
    });
  }

  for (const ra of recsAvaliadas) {
    const qualidade = ra.avaliacao_qualidade as string | null;
    const emoji = qualidade === "sucesso" ? "Sucesso" : qualidade === "parcial" ? "Parcial" : qualidade === "falha" ? "Falha" : "Avaliada";
    oQueMudou.push({
      id: `recav-${ra.id}`,
      titulo: `${emoji}: ${ra.titulo}`,
      descricao: ra.resultado_texto?.slice(0, 150) ?? "",
      tipo: "resultado",
      urgencia: qualidade === "falha" ? "alta" : "media",
      fonte: "Resultado de recomendação",
      porqueEstouVendo: `Recomendação avaliada nas últimas 24h com resultado "${qualidade ?? "sem avaliação"}".`,
      link: "/recomendacoes",
    });
  }

  return NextResponse.json({ decidaAgora, facaHoje, fiqueAtento, oQueMudou });
}
