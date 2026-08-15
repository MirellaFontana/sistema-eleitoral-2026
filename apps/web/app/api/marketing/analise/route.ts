import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  SISTEMA_ANALISE_CAMPANHA,
  montarContextoConhecimento,
  type TemaComItens,
} from "@/lib/anthropic";
import { criarClienteIA, respostaErroIA } from "@/lib/ia-client";
import { obterContextoDiretrizes } from "@/lib/diretrizes-context";

const PAPEIS_QUE_GERAM = new Set(["coord_campanha", "coord_marketing", "redator_marketing"]);

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
    .select("papel, campanha_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!eu || !PAPEIS_QUE_GERAM.has(eu.papel)) {
    return NextResponse.json({ error: "seu papel não gera análise de campanha" }, { status: 403 });
  }

  const ia = await criarClienteIA(supabase);
  if (!ia) {
    return NextResponse.json(
      { error: "Nenhuma chave de IA configurada. Vá em Cadastro de Campanha > Chaves de API." },
      { status: 400 }
    );
  }

  const [temasRes, concorrentesRes, demandasRes] = await Promise.all([
    supabase
      .from("temas_campanha")
      .select("id, nome, publicos_alvo, regioes_prioritarias, base_conhecimento_itens(titulo, descricao)")
      .order("ordem"),
    supabase.from("concorrentes").select("nome, partido, pontos_fortes, pontos_fracos, promessas"),
    supabase.from("demandas_observadas").select("regiao, cidades, tema, demanda"),
  ]);

  const temasCtx: TemaComItens[] = (temasRes.data ?? []).map((t) => ({
    nome: t.nome,
    publicos_alvo: t.publicos_alvo ?? [],
    regioes_prioritarias: t.regioes_prioritarias ?? [],
    itens: (Array.isArray(t.base_conhecimento_itens) ? t.base_conhecimento_itens : []) as { titulo: string; descricao: string | null }[],
  }));

  const propostasTxt = montarContextoConhecimento(temasCtx)
    || "(nenhuma proposta com texto cadastrada ainda)";

  const concorrentesTxt = (concorrentesRes.data ?? [])
    .map((c) => `- ${c.nome} (${c.partido ?? "sem partido"}): promessas: ${c.promessas ?? "?"} | pontos fortes: ${c.pontos_fortes ?? "?"} | pontos fracos: ${c.pontos_fracos ?? "?"}`)
    .join("\n") || "(nenhum concorrente cadastrado ainda)";

  const demandasTxt = (demandasRes.data ?? [])
    .map((d) => {
      const cidadesTxt = Array.isArray(d.cidades) && d.cidades.length > 0 ? d.cidades.join(", ") : "";
      return `- [${d.tema ?? "sem tema"}] ${d.regiao ?? ""} ${cidadesTxt}: ${d.demanda}`;
    })
    .join("\n") || "(nenhuma demanda observada cadastrada ainda)";

  const diretrizes = await obterContextoDiretrizes(supabase, eu.campanha_id);
  const contexto = [
    diretrizes || null,
    `PROPOSTAS DA CAMPANHA (público-alvo e regiões por tema):\n${propostasTxt}`,
    `CONCORRENTES:\n${concorrentesTxt}`,
    `DEMANDAS OBSERVADAS:\n${demandasTxt}`,
  ].filter(Boolean).join("\n\n");

  let analise: string;
  try {
    analise = await ia.gerar({
      sistema: SISTEMA_ANALISE_CAMPANHA,
      mensagens: [{ role: "user", content: contexto }],
      maxTokens: 1500,
    });
  } catch (err) {
    return respostaErroIA(err);
  }

  const { data: row, error } = await supabase
    .from("analises_campanha")
    .insert({
      campanha_id: eu.campanha_id,
      tipo: "pontos_cegos",
      analise,
      modelo_ia: ia.provedor,
    })
    .select("id, analise, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json(row);
}
