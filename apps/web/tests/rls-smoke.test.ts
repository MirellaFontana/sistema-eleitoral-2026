// Smoke de RLS: um cliente ANÔNIMO (chave anon, sem sessão) não pode ler nenhuma
// tabela sensível. Se qualquer um desses asserts falhar, dados de campanha estão
// vazando publicamente — é o teste mais importante do sistema.
//
// Roda contra o Supabase real do .env.local. Se as envs não existirem (ex.: CI sem
// segredos), os testes são pulados em vez de falhar.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

function carregarEnvLocal(): Record<string, string> {
  try {
    const raw = readFileSync(join(__dirname, "..", ".env.local"), "utf8");
    const vars: Record<string, string> = {};
    for (const linha of raw.split(/\r?\n/)) {
      const m = linha.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (m) vars[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
    }
    return vars;
  } catch {
    return {};
  }
}

const env = carregarEnvLocal();
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const TABELAS_SENSIVEIS = [
  "usuarios_internos",
  "campanhas",
  "cidadaos",
  "apoiadores",
  "liderancas",
  "mensagens",
  "demandas_observadas",
  "sinais_campo",
  "briefings_diarios",
  "diretrizes_campanha",
  "recomendacoes",
  "decisoes",
  "chaves_api_campanha",
  "auditoria",
];

describe.skipIf(!url || !anonKey)("RLS — cliente anônimo", () => {
  const anon = createClient(url!, anonKey!);

  for (const tabela of TABELAS_SENSIVEIS) {
    it(`não lê ${tabela}`, async () => {
      const { data, error } = await anon.from(tabela).select("*").limit(1);
      // Aceitável: erro de permissão OU resultado vazio. Inaceitável: linhas voltando.
      if (error) return;
      expect(data).toEqual([]);
    });
  }

  it("não insere em demandas_observadas", async () => {
    const { error } = await anon
      .from("demandas_observadas")
      .insert({ demanda: "teste rls anonimo" });
    expect(error).not.toBeNull();
  });

  it("não lê o bucket demandas-anexos", async () => {
    const { data, error } = await anon.storage.from("demandas-anexos").list();
    if (error) return;
    expect(data ?? []).toEqual([]);
  });
});
