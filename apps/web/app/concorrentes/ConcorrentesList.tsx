"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Pencil, Trash2, Save, X, Sparkles, Bold, Italic, List } from "lucide-react";
import { SinaisConcorrente } from "./SinaisConcorrente";
import { AnunciosConcorrente } from "./AnunciosConcorrente";

type Concorrente = {
  id: string;
  nome: string;
  partido: string | null;
  pontos_fortes: string | null;
  pontos_fracos: string | null;
  promessas: string | null;
  dossie_mandato: string | null;
  argumentos: string | null;
  created_at: string;
};

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function renderMd(text: string) {
  const lines = text.split("\n");
  return lines.map((line, i) => {
    let html = escapeHtml(line)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(/^[-•]\s+/, "• ");
    return (
      <span key={i}>
        {i > 0 && <br />}
        <span dangerouslySetInnerHTML={{ __html: html }} />
      </span>
    );
  });
}

function TextoFormatado({ texto, label }: { texto: string; label: string }) {
  return (
    <div className="text-sm text-neutral-600">
      <span className="font-medium text-neutral-500">{label}: </span>
      <span className="whitespace-pre-wrap">{renderMd(texto)}</span>
    </div>
  );
}

function ToolbarTexto({
  textareaRef,
  value,
  onChange,
}: {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (v: string) => void;
}) {
  function wrap(before: string, after: string) {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = value.slice(start, end);
    if (selected) {
      const novo = value.slice(0, start) + before + selected + after + value.slice(end);
      onChange(novo);
      setTimeout(() => {
        ta.focus();
        ta.setSelectionRange(start + before.length, end + before.length);
      }, 0);
    }
  }

  function insertList() {
    const ta = textareaRef.current;
    if (!ta) return;
    const pos = ta.selectionStart;
    const before = value.slice(0, pos);
    const after = value.slice(pos);
    const prefix = before.endsWith("\n") || before === "" ? "- " : "\n- ";
    onChange(before + prefix + after);
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(pos + prefix.length, pos + prefix.length);
    }, 0);
  }

  return (
    <div className="flex gap-0.5 rounded-t border border-b-0 border-neutral-300 bg-neutral-50 px-1 py-0.5">
      <button
        type="button"
        onClick={() => wrap("**", "**")}
        className="rounded p-1 text-neutral-500 hover:bg-neutral-200 hover:text-neutral-700"
        title="Negrito (selecione o texto primeiro)"
      >
        <Bold size={13} />
      </button>
      <button
        type="button"
        onClick={() => wrap("*", "*")}
        className="rounded p-1 text-neutral-500 hover:bg-neutral-200 hover:text-neutral-700"
        title="Itálico (selecione o texto primeiro)"
      >
        <Italic size={13} />
      </button>
      <button
        type="button"
        onClick={insertList}
        className="rounded p-1 text-neutral-500 hover:bg-neutral-200 hover:text-neutral-700"
        title="Inserir item de lista"
      >
        <List size={13} />
      </button>
    </div>
  );
}

