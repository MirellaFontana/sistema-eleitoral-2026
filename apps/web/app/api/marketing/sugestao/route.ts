import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAnthropicClient, MODELO_IA, SISTEMA_GERADOR_PECAS } from "@/lib/anthropic";

const PAPEIS_QUE_GERAM = new Set(["coord_campanha", "coord_marketing", "redator_marketing"]);

export async function POST(request: Request) {
  const body = await request.json();
  const { formato, foco } = body as { formato: string; foco?: string };

  if (!formato) {
    return NextResponse.json({ error: "formato é obrigatório" }, { status: 400 });
  }

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
      "papel, campanha_id, campanhas(nome_candidato, cargo, uf, partido, numero_candidato, nome_urna, cnpj_campanha, coligacao)"
    )
    .eq("id", user.id)
    .maybeSingle();

  if (!eu || !PAPEIS_QUE_GERAM.has(eu.papel)) {
    return NextResponse.json({ error: "seu papel não gera sugestão de conteúdo" }, { status: 403 });
  }

  const anthropic = createAnthropicClient();
  if (!anthropic) {
    return NextResponse.json(
      { error: "API key da Anthropic ainda não configurada — peça pro administrador configurar ANTHROPIC_API_KEY." },
      { status: 400 }
    );
  }

  // Busca base de conhecimento automaticamente (até 30 itens para não explodir tokens)
  const { data: itens } = await supabase
    .from("base_conhecimento_itens")
    .select("titulo, descricao")
    .not("descricao", "is", null)
    .order("titulo")
    .limit(30);

  const campanha = Array.isArray(eu.campanhas) ? eu.campanhas[0] : eu.campanhas;

  const identidade = [
    `Candidato: ${campanha?.nome_candidato ?? "–"}`,
    `Nome de urna: ${campanha?.nome_urna ?? "–"}`,
    `Número: ${campanha?.numero_candidato ?? "–"}`,
    `Cargo: ${campanha?.cargo ?? "–"} – ${campanha?.uf ?? "–"}`,
    `Partido: ${campanha?.partido ?? "–"}`,
    `Coligação: ${campanha?.coligacao ?? "–"}`,
    `CNPJ da campanha: ${campanha?.cnpj_campanha ?? "–"}`,
  ].join("\n");

  const conhecimento = (itens ?? [])
    .map((item) => `### ${item.titulo}\n${item.descricao}`)
    .join("\n\n");

  const mensagemUsuario = [
    `IDENTIDADE DA CAMPANHA:\n${identidade}`,
    conhecimento ? `BASE DE CONHECIMENTO DA CAMPANHA:\n${conhecimento}` : "",
    `FORMATO PEDIDO: ${formato}`,
    foco?.trim() ? `FOCO / TEMA ESPECÍFICO: ${foco.trim()}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  let sugestao: string;
  try {
    const msg = await anthropic.messages.create({
      model: MODELO_IA,
      max_tokens: 1500,
      system: SISTEMA_GERADOR_PECAS,
      messages: [{ role: "user", content: mensagemUsuario }],
    });
    sugestao = msg.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("\n")
      .trim();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "erro desconhecido ao chamar a Anthropic";
    return NextResponse.json({ error: `Falha ao gerar sugestão: ${msg}` }, { status: 502 });
  }

  const contextoAuditoria = foco?.trim()
    ? `Foco: ${foco.trim()}`
    : "(gerado automaticamente a partir da base de conhecimento)";

  const { data: row, error } = await supabase
    .from("sugestoes_conteudo")
    .insert({
      campanha_id: eu.campanha_id,
      formato,
      contexto_usado: contextoAuditoria,
      modelo_ia: MODELO_IA,
      sugestao,
      solicitado_por: user.id,
    })
    .select("id, sugestao, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json(row);
}
