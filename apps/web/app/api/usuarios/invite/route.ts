import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Cria a conta de auth do usuário convidado (precisa de service_role — não existe caminho
// client-side pra isso) e depois insere a linha em usuarios_internos usando a SESSÃO de quem
// convidou, não o client admin. Assim o INSERT em si continua sob a RLS já testada no Módulo 1:
// se quem chamar não for coord_campanha da própria campanha, o INSERT falha por policy, igual
// falharia clicando direto no banco.
export async function POST(request: Request) {
  const body = await request.json();
  const { email, nome, telefone, papel, territorio_id, exige_mfa, expira_em } = body as {
    email: string;
    nome: string;
    telefone: string | null;
    papel: string;
    territorio_id: string | null;
    exige_mfa: boolean;
    expira_em: string | null;
  };

  if (!email || !nome || !papel || !telefone) {
    return NextResponse.json({ error: "email, nome, telefone e papel são obrigatórios" }, { status: 400 });
  }

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  }

  const { data: quemChamou } = await supabase
    .from("usuarios_internos")
    .select("papel, campanha_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!quemChamou || quemChamou.papel !== "coord_campanha") {
    return NextResponse.json(
      { error: "só coord_campanha pode convidar novos usuários" },
      { status: 403 }
    );
  }

  const admin = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email);

  if (inviteError || !invited.user) {
    return NextResponse.json(
      { error: inviteError?.message ?? "falha ao convidar usuário" },
      { status: 400 }
    );
  }

  const { error: insertError } = await supabase.from("usuarios_internos").insert({
    id: invited.user.id,
    campanha_id: quemChamou.campanha_id,
    papel,
    nome,
    telefone: telefone || null,
    territorio_id: territorio_id || null,
    exige_mfa: !!exige_mfa,
    expira_em: expira_em || null,
  });

  if (insertError) {
    // Convite de auth já foi criado, mas o registro interno falhou (ex.: papel embaixador sem
    // território). Não deixamos usuário "fantasma": removemos a conta de auth recém-criada.
    await admin.auth.admin.deleteUser(invited.user.id);
    return NextResponse.json({ error: insertError.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
