import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sanitizarTexto } from "@/lib/sanitizar";
import { enviarWhatsApp } from "@/lib/whatsapp";

const TABELA_POR_TIPO: Record<string, { tabela: string; colunaTelefone: string }> = {
  cidadao: { tabela: "cidadaos", colunaTelefone: "whatsapp" },
  apoiador: { tabela: "apoiadores", colunaTelefone: "telefone" },
  lideranca: { tabela: "liderancas", colunaTelefone: "telefone" },
};

const PAPEIS_POR_TIPO: Record<string, Set<string>> = {
  cidadao: new Set(["coord_campanha"]),
  apoiador: new Set(["coord_campanha", "coord_marketing"]),
  lideranca: new Set(["coord_campanha", "coord_marketing"]),
};

export async function POST(request: Request) {
  const body = await request.json();
  const { tipo_destinatario, destinatario_id, canal, conteudo } = body as {
    tipo_destinatario: string;
    destinatario_id: string;
    canal: string;
    conteudo: string;
  };

  if (!tipo_destinatario || !destinatario_id || !conteudo?.trim()) {
    return NextResponse.json(
      { error: "tipo_destinatario, destinatario_id e conteudo são obrigatórios" },
      { status: 400 }
    );
  }

  const config = TABELA_POR_TIPO[tipo_destinatario];
  if (!config) {
    return NextResponse.json({ error: "tipo_destinatario inválido" }, { status: 400 });
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
    .select("papel, campanha_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!eu || !PAPEIS_POR_TIPO[tipo_destinatario].has(eu.papel)) {
    return NextResponse.json(
      { error: "seu papel não pode mandar mensagem pra esse tipo de destinatário" },
      { status: 403 }
    );
  }

  // Resolve o telefone com a SESSÃO do próprio usuário (não service_role) — se a RLS da tabela
  // de destino já bloqueia esse papel (ex.: coord_marketing tentando ler cidadaos), a busca
  // simplesmente não acha nada, e a mensagem nem chega a ser montada. Defesa em profundidade,
  // mesma lógica do vínculo cidadao_id em apoiadores (migration 0019).
  const { data: destinatario, error: destinatarioError } = await supabase
    .from(config.tabela)
    .select(`id, ${config.colunaTelefone}`)
    .eq("id", destinatario_id)
    .eq("campanha_id", eu.campanha_id)
    .maybeSingle();

  if (destinatarioError || !destinatario) {
    return NextResponse.json(
      { error: "destinatário não encontrado (ou seu papel não tem acesso a ele)" },
      { status: 400 }
    );
  }

  const telefone = (destinatario as unknown as Record<string, unknown>)[config.colunaTelefone] as string | null;
  const resultado = telefone
    ? await enviarWhatsApp(telefone, conteudo)
    : { ok: false, erro: "destinatário não tem telefone cadastrado" };

  const insertPayload: Record<string, unknown> = {
    campanha_id: eu.campanha_id,
    tipo_destinatario,
    canal: canal || "whatsapp",
    conteudo: sanitizarTexto(conteudo, 5000),
    criado_por: user.id,
    status: resultado.ok
      ? "enviada"
      : process.env.WHATSAPP_API_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID
        ? "falhou"
        : "pendente_configuracao",
    erro_envio: resultado.ok ? null : resultado.erro,
    enviado_em: resultado.ok ? new Date().toISOString() : null,
  };
  insertPayload[`${tipo_destinatario}_id`] = destinatario_id;

  const { data: row, error } = await supabase.from("mensagens").insert(insertPayload).select("*").single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json(row);
}