function CampoEditavel({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const ref = { current: null as HTMLTextAreaElement | null };

  return (
    <div className="space-y-0">
      <label className="block text-xs font-medium text-neutral-500">{label}</label>
      <ToolbarTexto textareaRef={ref} value={value} onChange={onChange} />
      <textarea
        ref={(el) => { ref.current = el; }}
        rows={3}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-b border border-neutral-300 px-2 py-1.5 text-sm"
      />
    </div>
  );
}

function CardConcorrente({
  c,
  podeEditar,
  onAtualizar,
  onExcluir,
}: {
  c: Concorrente;
  podeEditar: boolean;
  onAtualizar: () => void;
  onExcluir: (id: string) => void;
}) {
  const supabase = createClient();
  const [editando, setEditando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [resumindo, setResumindo] = useState<string | null>(null);
  const [campos, setCampos] = useState({
    nome: c.nome,
    partido: c.partido ?? "",
    pontos_fortes: c.pontos_fortes ?? "",
    pontos_fracos: c.pontos_fracos ?? "",
    promessas: c.promessas ?? "",
    dossie_mandato: c.dossie_mandato ?? "",
    argumentos: c.argumentos ?? "",
  });

  async function salvar() {
    setSalvando(true);
    await supabase
      .from("concorrentes")
      .update({
        nome: campos.nome,
        partido: campos.partido.trim() || null,
        pontos_fortes: campos.pontos_fortes.trim() || null,
        pontos_fracos: campos.pontos_fracos.trim() || null,
        promessas: campos.promessas.trim() || null,
        dossie_mandato: campos.dossie_mandato.trim() || null,
        argumentos: campos.argumentos.trim() || null,
      })
      .eq("id", c.id);
    setSalvando(false);
    setEditando(false);
    onAtualizar();
  }

  async function resumirCampo(campo: "pontos_fortes" | "pontos_fracos" | "promessas" | "dossie_mandato" | "argumentos") {
    const texto = campos[campo];
    if (!texto.trim()) return;
    setResumindo(campo);
    try {
      const res = await fetch("/api/concorrentes/resumir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto, campo }),
      });
      if (res.ok) {
        const { resumo } = await res.json();
        setCampos((prev) => ({ ...prev, [campo]: resumo }));
      }
    } finally {
      setResumindo(null);
    }
  }

  async function excluir() {
    if (!confirm(`Excluir "${c.nome}"? Esta ação não pode ser desfeita.`)) return;
    await supabase.from("concorrentes").delete().eq("id", c.id);
    onExcluir(c.id);
  }

  if (editando) {
    return (
      <li className="rounded border-2 border-indigo-300 bg-indigo-50/30 p-4 space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="block text-xs font-medium text-neutral-500">Nome</label>
            <input
              value={campos.nome}
              onChange={(e) => setCampos({ ...campos, nome: e.target.value })}
              className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-medium text-neutral-500">Partido</label>
            <input
              value={campos.partido}
              onChange={(e) => setCampos({ ...campos, partido: e.target.value })}
              className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
            />
          </div>
        </div>

        {(["pontos_fortes", "pontos_fracos", "promessas", "dossie_mandato", "argumentos"] as const).map((campo) => (
          <div key={campo} className="relative">
            <CampoEditavel
              label={
                campo === "pontos_fortes" ? "Pontos fortes"
                : campo === "pontos_fracos" ? "Pontos fracos"
                : campo === "promessas" ? "Promessas"
                : campo === "dossie_mandato" ? "Dossiê do Mandato"
                : "Argumentos"
              }
              value={campos[campo]}
              onChange={(v) => setCampos({ ...campos, [campo]: v })}
            />
            {campos[campo].trim().length > 50 && (
              <button
                type="button"
                onClick={() => resumirCampo(campo)}
                disabled={resumindo !== null}
                className="mt-1 flex items-center gap-1 text-[10px] text-indigo-500 hover:text-indigo-700 disabled:opacity-50"
              >
                <Sparkles size={10} />
                {resumindo === campo ? "Resumindo…" : "Resumir com IA"}
              </button>
            )}
          </div>
        ))}

        <div className="flex gap-2 pt-1">
          <button
            onClick={salvar}
            disabled={salvando || !campos.nome.trim()}
            className="flex items-center gap-1 rounded bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            <Save size={12} /> {salvando ? "Salvando…" : "Salvar"}
          </button>
          <button
            onClick={() => {
              setCampos({
                nome: c.nome,
                partido: c.partido ?? "",
                pontos_fortes: c.pontos_fortes ?? "",
                pontos_fracos: c.pontos_fracos ?? "",
                promessas: c.promessas ?? "",
                dossie_mandato: c.dossie_mandato ?? "",
                argumentos: c.argumentos ?? "",
              });
              setEditando(false);
            }}
            className="flex items-center gap-1 rounded bg-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-300"
          >
            <X size={12} /> Cancelar
          </button>
        </div>
      </li>
    );
  }

  return (
    <li className="group rounded border border-neutral-200 p-3 space-y-1">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium">
          {c.nome}
          {c.partido && <span className="text-neutral-500"> · {c.partido}</span>}
        </p>
        {podeEditar && (
          <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <button
              onClick={() => setEditando(true)}
              className="rounded p-1 text-neutral-400 hover:bg-indigo-50 hover:text-indigo-600"
              title="Editar"
            >
              <Pencil size={13} />
            </button>
            <button
              onClick={excluir}
              className="rounded p-1 text-neutral-400 hover:bg-red-50 hover:text-red-600"
              title="Excluir"
            >
              <Trash2 size={13} />
            </button>
          </div>
        )}
      </div>
      {c.pontos_fortes && <TextoFormatado texto={c.pontos_fortes} label="Pontos fortes" />}
      {c.pontos_fracos && <TextoFormatado texto={c.pontos_fracos} label="Pontos fracos" />}
      {c.promessas && <TextoFormatado texto={c.promessas} label="Promessas" />}
      {c.dossie_mandato && <TextoFormatado texto={c.dossie_mandato} label="Dossiê do Mandato" />}
      {c.argumentos && <TextoFormatado texto={c.argumentos} label="Argumentos" />}
      <SinaisConcorrente concorrenteId={c.id} podeRegistrar={podeEditar} />
      <AnunciosConcorrente nome={c.nome} />
    </li>
  );
}

export function ConcorrentesList({
  concorrentes: initial,
  podeEditar,
}: {
  concorrentes: Concorrente[];
  podeEditar: boolean;
}) {
  const router = useRouter();
  const [lista, setLista] = useState(initial);

  function handleExcluir(id: string) {
    setLista((prev) => prev.filter((c) => c.id !== id));
  }

  return (
    <>
      {lista.length === 0 && (
        <p className="text-sm text-neutral-400">Nenhum concorrente registrado ainda.</p>
      )}
      <ul className="space-y-2">
        {lista.map((c) => (
          <CardConcorrente
            key={c.id}
            c={c}
            podeEditar={podeEditar}
            onAtualizar={() => router.refresh()}
            onExcluir={handleExcluir}
          />
        ))}
      </ul>
    </>
  );
}
