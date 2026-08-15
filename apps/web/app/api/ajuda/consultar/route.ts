import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { criarClienteIA, respostaErroIA } from "@/lib/ia-client";
import { SISTEMA_AJUDA_SISTEMA } from "@/lib/anthropic";

export async function POST(request: Request) {
  const { pergunta } = (await request.json()) as { pergunta?: string };
  if (!pergunta?.trim()) {
    return NextResponse.json({ error: "pergunta vazia" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  const limited = checkRateLimit(user.id);
  if (limited) return limited;

  const { data: eu } = await supabase
    .from("usuarios_internos")
    .select("papel")
    .eq("id", user.id)
    .maybeSingle();
  if (!eu) return NextResponse.json({ error: "sem acesso" }, { status: 403 });

  const ia = await criarClienteIA(supabase);
  if (!ia) {
    return NextResponse.json({ error: "Nenhuma chave de IA configurada." }, { status: 400 });
  }

  try {
    const resposta = await ia.gerar({
      sistema: SISTEMA_AJUDA_SISTEMA,
      mensagens: [{ role: "user", content: `Meu papel no sistema: ${eu.papel}\n\nDúvida: ${pergunta.trim()}` }],
      maxTokens: 3000,
    });
    return NextResponse.json({ resposta, provedor: ia.provedor });
  } catch (err) {
    return respostaErroIA(err);
  }
}
