"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { interpretarCsvFontes, limparDominio } from "@/lib/csv-fontes";
import { Download, FileSpreadsheet, Globe } from "lucide-react";

type Fonte = {
  id: string;
  dominio: string;
  nome: string;
  tier: string;
  regiao: string | null;
  ativo: boolean;
};

const TIER_LABEL: Record<string, { label: string; cls: string }> = {
  tier1_megafone: { label: "Megafone", cls: "bg-red-100 text-red-700" },
  tier1_politica: { label: "Política", cls: "bg-purple-100 text-purple-700" },
  tier1_cbn: { label: "CBN", cls: "bg-blue-100 text-blue-700" },
  tier2_regional: { label: "Regional", cls: "bg-neutral-100 text-neutral-600" },
};

const TIER_OPTIONS = [
  { value: "tier1_megafone", label: "Tier 1 — Megafone" },
  { value: "tier1_politica", label: "Tier 1 — Política" },
  { value: "tier1_cbn", label: "Tier 1 — CBN" },
  { value: "tier2_regional", label: "Tier 2 — Regional" },
];

const MODELO_CSV = `dominio;nome;tier;regiao
portalexemplo.com.br;Portal Exemplo;regional;Curitiba / RMC
radioexemplo.com.br;Rádio Exemplo;cbn;Norte / Londrina
blogexemplo.com.br;Blog Exemplo;politica;Estadual`;

