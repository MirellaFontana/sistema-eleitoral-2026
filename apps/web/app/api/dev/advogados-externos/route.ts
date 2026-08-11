import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  const { email, nome, senha } = (await request.json()) as {
    email: string;
    nome: string;
    senha: string;
  };

  if (!email || !nome || !senha) {
    return NextResponse.json({ error: "email, nome e senha são obrigatórios" }, { status: 400 });
  }

  if (senha.length < 6) {
    return NextResponse.json({ error: "senha deve ter ao menos 6 caracteres" }, { status: 400 });
  }

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  }

  const { data: isDev } = await supabase.rpc("is_dev_plataforma");
  if (isDev !== true) {
    return NextResponse.json({ error: "acesso restrito" }, { status: 403 });
  }

  const admin = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const { data: created, error: authError } = await admin.auth.admin.createUser({
    email: email.trim().toLowerCase(),
    password: senha,
    email_confirm: true,
    user_metadata: { nome },
  });

  if (authError || !created.user) {
    return NextResponse.json(
      { error: authError?.message ?? "falha ao criar conta" },
      { status: 400 },
    );
  }

  const { error: insertError } = await admin.from("advogados_externos").insert({
    email: email.trim().toLowerCase(),
    nome: nome.trim(),
  });

  if (insertError) {
    await admin.auth.admin.deleteUser(created.user.id);
    return NextResponse.json({ error: insertError.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
