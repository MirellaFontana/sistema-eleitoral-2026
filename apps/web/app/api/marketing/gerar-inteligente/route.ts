import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { SISTEMA_GERADOR_PECAS } from "@/lib/anthropic";
import { criarClienteIA, respostaErroIA } from "@/lib/ia-client";
import { carregarContexto, montarMensagemContexto } from "@/lib/contexto-campanha";
import { parseJsonSeguro } from "@/lib/parse-json-seguro";

const PAPEIS_QUE_GERAM = new Set(["coord_campanha", "coord_marketing", "redator_marketing"]);

const SISTEMA_DESCOBERTA = `Você é um estrategista de comunicação de campanha eleitoral brasileira.
Recebe dados do monitoramento (notícias, alertas), demandas observadas da população, sinais de campo,
movimentações de concorrentes e a base de propostas do candidato.

Sua função é ENCONTRAR A MELHOR OPORTUNIDADE DE COMUNICAÇÃO do momento — o tema que, se virar
conteúdo agora, tem mais potencial de engajamento e relevância eleitoral.

Responda APENAS em JSON válido com esta estrutura:
{
  "oportunidade": "descrição curta da oportunidade encontrada (1-2 frases)",
  "fonte": "monitoramento|demanda|sinal_campo|concorrente|proposta",
  "tema": "nome do tema que se relaciona com essa oportunidade",
  "publico_alvo": "público específico mais impactado (ex: mães da região sul, produtores rurais)",
  "angulo": "o ângulo/hook que o conteúdo deve usar",
  "urgencia": "alta|media|baixa",
  "proposta_relacionada": "proposta do candidato que responde a essa oportunidade (copie da base)",
  "justificativa": "por que esse tema agora e não outro (2-3 frases)"
}

Critérios de priorização:
1. Recência: temas do monitoramento dos últimos dias valem mais
2. Resonância: demandas que afetam mais pessoas
3. Exclusividade: temas onde o candidato tem proposta e os concorrentes não
4. Timing: assuntos em alta na mídia agora
5. Viabilidade: o candidato TEM algo concreto a dizer (está na base de conhecimento)

Se não houver nenhuma oportunidade clara, retorne {"oportunidade": null}.`;

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  const limited = checkRateLimit(user.id);
  if (limited) return limited;

  const { data: eu } = await supabase
    .from("usuarios_internos")
    .select("papel, campanha_id, campanhas(nome_candidato, cargo, uf, partido, numero_candidato, nome_urna, cnpj_campanha, coligacao, voz_candidato)")
    .eq("id", user.id)
    .maybeSingle();

  if (!eu || !PAPEIS_QUE_GERAM.has(eu.papel)) {
    return NextResponse.json({ error: "sem permissão" }, { status: 403 });
  }

  const ia = await criarClienteIA(supabase);
  if (!ia) {
    return NextResponse.json({ error: "Nenhuma chave de IA configurada." }, { status: 400 });
  }

  const campanha = Array.isArray(eu.campanhas) ? eu.campanhas[0] : eu.campanhas;

  const ctx = await carregarContexto(supabase, eu.campanha_id, ["identidade", "voz", "diretrizes", "temas", "concorrentes", "demandas"], campanha);

  const [snapshotsRes, alertasRes, sinaisCampoRes, sinaisConcRes] = await Promise.all([
    supabase
      .from("monitoramento_snapshots")
      .select("termo, resultados_json, analise_ia, created_at")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("alertas")
      .select("titulo, descricao, severidade, created_at")
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("sinais_campo")
      .select("tema, frase_representativa, intensidade, local_descricao, created_at")
      .in("intensidade", ["forte", "moderada"])
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("sinais_concorrentes")
      .select("titulo, descricao, concorrentes(nome), created_at")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const monitoramento = (snapshotsRes.data ?? []).map((s) => {
    const analise = typeof s.analise_ia === "string" ? s.analise_ia.slice(0, 500) : "";
    return `[${s.termo}] ${analise}`;
  }).join("\n") || "(sem monitoramento recente)";

  const alertas = (alertasRes.data ?? []).map((a) =>
    `- [${a.severidade}] ${a.titulo}: ${a.descricao?.slice(0, 200) ?? ""}`,
  ).join("\n") || "(sem alertas)";

  const sinaisCampo = (sinaisCampoRes.data ?? []).map((s) =>
    `- [${s.intensidade}] ${s.tema ?? ""}: ${s.frase_representativa ?? s.local_descricao ?? ""}`,
  ).join("\n") || "(sem sinais de campo)";

  const sinaisConcorrentes = (sinaisConcRes.data ?? []).map((s) => {
    const nome = Array.isArray(s.concorrentes) ? (s.concorrentes[0] as { nome: string } | undefined)?.nome : (s.concorrentes as { nome: string } | null)?.nome;
    return `- ${nome ? `[${nome}] ` : ""}${s.titulo}`;
  }).join("\n") || "(sem sinais de concorrentes)";

  // PASSO 1: Descobrir oportunidade
  const ctxDescoberta = montarMensagemContexto(ctx, [
    `MONITORAMENTO RECENTE:\n${monitoramento}`,
    `ALERTAS ATIVOS:\n${alertas}`,
    `SINAIS DE CAMPO:\n${sinaisCampo}`,
    `MOVIMENTAÇÕES DOS CONCORRENTES:\n${sinaisConcorrentes}`,
  ]);

  let rawDescoberta: string;
  try {
    rawDescoberta = await ia.gerar({
      sistema: SISTEMA_DESCOBERTA,
      mensagens: [{ role: "user", content: ctxDescoberta }],
      maxTokens: 1000,
      jsonMode: true,
    });
  } catch (err) {
    return respostaErroIA(err);
  }

  const descoberta = parseJsonSeguro(rawDescoberta);
  if (!descoberta || !descoberta.oportunidade) {
    return NextResponse.json({
      oportunidade: null,
      mensagem: "Nenhuma oportunidade de comunicação identificada no momento. Cadastre mais dados no monitoramento, demandas ou sinais de campo.",
    });
  }

  // PASSO 2: Gerar conteúdo multi-formato baseado na oportunidade
  const formatos = ["post", "stories", "whatsapp", "carrossel"];

  const pecas = await Promise.all(
    formatos.map(async (fmt) => {
      const msg = montarMensagemContexto(ctx, [
        `OPORTUNIDADE DE COMUNICAÇÃO IDENTIFICADA:\n${descoberta.oportunidade}`,
        `PÚBLICO-ALVO PRIORITÁRIO: ${descoberta.publico_alvo}`,
        `ÂNGULO/HOOK: ${descoberta.angulo}`,
        `PROPOSTA RELACIONADA: ${descoberta.proposta_relacionada ?? "usar base geral"}`,
        `FORMATO PEDIDO: ${fmt}`,
      ]);

      try {
        const sugestao = await ia.gerar({
          sistema: SISTEMA_GERADOR_PECAS,
          mensagens: [{ role: "user", content: msg }],
          maxTokens: 2000,
        });
        return { formato: fmt, sugestao, erro: null };
      } catch (err) {
        return { formato: fmt, sugestao: null, erro: err instanceof Error ? err.message : "erro" };
      }
    }),
  );

  // PASSO 3: Salvar tudo no banco
  const pecasValidas = pecas.filter((p) => p.sugestao);
  if (pecasValidas.length > 0) {
    await supabase.from("sugestoes_conteudo").insert(
      pecasValidas.map((p) => ({
        campanha_id: eu.campanha_id,
        formato: p.formato,
        contexto_usado: `Geração inteligente: ${descoberta.oportunidade}`,
        modelo_ia: ia.provedor,
        sugestao: p.sugestao!,
        solicitado_por: user.id,
      })),
    );
  }

  return NextResponse.json({
    oportunidade: descoberta,
    pecas: pecas.map((p) => ({ formato: p.formato, sugestao: p.sugestao, erro: p.erro })),
  });
}
