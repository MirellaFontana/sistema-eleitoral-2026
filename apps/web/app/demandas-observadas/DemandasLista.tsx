"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Mic, Image, FileText, File, Paperclip } from "lucide-react";

type Demanda = {
  id: string;
  regiao: string | null;
  cidades: string[] | null;
  tema: string | null;
  demanda: string;
  status: string;
  prioridade: string;
  responsavel_id: string | null;
  encaminhamento: string | null;
  resposta: string | null;
  origem: string | null;
  prazo: string | null;
  devolutiva: string | null;
  anexos: string[] | null;
  palavras_chave: string[] | null;
  created_at: string;
};

function iconeAnexo(caminho: string) {
  const ext = caminho.split(".").pop()?.toLowerCase() ?? "";
  if (["mp3", "wav", "ogg", "webm", "m4a", "aac"].includes(ext)) return <Mic size={11} className="shrink-0" />;
  if (["jpg", "jpeg", "png", "webp", "gif"].includes(ext)) return <Image size={11} className="shrink-0" />;
  if (ext === "pdf") return <FileText size={11} className="shrink-0" />;
  return <File size={11} className="shrink-0" />;
}

function nomeExibicao(caminho: string) {
  // path = {campanha_id}/{uuid}.ext — exibe só a parte do UUID truncada + ext
  const partes = caminho.split("/");
  const nome = partes[partes.length - 1] ?? caminho;
  const ext = nome.split(".").pop() ?? "";
  return `anexo.${ext}`;
}

function AnexosBadges({ caminhos }: { caminhos: string[] }) {
  const supabase = createClient();
  const [abrindo, setAbrindo] = useState<string | null>(null);

  async function abrir(caminho: string) {
    setAbrindo(caminho);
    const { data } = await supabase.storage
      .from("demandas-anexos")
      .createSignedUrl(caminho, 3600);
    setAbrindo(null);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  }

  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {caminhos.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => abrir(c)}
          disabled={abrindo === c}
          className="flex items-center gap-1 rounded bg-neutral-100 px-2 py-0.5 text-[10px] text-neutral-600 hover:bg-indigo-50 hover:text-indigo-700 disabled:opacity-50"
        >
          {iconeAnexo(c)}
          {abrindo === c ? "Abrindo…" : nomeExibicao(c)}
        </button>
      ))}
    </div>
  );
}

type Tema = { id: string; nome: string };
type Membro = { id: string; nome: string };

const STATUS_BADGE: Record<string, string> = {
  registrada: "bg-neutral-100 text-neutral-600",
  em_analise: "bg-blue-100 text-blue-700",
  encaminhada: "bg-amber-100 text-amber-700",
  em_andamento: "bg-indigo-100 text-indigo-700",
  resolvida: "bg-green-100 text-green-700",
  descartada: "bg-red-100 text-red-700",
};

const STATUS_LABEL: Record<string, string> = {
  registrada: "Registrada",
  em_analise: "Em análise",
  encaminhada: "Encaminhada",
  em_andamento: "Em andamento",
  resolvida: "Resolvida",
  descartada: "Descartada",
};

const PRIORIDADE_BADGE: Record<string, string> = {
  critica: "bg-red-100 text-red-700",
  alta: "bg-orange-100 text-orange-700",
  media: "bg-neutral-100 text-neutral-600",
  baixa: "bg-green-100 text-green-700",
};

