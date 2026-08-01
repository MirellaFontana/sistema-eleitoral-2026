"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Radio,
  Plus,
  ChevronDown,
  ChevronUp,
  Send,
  MapPin,
  MessageCircle,
  AlertTriangle,
  Users,
  X,
  Mic,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { labelTerritorio } from "@/lib/territorio";

type Territorio = { id: string; nome: string };
type Membro = { id: string; nome: string };

type Sinal = {
  id: string;
  territorio_id: string | null;
  local_descricao: string | null;
  data_registro: string;
  tema: string | null;
  perguntas_objecoes: string[];
  reacao_discurso: string | null;
  discurso_concorrente: string | null;
  frase_representativa: string | null;
  intensidade: "forte" | "moderada" | "fraca";
  contagem_pessoas: number;
  observacoes: string | null;
  encaminhamento: string | null;
  encaminhado_para: string | null;
  encaminhamento_status: string | null;
  created_at: string;
  usuarios_internos: { nome: string } | null;
  territorios: { nome_bairro: string | null; cidade: string | null } | null;
};

const INTENSIDADE_COR = {
  forte: "bg-red-100 text-red-700",
  moderada: "bg-amber-100 text-amber-700",
  fraca: "bg-green-100 text-green-700",
};

type Evento = { id: string; titulo: string };

export function CampoClient({
  territorios,
  membros,
  eventos,
  podeEncaminhar,
}: {
  territorios: Territorio[];
  membros: Membro[];
  eventos: Evento[];
  podeEncaminhar: boolean;
}) {
  const [sinais, setSinais] = useState<Sinal[]>([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [loading, setLoading] = useState(true);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [expandido, setExpandido] = useState<string | null>(null);
  const [filtroTerritorio, setFiltroTerritorio] = useState("");
  const [filtroIntensidade, setFiltroIntensidade] = useState("");

  const carregar = useCallback(async (p = 1) => {
    setLoading(true);
    const params = new URLSearchParams({ pagina: String(p) });
    if (filtroTerritorio) params.set("territorio", filtroTerritorio);
    const res = await fetch(`/api/sinais-campo?${params}`);
    const json = await res.json();
    const lista = filtroIntensidade
      ? (json.sinais ?? []).filter((s: Sinal) => s.intensidade === filtroIntensidade)
      : (json.sinais ?? []);
    setSinais(lista);
    setTotal(json.total ?? 0);
    setPagina(p);
    setLoading(false);
  }, [filtroTerritorio, filtroIntensidade]);

  useEffect(() => { carregar(); }, [carregar]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-neutral-900">Escuta de campo</h1>
          <p className="text-sm text-neutral-500">{total} sinais registrados</p>
        </div>
        <button
          onClick={() => setMostrarForm(!mostrarForm)}
          className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          {mostrarForm ? <X size={16} /> : <Plus size={16} />}
          {mostrarForm ? "Cancelar" : "Novo sinal"}
        </button>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <select
          value={filtroTerritorio}
          onChange={(e) => { setFiltroTerritorio(e.target.value); setPagina(1); }}
          className="rounded border border-neutral-300 px-2 py-1.5 text-xs"
        >
          <option value="">Todos os territórios</option>
          {territorios.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
        </select>
        <select
          value={filtroIntensidade}
          onChange={(e) => { setFiltroIntensidade(e.target.value); setPagina(1); }}
          className="rounded border border-neutral-300 px-2 py-1.5 text-xs"
        >
          <option value="">Todas as intensidades</option>
          <option value="forte">Forte</option>
          <option value="moderada">Moderada</option>
          <option value="fraca">Fraca</option>
        </select>
      </div>

      {mostrarForm && (
        <NovoSinalForm
          territorios={territorios}
          eventos={eventos}
          onSalvo={() => { setMostrarForm(false); carregar(); }}
        />
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg bg-neutral-100" />
          ))}
        </div>
      ) : sinais.length === 0 ? (
        <div className="rounded-lg border border-dashed border-neutral-300 py-12 text-center text-sm text-neutral-500">
          <Radio size={32} className="mx-auto mb-2 text-neutral-300" />
          Nenhum sinal de campo registrado ainda.
        </div>
      ) : (
        <div className="space-y-3">
          {sinais.map((s) => (
            <SinalCard
              key={s.id}
              sinal={s}
              expandido={expandido === s.id}
              onToggle={() => setExpandido(expandido === s.id ? null : s.id)}
              membros={membros}
              podeEncaminhar={podeEncaminhar}
              onAtualizado={carregar}
            />
          ))}
        </div>
      )}

      {total > 30 && (
        <div className="mt-4 flex justify-center gap-2">
          <button
            disabled={pagina <= 1}
            onClick={() => carregar(pagina - 1)}
            className="rounded border px-3 py-1.5 text-sm disabled:opacity-40"
          >
            Anterior
          </button>
          <span className="px-2 py-1.5 text-sm text-neutral-500">
            {pagina} / {Math.ceil(total / 30)}
          </span>
          <button
            disabled={pagina * 30 >= total}
            onClick={() => carregar(pagina + 1)}
            className="rounded border px-3 py-1.5 text-sm disabled:opacity-40"
          >
            Próxima
          </button>
        </div>
      )}
    </div>
  );
}

