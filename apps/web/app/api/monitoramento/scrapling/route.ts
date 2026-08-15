import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { exec } from "child_process";
import { resolve } from "path";

const PAPEIS_QUE_EXECUTAM = new Set([
  "coord_campanha",
  "advogado_responsavel",
  "assistente_juridico",
  "coord_marketing",
  "redator_marketing",
]);

export async function POST() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const { data: eu } = await supabase
    .from("usuarios_internos")
    .select("papel, campanha_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!eu || !PAPEIS_QUE_EXECUTAM.has(eu.papel)) {
    return NextResponse.json({ error: "sem permissão" }, { status: 403 });
  }

  const scriptDir = resolve(process.cwd(), "..", "..", "scripts", "monitoramento");
  const scriptPath = resolve(scriptDir, "scraper.py");
  const cmd = `python "${scriptPath}" --campanha ${eu.campanha_id}`;

  return new Promise<NextResponse>((resolvePromise) => {
    exec(cmd, { timeout: 120_000, cwd: scriptDir }, (error, stdout, stderr) => {
      if (error) {
        resolvePromise(
          NextResponse.json(
            { ok: false, erro: error.message, saida: stderr || stdout },
            { status: 500 },
          ),
        );
        return;
      }
      resolvePromise(NextResponse.json({ ok: true, saida: stdout }));
    });
  });
}