function CidadesAutocomplete({
  cidades,
  onChange,
  cidadesConhecidas,
}: {
  cidades: string[];
  onChange: (v: string[]) => void;
  cidadesConhecidas: string[];
}) {
  const [input, setInput] = useState("");
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  const filtradas = input.trim()
    ? cidadesConhecidas.filter(
        (c) => c.toLowerCase().includes(input.trim().toLowerCase()) && !cidades.includes(c)
      )
    : cidadesConhecidas.filter((c) => !cidades.includes(c));

  function adicionar(valor?: string) {
    const limpo = (valor ?? input).trim();
    if (!limpo || cidades.includes(limpo)) return;
    onChange([...cidades, limpo]);
    setInput("");
    setAberto(false);
    ref.current?.focus();
  }

  return (
    <div className="space-y-1">
      {cidades.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {cidades.map((c, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700"
            >
              {c}
              <button
                type="button"
                onClick={() => onChange(cidades.filter((_, j) => j !== i))}
                className="text-indigo-400 hover:text-indigo-700"
              >
                x
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="relative">
        <input
          ref={ref}
          placeholder="Buscar ou adicionar cidade"
          value={input}
          onChange={(e) => { setInput(e.target.value); setAberto(true); }}
          onFocus={() => setAberto(true)}
          onBlur={() => setTimeout(() => setAberto(false), 150)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); adicionar(); } }}
          className="w-full rounded border border-neutral-300 px-2 py-1 text-xs"
        />
        {aberto && filtradas.length > 0 && (
          <div className="absolute left-0 right-0 bottom-full mb-1 z-20 max-h-32 overflow-y-auto rounded border border-neutral-200 bg-white shadow-lg">
            {filtradas.map((c) => (
              <button
                key={c}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => adicionar(c)}
                className="block w-full px-2 py-1 text-left text-xs hover:bg-indigo-50 hover:text-indigo-700"
              >
                {c}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function DemandaCard({
  d,
  cidadesConhecidas,
  temas,
  podeEditar,
  onSaved,
  membros,
}: {
  d: Demanda;
  cidadesConhecidas: string[];
  temas: Tema[];
  podeEditar: boolean;
  onSaved: () => void;
  membros: Membro[];
}) {
  const supabase = createClient();
  const [editando, setEditando] = useState(false);
  const [regiao, setRegiao] = useState(d.regiao ?? "");
  const [cidades, setCidades] = useState<string[]>(d.cidades ?? []);
  const [temaSelected, setTemaSelected] = useState(
    temas.find((t) => t.nome === d.tema)?.id ?? ""
  );
  const [demanda, setDemanda] = useState(d.demanda);
  const [prazo, setPrazo] = useState(d.prazo ?? "");
  const [devolutiva, setDevolutiva] = useState(d.devolutiva ?? "");
  const [palavrasChave, setPalavrasChave] = useState<string[]>(d.palavras_chave ?? []);
  const [palavraInput, setPalavraInput] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);

  function cancelar() {
    setEditando(false);
    setRegiao(d.regiao ?? "");
    setCidades(d.cidades ?? []);
    setTemaSelected(temas.find((t) => t.nome === d.tema)?.id ?? "");
    setDemanda(d.demanda);
    setPrazo(d.prazo ?? "");
    setDevolutiva(d.devolutiva ?? "");
    setPalavrasChave(d.palavras_chave ?? []);
    setPalavraInput("");
    setErro(null);
    setConfirmandoExclusao(false);
  }

  async function salvar() {
    if (!demanda.trim()) { setErro("Demanda é obrigatória"); return; }
    setSalvando(true);
    setErro(null);
    const temaSelecionado = temas.find((t) => t.id === temaSelected);
    const { error } = await supabase
      .from("demandas_observadas")
      .update({
        regiao: regiao.trim() || null,
        cidades: cidades.length > 0 ? cidades : [],
        tema: temaSelecionado?.nome ?? null,
        demanda: demanda.trim(),
        prazo: prazo || null,
        devolutiva: devolutiva.trim() || null,
        palavras_chave: palavrasChave,
      })
      .eq("id", d.id);
    setSalvando(false);
    if (error) { setErro(error.message); return; }
    setEditando(false);
    onSaved();
  }

  async function excluir() {
    setSalvando(true);
    const { error } = await supabase
      .from("demandas_observadas")
      .delete()
      .eq("id", d.id);
    setSalvando(false);
    if (error) { setErro(error.message); return; }
    onSaved();
  }

  async function atualizarStatus(novoStatus: string) {
    setSalvando(true);
    const campos: Record<string, unknown> = { status: novoStatus, updated_at: new Date().toISOString() };
    if (novoStatus === "resolvida") campos.resolvida_em = new Date().toISOString();
    await supabase.from("demandas_observadas").update(campos).eq("id", d.id);
    setSalvando(false);
    onSaved();
  }

  async function atribuirResponsavel(respId: string) {
    await supabase.from("demandas_observadas").update({
      responsavel_id: respId || null,
      status: respId ? "encaminhada" : d.status,
      updated_at: new Date().toISOString(),
    }).eq("id", d.id);
    onSaved();
  }

  const responsavelNome = membros.find((m) => m.id === d.responsavel_id)?.nome;

  if (!editando) {
    return (
      <li className="rounded border border-neutral-200 p-3 space-y-1">
        <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
          <span className={`rounded-full px-2 py-0.5 font-medium ${STATUS_BADGE[d.status] ?? STATUS_BADGE.registrada}`}>
            {STATUS_LABEL[d.status] ?? d.status}
          </span>
          <span className={`rounded-full px-2 py-0.5 font-medium ${PRIORIDADE_BADGE[d.prioridade] ?? PRIORIDADE_BADGE.media}`}>
            {d.prioridade}
          </span>
          {d.tema && (
            <span className="rounded-full bg-neutral-100 px-2 py-0.5 font-medium">{d.tema}</span>
          )}
          {d.regiao && <span>{d.regiao}</span>}
          {(d.cidades ?? []).length > 0 && (
            <span>{(d.cidades as string[]).join(", ")}</span>
          )}
          {(d.palavras_chave ?? []).length > 0 &&
            (d.palavras_chave as string[]).map((p) => (
              <span key={p} className="rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-700">{p}</span>
            ))}
          {responsavelNome && (
            <span className="text-indigo-600">→ {responsavelNome}</span>
          )}
          {podeEditar && (
            <button
              type="button"
              onClick={() => setEditando(true)}
              className="ml-auto text-indigo-600 hover:text-indigo-800 text-xs font-medium"
            >
              Editar
            </button>
          )}
        </div>
        <p className="text-sm">{d.demanda}</p>
        {d.encaminhamento && (
          <p className="text-xs text-blue-700 bg-blue-50 rounded px-2 py-1">Encaminhamento: {d.encaminhamento}</p>
        )}
        {d.resposta && (
          <p className="text-xs text-green-700 bg-green-50 rounded px-2 py-1">Resposta: {d.resposta}</p>
        )}
        {d.prazo && (
          <p className="text-xs text-neutral-500">Prazo: {new Date(d.prazo + "T00:00:00").toLocaleDateString("pt-BR")}</p>
        )}
        {d.devolutiva && (
          <p className="text-xs text-purple-700 bg-purple-50 rounded px-2 py-1">Devolutiva: {d.devolutiva}</p>
        )}
        {(d.anexos ?? []).length > 0 && (
          <div className="flex items-center gap-1 text-[10px] text-neutral-400">
            <Paperclip size={10} /> {(d.anexos as string[]).length} anexo(s)
            <AnexosBadges caminhos={d.anexos as string[]} />
          </div>
        )}
        {podeEditar && d.status !== "resolvida" && d.status !== "descartada" && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {d.status === "registrada" && (
              <button onClick={() => atualizarStatus("em_analise")} disabled={salvando} className="rounded bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700 hover:bg-blue-200">Analisar</button>
            )}
            {(d.status === "em_analise" || d.status === "registrada") && (
              <select
                onChange={(e) => { if (e.target.value) atribuirResponsavel(e.target.value); }}
                defaultValue=""
                className="rounded border border-neutral-200 px-1.5 py-0.5 text-[10px]"
              >
                <option value="">Encaminhar para…</option>
                {membros.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
              </select>
            )}
            <button onClick={() => atualizarStatus("resolvida")} disabled={salvando} className="rounded bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700 hover:bg-green-200">Resolver</button>
            <button onClick={() => atualizarStatus("descartada")} disabled={salvando} className="rounded bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700 hover:bg-red-200">Descartar</button>
          </div>
        )}
      </li>
    );
  }

  return (
    <li className="rounded border-2 border-indigo-200 bg-indigo-50/30 p-3 space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="block text-xs font-medium text-neutral-500">Região</label>
          <input
            value={regiao}
            onChange={(e) => setRegiao(e.target.value)}
            className="w-full rounded border border-neutral-300 px-2 py-1 text-xs bg-white"
          />
        </div>
        <div className="space-y-1">
          <label className="block text-xs font-medium text-neutral-500">Cidades</label>
          <CidadesAutocomplete
            cidades={cidades}
            onChange={setCidades}
            cidadesConhecidas={cidadesConhecidas}
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className="block text-xs font-medium text-neutral-500">Tema</label>
        <select
          value={temaSelected}
          onChange={(e) => setTemaSelected(e.target.value)}
          className="w-full rounded border border-neutral-300 px-2 py-1 text-xs bg-white"
        >
          <option value="">Sem tema</option>
          {temas.map((t) => (
            <option key={t.id} value={t.id}>{t.nome}</option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <label className="block text-xs font-medium text-neutral-500">Demanda</label>
        <textarea
          rows={3}
          value={demanda}
          onChange={(e) => setDemanda(e.target.value)}
          className="w-full rounded border border-neutral-300 px-2 py-1 text-xs bg-white"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="block text-xs font-medium text-neutral-500">Prazo</label>
          <input
            type="date"
            value={prazo}
            onChange={(e) => setPrazo(e.target.value)}
            className="w-full rounded border border-neutral-300 px-2 py-1 text-xs bg-white"
          />
        </div>
        <div className="space-y-1">
          <label className="block text-xs font-medium text-neutral-500">Devolutiva</label>
          <textarea
            rows={2}
            value={devolutiva}
            onChange={(e) => setDevolutiva(e.target.value)}
            placeholder="Resposta dada à população sobre esta demanda"
            className="w-full rounded border border-neutral-300 px-2 py-1 text-xs bg-white"
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className="block text-xs font-medium text-neutral-500">Palavras-chave</label>
        {palavrasChave.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {palavrasChave.map((p, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700"
              >
                {p}
                <button
                  type="button"
                  onClick={() => setPalavrasChave(palavrasChave.filter((_, j) => j !== i))}
                  className="text-amber-400 hover:text-amber-700"
                >
                  x
                </button>
              </span>
            ))}
          </div>
        )}
        <input
          placeholder="Digite e pressione Enter"
          value={palavraInput}
          onChange={(e) => setPalavraInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              const limpo = palavraInput.trim().toLowerCase();
              if (limpo && !palavrasChave.includes(limpo)) {
                setPalavrasChave([...palavrasChave, limpo]);
              }
              setPalavraInput("");
            }
          }}
          className="w-full rounded border border-neutral-300 px-2 py-1 text-xs bg-white"
        />
      </div>

      {erro && <p className="text-xs text-red-600">{erro}</p>}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={salvar}
          disabled={salvando}
          className="rounded bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {salvando ? "Salvando…" : "Salvar"}
        </button>
        <button
          type="button"
          onClick={cancelar}
          className="rounded bg-neutral-100 px-3 py-1 text-xs text-neutral-600 hover:bg-neutral-200"
        >
          Cancelar
        </button>
        <div className="ml-auto">
          {!confirmandoExclusao ? (
            <button
              type="button"
              onClick={() => setConfirmandoExclusao(true)}
              className="text-xs text-red-500 hover:text-red-700"
            >
              Excluir
            </button>
          ) : (
            <span className="flex items-center gap-1 text-xs">
              <span className="text-red-600">Tem certeza?</span>
              <button
                type="button"
                onClick={excluir}
                disabled={salvando}
                className="font-medium text-red-600 hover:text-red-800"
              >
                Sim
              </button>
              <button
                type="button"
                onClick={() => setConfirmandoExclusao(false)}
                className="text-neutral-500 hover:text-neutral-700"
              >
                Não
              </button>
            </span>
          )}
        </div>
      </div>
    </li>
  );
}

export function DemandasLista({
  demandas,
  cidadesConhecidas,
  temas,
  podeEditar,
  membros = [],
}: {
  demandas: Demanda[];
  cidadesConhecidas: string[];
  temas: Tema[];
  podeEditar: boolean;
  membros?: Membro[];
}) {
  const router = useRouter();
  const [filtro, setFiltro] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("");
  const [filtroPalavra, setFiltroPalavra] = useState("");

  const filtroLower = filtro.trim().toLowerCase();
  const filtroPalavraLower = filtroPalavra.trim().toLowerCase();
  const demandasFiltradas = demandas.filter((d) => {
    if (filtroStatus && d.status !== filtroStatus) return false;
    if (filtroLower) {
      const cidadesArr = d.cidades ?? [];
      if (!cidadesArr.some((c) => c.toLowerCase().includes(filtroLower))) return false;
    }
    if (filtroPalavraLower) {
      const pcs = d.palavras_chave ?? [];
      if (!pcs.some((p) => p.toLowerCase().includes(filtroPalavraLower))) return false;
    }
    return true;
  });

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
        Registradas
      </h2>

      <div className="flex gap-2">
        <select
          value={filtroStatus}
          onChange={(e) => setFiltroStatus(e.target.value)}
          className="rounded border border-neutral-300 px-2 py-1.5 text-sm"
        >
          <option value="">Todos os status</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <div className="relative flex-1">
        <input
          placeholder="Filtrar por cidade..."
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          className="w-full rounded border border-neutral-300 px-3 py-1.5 text-sm"
          list="cidades-datalist"
        />
        <datalist id="cidades-datalist">
          {cidadesConhecidas.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        {filtroLower && (
          <button
            type="button"
            onClick={() => setFiltro("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 text-sm"
          >
            limpar
          </button>
        )}
        </div>
        <div className="relative flex-1">
          <input
            placeholder="Filtrar por palavra-chave..."
            value={filtroPalavra}
            onChange={(e) => setFiltroPalavra(e.target.value)}
            className="w-full rounded border border-neutral-300 px-3 py-1.5 text-sm"
          />
          {filtroPalavraLower && (
            <button
              type="button"
              onClick={() => setFiltroPalavra("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 text-sm"
            >
              limpar
            </button>
          )}
        </div>
      </div>

      {(filtroLower || filtroStatus || filtroPalavraLower) && (
        <p className="text-xs text-neutral-400">
          {demandasFiltradas.length} demanda(s)
          {filtroLower ? ` em cidades com "${filtro.trim()}"` : ""}
          {filtroPalavraLower ? ` com palavra-chave "${filtroPalavra.trim()}"` : ""}
          {filtroStatus ? ` com status "${STATUS_LABEL[filtroStatus] ?? filtroStatus}"` : ""}
        </p>
      )}

      {demandasFiltradas.length === 0 && (
        <p className="text-sm text-neutral-400">
          {filtroLower || filtroStatus || filtroPalavraLower
            ? "Nenhuma demanda encontrada com esses filtros."
            : "Nenhuma demanda registrada ainda."}
        </p>
      )}

      <ul className="space-y-2">
        {demandasFiltradas.map((d) => (
          <DemandaCard
            key={d.id}
            d={d}
            cidadesConhecidas={cidadesConhecidas}
            temas={temas}
            podeEditar={podeEditar}
            onSaved={() => router.refresh()}
            membros={membros}
          />
        ))}
      </ul>
    </section>
  );
}
