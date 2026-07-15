import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAnthropicClient, MODELO_IA, SISTEMA_ANALISE_CAMPANHA } from "@/lib/anthropic";

const PAPEIS_QUE_GERAM = new Set(["coord_campanha", "coord_marketing", "redator_marketing"]);

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
    .select("papel, campanha_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!eu || !PAPEIS_QUE_GERAM.has(eu.papel)) {
    return NextResponse.json({ error: "seu papel não gera análise de campanha" }, { status: 403 });
  }

  const anthropic = createAnthropicClient();
  if (!anthropic) {
    return NextResponse.json(
      { error: "API key da Anthropic ainda não configurada — peça pro administrador configurar ANTHROPIC_API_KEY." },
      { status: 400 }
    );
  }

  const [propostasRes, concorrentesRes, demandasRes] = await Promise.all([
    supabase.from("base_conhecimento_itens").select("titulo, descricao").not("descricao", "is", null),
    supabase.from("concorrentes").select("nome, partido, pontos_fortes, pontos_fracos, promessas"),
    supabase.from("demandas_observadas").select("regiao, cidade, tema, demanda"),
  ]);

  const propostasTxt = (propostasRes.data ?? [])
    .map((p) => `- ${p.titulo}: ${p.descricao}`)
    .join("\n") || "(nenhuma proposta com texto cadastrada ainda)";

  const concorrentesTxt = (concorrentesRes.data ?? [])
    .map((c) => `- ${c.nome} (${c.partido ?? "sem partido"}): promessas: ${c.promessas ?? "?"} | pontos fortes: ${c.pontos_fortes ?? "?"} | pontos fracos: ${c.pontos_fracos ?? "?"}`)
    .join("\n") || "(nenhum concorrente cadastrado ainda)";

  const demandasTxt = (demandasRes.data ?? [])
    .map((d) => `- [${d.tema ?? "sem tema"}] ${d.regiao ?? ""} ${d.cidade ?? ""}: ${d.demanda}`)
    .join("\n") || "(nenhuma demanda observada cadastrada ainda)";

  const contexto = `PROPOSTAS DA CAMPANHA (base de conhecimento):\n${propostasTxt}\n\nCONCORRENTES:\n${concorrentesTxt}\n\nDEMANDAS OBSERVADAS:\n${demandasTxt}`;

  let analise: string;
  try {
    const msg = await anthropic.messages.create({
      model: MODELO_IA,
      max_tokens: 1500,
      system: SISTEMA_ANALISE_CAMPANHA,
      messages: [{ role: "user", content: contexto }],
    });
    analise = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("\n").trim();
  } catch (err) {
    const mensagem = err instanceof Error ? err.message : "erro desconhecido ao chamar a Anthropic";
    return NextResponse.json({ error: `Falha ao gerar análise: ${mensagem}` }, { status: 502 });
  }

  const { data: row, error } = await supabase
    .from("analises_campanha")
    .insert({
      campanha_id: eu.campanha_id,
      tipo: "pontos_cegos",
      analise,
      modelo_ia: MODELO_IA,
    })
    .select("id, analise, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json(row);
}