function NovoSinalForm({
  territorios,
  eventos,
  onSalvo,
}: {
  territorios: Territorio[];
  eventos: Evento[];
  onSalvo: () => void;
}) {
  const [salvando, setSalvando] = useState(false);
  const [perguntas, setPerguntas] = useState<string[]>([""]);
  const [gravando, setGravando] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const srRef = useRef<any>(null);
  const localRef = useRef<HTMLInputElement>(null);
  const temaRef = useRef<HTMLInputElement>(null);
  const fraseRef = useRef<HTMLInputElement>(null);
  const reacaoRef = useRef<HTMLTextAreaElement>(null);
  const concorrenteRef = useRef<HTMLTextAreaElement>(null);
  const obsRef = useRef<HTMLTextAreaElement>(null);

  function ditar(campo: string, el: HTMLInputElement | HTMLTextAreaElement | null) {
    if (gravando === campo) {
      srRef.current?.stop();
      setGravando(null);
      return;
    }
    srRef.current?.stop();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const win = window as any;
    const SR = win.SpeechRecognition ?? win.webkitSpeechRecognition;
    if (!SR || !el) return;
    const r = new SR();
    r.lang = "pt-BR";
    r.continuous = true;
    r.interimResults = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    r.onresult = (e: any) => {
      let t = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) t += e.results[i][0].transcript + " ";
      }
      if (t) el.value = el.value ? el.value.trimEnd() + " " + t.trimEnd() : t.trimEnd();
    };
    r.onerror = () => setGravando(null);
    r.onend = () => setGravando(null);
    srRef.current = r;
    r.start();
    setGravando(campo);
  }

  function MicBtn({ campo, el }: { campo: string; el: React.RefObject<HTMLInputElement | HTMLTextAreaElement> }) {
    const ativo = gravando === campo;
    return (
      <button
        type="button"
        onClick={() => ditar(campo, el.current)}
        className={`flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[11px] transition-colors ${ativo ? "animate-pulse bg-red-50 text-red-600" : "text-neutral-400 hover:text-indigo-600"}`}
      >
        <Mic size={11} />
        {ativo ? "Gravando…" : "Ditar"}
      </button>
    );
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    srRef.current?.stop();
    setSalvando(true);
    const fd = new FormData(e.currentTarget);
    const body = {
      territorio_id: fd.get("territorio_id") || null,
      evento_id: fd.get("evento_id") || null,
      local_descricao: fd.get("local_descricao") || null,
      data_registro: fd.get("data_registro") || undefined,
      tema: fd.get("tema") || null,
      perguntas_objecoes: perguntas.filter((p) => p.trim()),
      reacao_discurso: fd.get("reacao_discurso") || null,
      discurso_concorrente: fd.get("discurso_concorrente") || null,
      frase_representativa: fd.get("frase_representativa") || null,
      intensidade: fd.get("intensidade") || "moderada",
      contagem_pessoas: parseInt(fd.get("contagem_pessoas") as string) || 1,
      observacoes: fd.get("observacoes") || null,
    };
    const res = await fetch("/api/sinais-campo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSalvando(false);
    if (res.ok) onSalvo();
  }

  return (
    <form onSubmit={handleSubmit} className="mb-6 space-y-4 rounded-lg border border-indigo-200 bg-indigo-50/50 p-4">
      <p className="text-sm font-semibold text-indigo-900">Registrar sinal de campo</p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="text-neutral-600">Território</span>
          <select name="territorio_id" className="mt-1 block w-full rounded border border-neutral-300 px-2 py-1.5 text-sm">
            <option value="">—</option>
            {territorios.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-neutral-600">Data</span>
          <input type="date" name="data_registro" defaultValue={new Date().toISOString().slice(0, 10)} className="mt-1 block w-full rounded border border-neutral-300 px-2 py-1.5 text-sm" />
        </label>
      </div>

      {eventos.length > 0 && (
        <label className="block text-sm">
          <span className="text-neutral-600">Evento / ação vinculada</span>
          <select name="evento_id" className="mt-1 block w-full rounded border border-neutral-300 px-2 py-1.5 text-sm">
            <option value="">Nenhum</option>
            {eventos.map((e) => <option key={e.id} value={e.id}>{e.titulo}</option>)}
          </select>
        </label>
      )}

      <div className="text-sm">
        <div className="flex items-center justify-between">
          <span className="text-neutral-600">Local (descrição livre)</span>
          <MicBtn campo="local" el={localRef as React.RefObject<HTMLInputElement | HTMLTextAreaElement>} />
        </div>
        <input ref={localRef} name="local_descricao" placeholder="Ex: Praça central, feira do bairro X" className="mt-1 block w-full rounded border border-neutral-300 px-2 py-1.5 text-sm" />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="text-sm">
          <div className="flex items-center justify-between">
            <span className="text-neutral-600">Tema principal</span>
            <MicBtn campo="tema" el={temaRef as React.RefObject<HTMLInputElement | HTMLTextAreaElement>} />
          </div>
          <input ref={temaRef} name="tema" placeholder="Ex: saúde, segurança" className="mt-1 block w-full rounded border border-neutral-300 px-2 py-1.5 text-sm" />
        </div>
        <label className="block text-sm">
          <span className="text-neutral-600">Intensidade</span>
          <select name="intensidade" defaultValue="moderada" className="mt-1 block w-full rounded border border-neutral-300 px-2 py-1.5 text-sm">
            <option value="forte">Forte</option>
            <option value="moderada">Moderada</option>
            <option value="fraca">Fraca</option>
          </select>
        </label>
      </div>

      <div className="text-sm">
        <span className="text-neutral-600">Perguntas / objeções ouvidas</span>
        {perguntas.map((p, i) => (
          <div key={i} className="mt-1 flex gap-1">
            <input
              value={p}
              onChange={(e) => { const arr = [...perguntas]; arr[i] = e.target.value; setPerguntas(arr); }}
              placeholder={`Pergunta ${i + 1}`}
              className="block flex-1 rounded border border-neutral-300 px-2 py-1.5 text-sm"
            />
            {perguntas.length > 1 && (
              <button type="button" onClick={() => setPerguntas(perguntas.filter((_, j) => j !== i))} className="px-1 text-neutral-400 hover:text-red-500">
                <X size={14} />
              </button>
            )}
          </div>
        ))}
        <button type="button" onClick={() => setPerguntas([...perguntas, ""])} className="mt-1 text-xs text-indigo-600 hover:underline">
          + Adicionar pergunta
        </button>
      </div>

      <div className="text-sm">
        <div className="flex items-center justify-between">
          <span className="text-neutral-600">Reação ao discurso da campanha</span>
          <MicBtn campo="reacao" el={reacaoRef as React.RefObject<HTMLInputElement | HTMLTextAreaElement>} />
        </div>
        <textarea ref={reacaoRef} name="reacao_discurso" rows={2} placeholder="Como as pessoas reagiram às propostas?" className="mt-1 block w-full rounded border border-neutral-300 px-2 py-1.5 text-sm" />
      </div>

      <div className="text-sm">
        <div className="flex items-center justify-between">
          <span className="text-neutral-600">Discurso concorrente mencionado</span>
          <MicBtn campo="concorrente" el={concorrenteRef as React.RefObject<HTMLInputElement | HTMLTextAreaElement>} />
        </div>
        <textarea ref={concorrenteRef} name="discurso_concorrente" rows={2} placeholder="Algum concorrente foi mencionado? O que disseram?" className="mt-1 block w-full rounded border border-neutral-300 px-2 py-1.5 text-sm" />
      </div>

      <div className="text-sm">
        <div className="flex items-center justify-between">
          <span className="text-neutral-600">Frase representativa</span>
          <MicBtn campo="frase" el={fraseRef as React.RefObject<HTMLInputElement | HTMLTextAreaElement>} />
        </div>
        <input ref={fraseRef} name="frase_representativa" placeholder="Uma frase que resume o sentimento ouvido" className="mt-1 block w-full rounded border border-neutral-300 px-2 py-1.5 text-sm" />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="text-neutral-600">Pessoas aprox.</span>
          <input type="number" name="contagem_pessoas" min={1} defaultValue={1} className="mt-1 block w-full rounded border border-neutral-300 px-2 py-1.5 text-sm" />
        </label>
      </div>

      <div className="text-sm">
        <div className="flex items-center justify-between">
          <span className="text-neutral-600">Observações</span>
          <MicBtn campo="obs" el={obsRef as React.RefObject<HTMLInputElement | HTMLTextAreaElement>} />
        </div>
        <textarea ref={obsRef} name="observacoes" rows={2} className="mt-1 block w-full rounded border border-neutral-300 px-2 py-1.5 text-sm" />
      </div>

      <button
        type="submit"
        disabled={salvando}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
      >
        <Send size={16} />
        {salvando ? "Salvando…" : "Registrar sinal"}
      </button>
    </form>
  );
}

function SinalCard({
  sinal,
  expandido,
  onToggle,
  membros,
  podeEncaminhar,
  onAtualizado,
}: {
  sinal: Sinal;
  expandido: boolean;
  onToggle: () => void;
  membros: Membro[];
  podeEncaminhar: boolean;
  onAtualizado: () => void;
}) {
  const [encForm, setEncForm] = useState(false);

  async function atualizarStatus(novoStatus: string) {
    await fetch("/api/sinais-campo", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: sinal.id, encaminhamento_status: novoStatus }),
    });
    onAtualizado();
  }

  async function encaminhar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await fetch("/api/sinais-campo", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: sinal.id,
        encaminhamento: fd.get("encaminhamento"),
        encaminhado_para: fd.get("encaminhado_para") || null,
        encaminhamento_status: "encaminhado",
      }),
    });
    setEncForm(false);
    onAtualizado();
  }

  return (
    <div className="rounded-lg border border-neutral-200 bg-white">
      <button onClick={onToggle} className="flex w-full items-start gap-3 p-3 text-left">
        <div className="mt-0.5 shrink-0">
          <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${INTENSIDADE_COR[sinal.intensidade]}`}>
            {sinal.intensidade}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {sinal.tema && <span className="text-sm font-medium text-neutral-900">{sinal.tema}</span>}
            {sinal.territorios && (
              <span className="flex items-center gap-0.5 text-xs text-neutral-400">
                <MapPin size={11} /> {labelTerritorio(sinal.territorios.nome_bairro, sinal.territorios.cidade)}
              </span>
            )}
          </div>
          {sinal.frase_representativa && (
            <p className="mt-0.5 text-sm italic text-neutral-600">&ldquo;{sinal.frase_representativa}&rdquo;</p>
          )}
          <div className="mt-1 flex items-center gap-3 text-xs text-neutral-400">
            <span>{new Date(sinal.created_at).toLocaleDateString("pt-BR")}</span>
            <span>{sinal.usuarios_internos?.nome}</span>
            {sinal.contagem_pessoas > 1 && (
              <span className="flex items-center gap-0.5"><Users size={11} /> ~{sinal.contagem_pessoas}</span>
            )}
            {sinal.encaminhamento_status && sinal.encaminhamento_status !== "pendente" && (
              <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
                {sinal.encaminhamento_status}
              </span>
            )}
          </div>
        </div>
        {expandido ? <ChevronUp size={16} className="shrink-0 text-neutral-400" /> : <ChevronDown size={16} className="shrink-0 text-neutral-400" />}
      </button>

      {expandido && (
        <div className="space-y-3 border-t border-neutral-100 px-3 pb-3 pt-2">
          {sinal.perguntas_objecoes?.length > 0 && (
            <div>
              <p className="mb-1 flex items-center gap-1 text-xs font-medium text-neutral-500">
                <MessageCircle size={12} /> Perguntas / objeções
              </p>
              <ul className="space-y-0.5">
                {sinal.perguntas_objecoes.map((p, i) => (
                  <li key={i} className="rounded bg-neutral-50 px-2 py-1 text-sm text-neutral-700">{p}</li>
                ))}
              </ul>
            </div>
          )}

          {sinal.reacao_discurso && (
            <div>
              <p className="mb-1 text-xs font-medium text-neutral-500">Reação ao discurso</p>
              <p className="text-sm text-neutral-700">{sinal.reacao_discurso}</p>
            </div>
          )}

          {sinal.discurso_concorrente && (
            <div>
              <p className="mb-1 flex items-center gap-1 text-xs font-medium text-neutral-500">
                <AlertTriangle size={12} /> Discurso concorrente
              </p>
              <p className="text-sm text-neutral-700">{sinal.discurso_concorrente}</p>
            </div>
          )}

          {sinal.local_descricao && (
            <p className="text-xs text-neutral-400"><MapPin size={11} className="mr-0.5 inline" />{sinal.local_descricao}</p>
          )}

          {sinal.observacoes && (
            <p className="text-sm text-neutral-600">{sinal.observacoes}</p>
          )}

          {sinal.encaminhamento && (
            <div className="rounded bg-blue-50 p-2 text-sm text-blue-800">
              <span className="font-medium">Encaminhamento:</span> {sinal.encaminhamento}
              {podeEncaminhar && sinal.encaminhamento_status && sinal.encaminhamento_status !== "resolvido" && (
                <div className="mt-1.5 flex gap-1.5">
                  {sinal.encaminhamento_status === "encaminhado" && (
                    <button
                      onClick={() => atualizarStatus("em_andamento")}
                      className="rounded bg-indigo-100 px-2 py-0.5 text-[10px] font-medium text-indigo-700 hover:bg-indigo-200"
                    >
                      Iniciar acompanhamento
                    </button>
                  )}
                  <button
                    onClick={() => atualizarStatus("resolvido")}
                    className="rounded bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700 hover:bg-green-200"
                  >
                    Marcar resolvido
                  </button>
                </div>
              )}
            </div>
          )}

          {podeEncaminhar && !encForm && !sinal.encaminhamento && (
            <button onClick={() => setEncForm(true)} className="text-xs text-indigo-600 hover:underline">
              Encaminhar sinal
            </button>
          )}

          {encForm && (
            <form onSubmit={encaminhar} className="space-y-2 rounded border border-blue-200 bg-blue-50/50 p-2">
              <textarea name="encaminhamento" required rows={2} placeholder="Instrução de encaminhamento" className="block w-full rounded border border-neutral-300 px-2 py-1.5 text-sm" />
              <select name="encaminhado_para" className="block w-full rounded border border-neutral-300 px-2 py-1.5 text-sm">
                <option value="">Responsável (opcional)</option>
                {membros.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
              </select>
              <div className="flex gap-2">
                <button type="submit" className="rounded bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-700">Encaminhar</button>
                <button type="button" onClick={() => setEncForm(false)} className="text-xs text-neutral-500 hover:underline">Cancelar</button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
