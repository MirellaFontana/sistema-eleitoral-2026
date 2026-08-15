"use client";

import { useState } from "react";
import { Upload, CheckCircle, AlertTriangle } from "lucide-react";

type Categoria = { id: string; nome: string; grupo: string };

type Etapa = "upload" | "mapeamento" | "previa" | "importando" | "concluido";

const CAMPOS_DESTINO = [
  { key: "nome", label: "Nome *", obrigatorio: true },
  { key: "nome_social", label: "Apelido / Nome social", obrigatorio: false },
  { key: "telefone", label: "Telefone", obrigatorio: false },
  { key: "whatsapp", label: "WhatsApp", obrigatorio: false },
  { key: "email", label: "E-mail", obrigatorio: false },
  { key: "cidade", label: "Cidade", obrigatorio: false },
  { key: "estado", label: "Estado (UF)", obrigatorio: false },
  { key: "bairro", label: "Bairro", obrigatorio: false },
  { key: "endereco", label: "Endereço", obrigatorio: false },
  { key: "cargo_atual", label: "Cargo atual", obrigatorio: false },
  { key: "cargo_anterior", label: "Cargo anterior", obrigatorio: false },
  { key: "partido", label: "Partido", obrigatorio: false },
  { key: "entidade", label: "Entidade", obrigatorio: false },
  { key: "setor", label: "Setor", obrigatorio: false },
  { key: "observacoes", label: "Observações", obrigatorio: false },
] as const;

function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { headers: [], rows: [] };

  const sep = lines[0].includes(";") ? ";" : ",";
  const headers = lines[0].split(sep).map((h) => h.trim().replace(/^"|"$/g, ""));

  const rows = lines.slice(1).map((line) => {
    const values = line.split(sep).map((v) => v.trim().replace(/^"|"$/g, ""));
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = values[i] ?? ""; });
    return row;
  });

  return { headers, rows };
}