export function FontesPanel({
  campanhaId,
  fontes: fontesIniciais,
  podeEditar,
}: {
  campanhaId: string;
  fontes: Fonte[];
  podeEditar: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [fontes, setFontes] = useState(fontesIniciais);
  const [importando, setImportando] = useState(false);
  const [msgImport, setMsgImport] = useState<string | null>(null);
  const [filtroTier, setFiltroTier] = useState<string>("");
  const [novoDominio, setNovoDominio] = useState("");
  const [novoNome, setNovoNome] = useState("");
  const [novoTier, setNovoTier] = useState("tier2_regional");
  const [novaRegiao, setNovaRegiao] = useState("");
  const [adicionando, setAdicionando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aberto, setAberto] = useState(false);
  const inputCsvRef = useRef<HTMLInputElement>(null);

  async function recarregarFontes() {
    const { data } = await supabase
      .from("fontes_monitoramento")
      .select("id, dominio, nome, tier, regiao, ativo")
      .order("tier")
      .order("nome");
    if (data) setFontes(data);
  }

  async function importarPR() {
    setImportando(true);
    setMsgImport(null);
    const res = await fetch("/api/monitoramento/fontes/seed", { method: "POST" });
    const data = await res.json();
    setImportando(false);
    if (!res.ok) {
      setMsgImport(`Erro: ${data.error}`);
      return;
    }
    setMsgImport(`${data.importados} fonte(s) importada(s) de ${data.total}.`);
    setTimeout(() => setMsgImport(null), 4000);
    await recarregarFontes();
    router.refresh();
  }

  async function importarCsv(file: File) {
    setImportando(true);
    setMsgImport(null);
    setErro(null);
    try {
      const texto = await file.text();
      const fontesCsv = interpretarCsvFontes(texto);
      if (fontesCsv.length === 0) {
        throw new Error("Nenhuma linha válida encontrada (o domínio precisa ter um ponto, ex.: site.com.br).");
      }

      const { data, error } = await supabase
        .from("fontes_monitoramento")
        .upsert(
          fontesCsv.map((f) => ({ campanha_id: campanhaId, ...f })),
          { onConflict: "campanha_id,dominio", ignoreDuplicates: true },
        )
        .select("id");

      if (error) throw new Error(error.message);

      const novas = data?.length ?? 0;
      const jaExistiam = fontesCsv.length - novas;
      setMsgImport(
        `${novas} fonte(s) importada(s)` +
          (jaExistiam > 0 ? `, ${jaExistiam} já existia(m)` : "") +
          ".",
      );
      await recarregarFontes();
      router.refresh();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao importar o arquivo.");
    } finally {
      setImportando(false);
    }
  }

  function baixarModelo() {
    const blob = new Blob([MODELO_CSV], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "modelo-fontes-monitoramento.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function toggleAtivo(id: string, ativo: boolean) {
    await supabase.from("fontes_monitoramento").update({ ativo: !ativo }).eq("id", id);
    setFontes(fontes.map((f) => (f.id === id ? { ...f, ativo: !ativo } : f)));
  }

  async function remover(id: string) {
    await supabase.from("fontes_monitoramento").delete().eq("id", id);
    setFontes(fontes.filter((f) => f.id !== id));
  }

  async function adicionar() {
    if (!novoDominio.trim() || !novoNome.trim()) return;
    setAdicionando(true);
    setErro(null);
    const { data, error } = await supabase
      .from("fontes_monitoramento")
      .insert({
        campanha_id: campanhaId,
        dominio: limparDominio(novoDominio),
        nome: novoNome.trim(),
        tier: novoTier,
        regiao: novaRegiao.trim() || null,
      })
      .select("id, dominio, nome, tier, regiao, ativo")
      .single();
    setAdicionando(false);
    if (error) { setErro(error.message); return; }
    setFontes([data, ...fontes]);
    setNovoDominio("");
    setNovoNome("");
    setNovaRegiao("");
  }

  const fontesFiltradas = filtroTier
    ? fontes.filter((f) => f.tier === filtroTier)
    : fontes;

  const porTier = new Map<string, Fonte[]>();
  for (const f of fontesFiltradas) {
    const lista = porTier.get(f.tier) ?? [];
    lista.push(f);
    porTier.set(f.tier, lista);
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          <Globe size={14} className="text-indigo-500" />
          Fontes monitoradas ({fontes.filter((f) => f.ativo).length} ativas)
        </h2>
        <button
          type="button"
          onClick={() => setAberto(!aberto)}
          className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
        >
          {aberto ? "Fechar" : "Gerenciar"}
        </button>
      </div>

      {!aberto && (
        <div className="flex flex-wrap gap-1">
          {Object.entries(TIER_LABEL).map(([tier, { label, cls }]) => {
            const count = fontes.filter((f) => f.tier === tier && f.ativo).length;
            if (count === 0) return null;
            return (
              <span key={tier} className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
                {label}: {count}
              </span>
            );
          })}
          {fontes.length === 0 && (
            <p className="text-xs text-neutral-400">
              Nenhuma fonte cadastrada — abra &quot;Gerenciar&quot; para importar uma planilha.
            </p>
          )}
        </div>
      )}

      {aberto && (
        <div className="space-y-3 rounded-lg border border-neutral-200 bg-white p-3">
          {podeEditar && (
            <div className="space-y-2 rounded border border-dashed border-indigo-200 bg-indigo-50/40 p-3">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-indigo-900">
                <FileSpreadsheet size={13} />
                Importar planilha de sites
              </p>
              <p className="text-xs text-neutral-500">
                CSV com colunas <code className="rounded bg-white px-1">dominio;nome;tier;regiao</code> — exporte
                do Excel ou Google Sheets como CSV. Tier aceita: megafone, politica, cbn ou regional.
              </p>
              <input
                ref={inputCsvRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) importarCsv(f);
                  e.target.value = "";
                }}
              />
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => inputCsvRef.current?.click()}
                  disabled={importando}
                  className="rounded bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {importando ? "Importando…" : "Escolher arquivo CSV"}
                </button>
                <button
                  onClick={baixarModelo}
                  className="flex items-center gap-1 rounded bg-white px-3 py-1.5 text-xs text-neutral-600 border border-neutral-200 hover:bg-neutral-50"
                >
                  <Download size={12} />
                  Baixar modelo
                </button>
                <button
                  onClick={importarPR}
                  disabled={importando}
                  className="rounded bg-white px-3 py-1.5 text-xs text-neutral-600 border border-neutral-200 hover:bg-neutral-50 disabled:opacity-50"
                >
                  {importando ? "…" : "Lista pronta do Paraná (55 sites)"}
                </button>
              </div>
              {msgImport && <p className="text-xs font-medium text-green-700">{msgImport}</p>}
              {erro && <p className="text-xs text-red-600">{erro}</p>}
            </div>
          )}

          {podeEditar && (
            <div className="space-y-2 border-t border-neutral-100 pt-2">
              <p className="text-xs font-medium text-neutral-500">Adicionar fonte manualmente</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <input
                  placeholder="Domínio"
                  value={novoDominio}
                  onChange={(e) => setNovoDominio(e.target.value)}
                  className="rounded border border-neutral-300 px-2 py-1 text-xs"
                />
                <input
                  placeholder="Nome"
                  value={novoNome}
                  onChange={(e) => setNovoNome(e.target.value)}
                  className="rounded border border-neutral-300 px-2 py-1 text-xs"
                />
                <select
                  value={novoTier}
                  onChange={(e) => setNovoTier(e.target.value)}
                  className="rounded border border-neutral-300 px-2 py-1 text-xs"
                >
                  {TIER_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                <div className="flex gap-1">
                  <input
                    placeholder="Região"
                    value={novaRegiao}
                    onChange={(e) => setNovaRegiao(e.target.value)}
                    className="w-full rounded border border-neutral-300 px-2 py-1 text-xs"
                  />
                  <button
                    onClick={adicionar}
                    disabled={adicionando || !novoDominio.trim() || !novoNome.trim()}
                    className="rounded bg-indigo-600 px-2 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50 whitespace-nowrap"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-1 border-t border-neutral-100 pt-2">
            <button
              onClick={() => setFiltroTier("")}
              className={`rounded-full px-2 py-0.5 text-xs ${!filtroTier ? "bg-indigo-600 text-white" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"}`}
            >
              Todas
            </button>
            {TIER_OPTIONS.map((o) => (
              <button
                key={o.value}
                onClick={() => setFiltroTier(o.value)}
                className={`rounded-full px-2 py-0.5 text-xs ${filtroTier === o.value ? "bg-indigo-600 text-white" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"}`}
              >
                {o.label.replace("Tier 1 — ", "").replace("Tier 2 — ", "")}
              </button>
            ))}
          </div>

          <div className="max-h-72 overflow-y-auto space-y-1">
            {Array.from(porTier.entries()).map(([tier, lista]) => (
              <div key={tier} className="space-y-1">
                <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mt-2">
                  {TIER_LABEL[tier]?.label ?? tier} ({lista.length})
                </p>
                {lista.map((f) => (
                  <div
                    key={f.id}
                    className={`flex items-center gap-2 rounded px-2 py-1 text-xs ${f.ativo ? "" : "opacity-40"}`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${f.ativo ? "bg-green-500" : "bg-neutral-300"}`} />
                    <span className="font-medium truncate flex-1" title={f.dominio}>
                      {f.nome}
                    </span>
                    <span className="text-neutral-400 truncate max-w-32" title={f.dominio}>
                      {f.dominio}
                    </span>
                    {f.regiao && (
                      <span className="text-neutral-400 hidden sm:inline">{f.regiao}</span>
                    )}
                    {podeEditar && (
                      <>
                        <button
                          onClick={() => toggleAtivo(f.id, f.ativo)}
                          className="text-neutral-400 hover:text-neutral-700"
                          title={f.ativo ? "Desativar" : "Ativar"}
                        >
                          {f.ativo ? "desativar" : "ativar"}
                        </button>
                        <button
                          onClick={() => remover(f.id)}
                          className="text-red-400 hover:text-red-600"
                          title="Remover"
                        >
                          x
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>

          {fontesFiltradas.length === 0 && (
            <p className="text-xs text-neutral-400">Nenhuma fonte neste filtro.</p>
          )}
        </div>
      )}
    </section>
  );
}
