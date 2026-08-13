import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { verificarCronAuth } from "@/lib/cron-auth";

export async function GET(request: Request) {
  const authErr = verificarCronAuth(request);
  if (authErr) return authErr;

  const supabase = createServiceClient();

  const { data: configs } = await supabase
    .from("configuracoes_retencao")
    .select("tabela, dias_retencao, acao")
    .eq("ativo", true)
    .neq("acao", "manter");

  if (!configs || configs.length === 0) {
    return NextResponse.json({ message: "nenhuma regra ativa" });
  }

  const TABELAS_PERMITIDAS = new Set(["cidadaos", "mensagens", "log_auditoria", "consentimentos_lgpd"]);
  const resultados: { tabela: string; acao: string; afetados: number; erro?: string }[] = [];

  for (const cfg of configs) {
    if (!TABELAS_PERMITIDAS.has(cfg.tabela)) {
      resultados.push({ tabela: cfg.tabela, acao: cfg.acao, afetados: 0, erro: "tabela não permitida para retenção automática" });
      continue;
    }
    const limite = new Date(Date.now() - cfg.dias_retencao * 86_400_000).toISOString();

    try {
      if (cfg.acao === "excluir") {
        const { count } = await supabase
          .from(cfg.tabela)
          .delete({ count: "exact" })
          .lt("created_at", limite);
        resultados.push({ tabela: cfg.tabela, acao: "excluir", afetados: count ?? 0 });
      } else if (cfg.acao === "anonimizar" && cfg.tabela === "cidadaos") {
        const { data: antigos } = await supabase
          .from("cidadaos")
          .select("id")
          .lt("created_at", limite)
          .limit(500);

        if (antigos && antigos.length > 0) {
          const ids = antigos.map((r) => r.id);
          const { count } = await supabase
            .from("cidadaos")
            .update({ nome: "***", telefone: null, email: null, endereco: null })
            .in("id", ids);
          resultados.push({ tabela: cfg.tabela, acao: "anonimizar", afetados: count ?? antigos.length });
        } else {
          resultados.push({ tabela: cfg.tabela, acao: "anonimizar", afetados: 0 });
        }
      } else {
        resultados.push({ tabela: cfg.tabela, acao: cfg.acao, afetados: 0, erro: "ação não implementada para esta tabela" });
      }
    } catch (e) {
      resultados.push({ tabela: cfg.tabela, acao: cfg.acao, afetados: 0, erro: String(e) });
    }
  }

  return NextResponse.json({ resultados });
}
