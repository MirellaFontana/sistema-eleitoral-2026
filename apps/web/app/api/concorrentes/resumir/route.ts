import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { criarClienteIA } from "@/lib/ia-client";

const PAPEIS_QUE_EDITAM = new Set(["coord_campanha", "coord_marketing"]);

const LABEL: Record<string, string> = {
  pontos_fortes: "pontos fortes",
  pontos_fracos: "pontos fracos",
  promessas: "promessas de campanha",
  dossie_mandato: "dossiê do mandato",
  argumentos: "argumentos contra o concorrente",
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const limited = checkRateLimit(user.id);
  if (limited) return limited;

  const { data: eu } = await supabase
    .from("usuarios_internos")
    .select("papel")
    .eq("id", user.id)
    .maybeSingle();
  if (!eu || !PAPEIS_QUE_EDITAM.has(eu.papel))
    return NextResponse.json({ error: "sem permissão" }, { status: 403 });

  const { texto, campo } = (await request.json()) as { texto: string; campo: string };
  if (!texto?.trim()) return NextResponse.json({ error: "texto vazio" }, { status: 400 });

  const ia = await criarClienteIA(supabase);
  if (!ia) return NextResponse.json({ error: "Nenhuma chave de IA configurada." }, { status: 400 });

  const label = LABEL[campo] ?? campo;

  const resumo = await ia.gerar({
    sistema: `Você é analista político brasileiro. Resuma o texto sobre ${label} de um concorrente eleitoral de forma objetiva e concisa. Use **negrito** para destacar os pontos mais importantes. Mantenha itens de lista se houver. Máximo 150 palavras.`,
    mensagens: [{ role: "user", content: texto }],
    maxTokens: 500,
  });

  return NextResponse.json({ resumo: resumo.trim() });
}
