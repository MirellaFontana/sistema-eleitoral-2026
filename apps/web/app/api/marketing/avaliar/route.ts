import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { SISTEMA_AVALIADOR_PECAS } from "@/lib/anthropic";
import { sanitizarTexto } from "@/lib/sanitizar";
import { parseJsonSeguro } from "@/lib/parse-json-seguro";
import { criarClienteIA } from "@/lib/ia-client";

const PAPEIS_QUE_AVALIAM = new Set([
  "coord_campanha",
  "coord_marketing",
  "redator_marketing",
  "advogado_responsavel",
  "assistente_juridico",
]);

export async function POST(request: Request) {
  const body = await request.json();
  const { formato, canal, descricao_peca } = body as {
    formato: string;
    canal: string;
    descricao_peca: string;
  };

  if (!formato || !canal || !descricao_peca?.trim()) {
    return NextResponse.json(
      { error: "formato, canal e descricao_peca são obrigatórios" },
      { status: 400 }
    );
  }

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
      "papel, campanha_id, campanhas(nome_candidato, cargo, uf, partido, numero_candidato, nome_urna, coligacao)"
    )
    .eq("id", user.id)
    .maybeSingle();

  if (!eu || !PAPEIS_QUE_AVALIAM.has(eu.papel)) {
    return NextResponse.json(
      { error: "seu papel não pode solicitar avaliação de peças" },
      { status: 403 }
    );
  }

  const ia = await criarClienteIA(supabase);
  if (!ia) {
    return NextResponse.json(
      { error: "Nenhuma chave de IA configurada. Vá em Cadastro de Campanha > Chaves de API." },
      { status: 400 }
    );
  }

  const campanha = Array.isArray(eu.campanhas) ? eu.campanhas[0] : eu.campanhas;
  const identidadeCtx = campanha
    ? [
        `Candidato: ${campanha.nome_candidato ?? "–"}`,
        `Nome de urna: ${campanha.nome_urna ?? "–"}`,
        `Número: ${campanha.numero_candidato ?? "–"}`,
        `Cargo: ${campanha.cargo ?? "–"} – ${campanha.uf ?? "–"}`,
        `Partido: ${campanha.partido ?? "–"}`,
        `Coligação: ${campanha.coligacao ?? "–"}`,
      ].join("\n")
    : "(identidade da campanha não cadastrada)";

  const mensagemUsuario = [
    `IDENTIDADE DA CAMPANHA:\n${identidadeCtx}`,
    `FORMATO DA PEÇA: ${formato}`,
    `CANAL DE PUBLICAÇÃO: ${canal}`,
    `DESCRIÇÃO / TEXTO DA PEÇA:\n${descricao_peca.trim()}`,
  ].join("\n\n");

  let raw: string;
  try {
    raw = await ia.gerar({
      sistema: SISTEMA_AVALIADOR_PECAS,
      mensagens: [{ role: "user", content: mensagemUsuario }],
      maxTokens: 1800,
      jsonMode: true,
    });
  } catch (err) {
    const m = err instanceof Error ? err.message : "erro desconhecido";
    return NextResponse.json({ error: `Falha ao avaliar peça: ${m}` }, { status: 502 });
  }

  const parsed = parseJsonSeguro(raw);
  if (!parsed) {
    return NextResponse.json(
      { error: "O modelo retornou um formato inesperado. Tente novamente." },
      { status: 502 }
    );
  }

  const { data: row, error } = await supabase
    .from("avaliacoes_pecas")
    .insert({
      campanha_id: eu.campanha_id,
      formato: sanitizarTexto(formato, 200),
      canal: sanitizarTexto(canal, 100),
      descricao_peca: sanitizarTexto(descricao_peca, 5000),
      avaliacao_json: parsed,
      modelo_ia: ia.provedor,
      solicitado_por: user.id,
    })
    .select("id, avaliacao_json, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json(row);
}