export function ImportarClient({ categorias }: { categorias: Categoria[] }) {
  const [etapa, setEtapa] = useState<Etapa>("upload");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [mapeamento, setMapeamento] = useState<Record<string, string>>({});
  const [categoriaId, setCategoriaId] = useState("");
  const [resultado, setResultado] = useState({ importados: 0, erros: 0, duplicados: 0 });

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const { headers: h, rows: r } = parseCSV(text);
      setHeaders(h);
      setRows(r);

      const auto: Record<string, string> = {};
      for (const campo of CAMPOS_DESTINO) {
        const match = h.find((col) =>
          col.toLowerCase().replace(/[^a-z]/g, "").includes(campo.key.replace(/_/g, ""))
        );
        if (match) auto[campo.key] = match;
      }
      setMapeamento(auto);
      setEtapa("mapeamento");
    };
    reader.readAsText(file, "UTF-8");
  }

  function handleMapear(campo: string, coluna: string) {
    setMapeamento((prev) => ({ ...prev, [campo]: coluna }));
  }

  function irPrevia() {
    if (!mapeamento.nome || !categoriaId) return;
    setEtapa("previa");
  }

  async function importar() {
    setEtapa("importando");
    let importados = 0;
    let erros = 0;

    const nomesSeen = new Set<string>();
    let duplicados = 0;

    // Buscar nomes existentes no banco para detectar duplicatas cross-import
    const existentesRes = await fetch("/api/ativos-politicos?pagina=1&porPagina=9999");
    const nomesExistentes = new Set<string>();
    if (existentesRes.ok) {
      const data = await existentesRes.json();
      for (const a of data.ativos ?? []) {
        nomesExistentes.add((a.nome as string).toLowerCase());
        if (a.nome_social) nomesExistentes.add((a.nome_social as string).toLowerCase());
      }
    }

    for (const row of rows) {
      const nome = row[mapeamento.nome]?.trim();
      if (!nome) { erros++; continue; }

      const nomeKey = nome.toLowerCase();
      if (nomesSeen.has(nomeKey) || nomesExistentes.has(nomeKey)) { duplicados++; continue; }
      nomesSeen.add(nomeKey);

      const body: Record<string, string | null> = { nome, categoria_id: categoriaId };
      for (const campo of CAMPOS_DESTINO) {
        if (campo.key === "nome") continue;
        const col = mapeamento[campo.key];
        if (col && row[col]?.trim()) body[campo.key] = row[col].trim();
      }

      const res = await fetch("/api/ativos-politicos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) importados++;
      else erros++;
    }

    setResultado({ importados, erros, duplicados });
    setEtapa("concluido");
  }

  const previaRows = rows.slice(0, 5);

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 space-y-6 px-4 py-8">
      <div>
        <h1 className="text-lg font-semibold">Importar Ativos Políticos</h1>
        <p className="text-sm text-neutral-500">
          Importe ativos em massa via arquivo CSV (separado por vírgula ou ponto-e-vírgula).
        </p>
      </div>

      {/* Etapa 1: Upload */}
      {etapa === "upload" && (
        <div className="flex flex-col items-center gap-4 rounded-lg border-2 border-dashed border-neutral-300 p-12">
          <Upload size={32} className="text-neutral-400" />
          <p className="text-sm text-neutral-500">Selecione um arquivo CSV</p>
          <input
            type="file"
            accept=".csv,.txt"
            onChange={handleFile}
            className="text-sm"
          />
        </div>
      )}

      {/* Etapa 2: Mapeamento */}
      {etapa === "mapeamento" && (
        <div className="space-y-4">
          <p className="text-sm text-neutral-600">
            {rows.length} linhas encontradas. Mapeie as colunas do arquivo para os campos do sistema.
          </p>

          <label className="block space-y-1">
            <span className="text-xs font-medium text-neutral-500">Categoria para todos os importados *</span>
            <select
              value={categoriaId}
              onChange={(e) => setCategoriaId(e.target.value)}
              className="w-full max-w-xs rounded border px-2.5 py-1.5 text-sm"
            >
              <option value="">Selecione</option>
              {categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </label>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {CAMPOS_DESTINO.map((campo) => (
              <label key={campo.key} className="space-y-1">
                <span className="text-xs font-medium text-neutral-500">{campo.label}</span>
                <select
                  value={mapeamento[campo.key] ?? ""}
                  onChange={(e) => handleMapear(campo.key, e.target.value)}
                  className="w-full rounded border px-2.5 py-1.5 text-sm"
                >
                  <option value="">{campo.obrigatorio ? "— Obrigatório —" : "— Ignorar —"}</option>
                  {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                </select>
              </label>
            ))}
          </div>

          <button
            onClick={irPrevia}
            disabled={!mapeamento.nome || !categoriaId}
            className="rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
          >
            Pré-visualizar
          </button>
        </div>
      )}

      {/* Etapa 3: Prévia */}
      {etapa === "previa" && (
        <div className="space-y-4">
          <p className="text-sm text-neutral-600">
            Prévia das primeiras {previaRows.length} de {rows.length} linhas:
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-left font-medium uppercase tracking-wide text-neutral-400">
                  {CAMPOS_DESTINO.filter((c) => mapeamento[c.key]).map((c) => (
                    <th key={c.key} className="pb-1 pr-3">{c.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previaRows.map((row, i) => (
                  <tr key={i} className="border-b border-neutral-100">
                    {CAMPOS_DESTINO.filter((c) => mapeamento[c.key]).map((c) => (
                      <td key={c.key} className="py-1 pr-3 text-neutral-700">
                        {row[mapeamento[c.key]] || "—"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setEtapa("mapeamento")}
              className="rounded border px-4 py-2 text-sm hover:bg-neutral-50"
            >
              Voltar
            </button>
            <button
              onClick={importar}
              className="rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
            >
              Importar {rows.length} registros
            </button>
          </div>
        </div>
      )}

      {/* Etapa 4: Importando */}
      {etapa === "importando" && (
        <div className="flex flex-col items-center gap-4 py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-900" />
          <p className="text-sm text-neutral-500">Importando registros…</p>
        </div>
      )}

      {/* Etapa 5: Concluído */}
      {etapa === "concluido" && (
        <div className="space-y-4 rounded-lg border border-neutral-200 p-6">
          <div className="flex items-center gap-2">
            <CheckCircle size={20} className="text-emerald-500" />
            <h2 className="font-semibold">Importação concluída</h2>
          </div>
          <ul className="space-y-1 text-sm">
            <li className="text-emerald-700">
              {resultado.importados} registro(s) importado(s) com sucesso
            </li>
            {resultado.duplicados > 0 && (
              <li className="flex items-center gap-1 text-amber-700">
                <AlertTriangle size={14} />
                {resultado.duplicados} duplicata(s) ignorada(s) (mesmo nome)
              </li>
            )}
            {resultado.erros > 0 && (
              <li className="text-rose-700">{resultado.erros} erro(s)</li>
            )}
          </ul>
          <a
            href="/ativos-politicos/lista"
            className="inline-block rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
          >
            Ver lista de ativos
          </a>
        </div>
      )}
    </main>
  );
}
