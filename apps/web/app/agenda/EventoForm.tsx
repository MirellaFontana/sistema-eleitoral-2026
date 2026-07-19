"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export type Territorio = { id: string; nome_bairro: string | null };
export type LiderancaOpcao = { id: string; nome: string };

export type EventoInicial = {
  id: string;
  titulo: string;
  tipo: string;
  status: string;
  dataInicio: string;
  dataFim: string | null;
  territorioId: string | null;
  localTexto: string | null;
  descricao: string | null;
  liderancaIds: string[];
};

const TIPOS = [
  { value: "caminhada", label: "Caminhada" },
  { value: "reuniao", label: "Reunião" },
  { value: "comicio", label: "Comício" },
  { value: "carreata", label: "Carreata" },
  { value: "entrevista", label: "Entrevista" },
  { value: "agenda_interna", label: "Agenda interna" },
  { value: "outro", label: "Outro" },
];

// Tipos de ato de rua — antes de 16/08 mostram aviso de pré-propaganda (não bloqueia:
// o enquadramento legal do ato é responsabilidade humana, o sistema só lembra).
const TIPOS_RUA = new Set(["caminhada", "comicio", "carreata"]);
const INICIO_PROPAGANDA = new Date(2026, 7, 16); // 16/08/2026

function isoParaLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function EventoForm({
  campanhaId,
  territorios,
  liderancas,
  evento,
  onDone,
}: {
  campanhaId: string;
  territorios: Territorio[];
  liderancas: LiderancaOpcao[];
  evento?: EventoInicial;
  onDone?: () => void;
}) {
  const router = useRouter();
  const supabase = createClient();
  const editando = Boolean(evento);

  const [titulo, setTitulo] = useState(evento?.titulo ?? "");
  const [tipo, setTipo] = useState(evento?.tipo ?? TIPOS[0].value);
  const [dataInicio, setDataInicio] = useState(isoParaLocal(evento?.dataInicio ?? null));
  const [dataFim, setDataFim] = useState(isoParaLocal(evento?.dataFim ?? null));
  const [territorioId, setTerritorioId] = useState(evento?.territorioId ?? "");
  const [localTexto, setLocalTexto] = useState(evento?.localTexto ?? "");
  const [descricao, setDescricao] = useState(evento?.descricao ?? "");
  const [selecionadas, setSelecionadas] = useState<Set<string>>(
    new Set(evento?.liderancaIds ?? [])
  );
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  const avisoPrePropaganda =
    TIPOS_RUA.has(tipo) && dataInicio !== "" && new Date(dataInicio) < INICIO_PROPAGANDA;

  function toggleLideranca(id: string) {
    setSelecionadas((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);

    if (dataFim && new Date(dataFim) <= new Date(dataInicio)) {
      setErro("O fim do evento precisa ser depois do início.");
      return;
    }

    setCarregando(true);
    try {
      const dados = {
        titulo: titulo.trim(),
        tipo,
        data_inicio: new Date(dataInicio).toISOString(),
        data_fim: dataFim ? new Date(dataFim).toISOString() : null,
        territorio_id: territorioId || null,
        local_texto: localTexto.trim() || null,
        descricao: descricao.trim() || null,
      };

      let eventoId: string;
      if (editando && evento) {
        const { error } = await supabase.from("eventos_campanha").update(dados).eq("id", evento.id);
        if (error) throw new Error(error.message);
        eventoId = evento.id;
      } else {
        const { data: row, error } = await supabase
          .from("eventos_campanha")
          .insert({ ...dados, campanha_id: campanhaId })
          .select("id")
          .single();
        if (error) throw new Error(error.message);
        eventoId = row.id;
      }

      // Reconcilia o vínculo por diff (não apaga tudo e recria) — preserva a presença
      // (compareceu) já marcada das lideranças que permanecem no evento.
      const iniciais = new Set(evento?.liderancaIds ?? []);
      const adicionar = [...selecionadas].filter((id) => !iniciais.has(id));
      const remover = [...iniciais].filter((id) => !selecionadas.has(id));

      if (remover.length > 0) {
        const { error } = await supabase
          .from("eventos_liderancas")
          .delete()
          .eq("evento_id", eventoId)
          .in("lideranca_id", remover);
        if (error) throw new Error(error.message);
      }
      if (adicionar.length > 0) {
        const { error } = await supabase
          .from("eventos_liderancas")
          .insert(adicionar.map((id) => ({ evento_id: eventoId, lideranca_id: id })));
        if (error) throw new Error(error.message);
      }

      if (!editando) {
        setTitulo("");
        setDataInicio("");
        setDataFim("");
        setTerritorioId("");
        setLocalTexto("");
        setDescricao("");
        setSelecionadas(new Set());
      }
      onDone?.();
      router.refresh();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao salvar o evento.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded border border-neutral-200 p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1 sm:col-span-2">
          <label className="block text-xs font-medium text-neutral-500">Título</label>
          <input
            required
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Ex.: Caminhada no centro"
            className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-medium text-neutral-500">Tipo</label>
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
            className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
          >
            {TIPOS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-medium text-neutral-500">Território</label>
          <select
            value={territorioId}
            onChange={(e) => setTerritorioId(e.target.value)}
            className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
          >
            <option value="">nenhum</option>
            {territorios.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nome_bairro ?? "sem nome"}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-medium text-neutral-500">Início</label>
          <input
            type="datetime-local"
            required
            value={dataInicio}
            onChange={(e) => setDataInicio(e.target.value)}
            className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-medium text-neutral-500">
            Fim <span className="font-normal text-neutral-400">(opcional)</span>
          </label>
          <input
            type="datetime-local"
            value={dataFim}
            onChange={(e) => setDataFim(e.target.value)}
            className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
          />
        </div>

        <div className="space-y-1 sm:col-span-2">
          <label className="block text-xs font-medium text-neutral-500">
            Local <span className="font-normal text-neutral-400">(opcional)</span>
          </label>
          <input
            value={localTexto}
            onChange={(e) => setLocalTexto(e.target.value)}
            placeholder="Ex.: Praça da Matriz, em frente ao coreto"
            className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
          />
        </div>

        <div className="space-y-1 sm:col-span-2">
          <label className="block text-xs font-medium text-neutral-500">
            Descrição <span className="font-normal text-neutral-400">(opcional)</span>
          </label>
          <textarea
            rows={2}
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
          />
        </div>
      </div>

      {liderancas.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-neutral-500">Lideranças envolvidas</p>
          <div className="flex flex-wrap gap-1.5">
            {liderancas.map((l) => {
              const ativa = selecionadas.has(l.id);
              return (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => toggleLideranca(l.id)}
                  className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                    ativa
                      ? "border-indigo-600 bg-indigo-50 font-medium text-indigo-700"
                      : "border-neutral-200 text-neutral-600 hover:border-neutral-400"
                  }`}
                >
                  {l.nome}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {avisoPrePropaganda && (
        <p className="flex items-start gap-1.5 rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
          <AlertTriangle size={14} strokeWidth={2} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>
            Evento de rua antes do início da propaganda eleitoral (16/08/2026) — confirme o
            enquadramento legal do ato com o jurídico (Lei 9.504, art. 36-A).
          </span>
        </p>
      )}
      {tipo === "comicio" && (
        <p className="text-xs text-neutral-400">
          Lembrete: showmício (apresentação artística em comício) é vedado em qualquer data —
          Lei 9.504, art. 39 §7º.
        </p>
      )}

      {erro && <p className="text-sm text-red-600">{erro}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={carregando}
          className="flex items-center gap-1 rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          <Check size={14} strokeWidth={2} aria-hidden="true" />
          {carregando ? "Salvando…" : editando ? "Salvar alterações" : "Criar evento"}
        </button>
        {editando && onDone && (
          <button
            type="button"
            onClick={onDone}
            className="flex items-center gap-1 rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-50"
          >
            <X size={14} strokeWidth={2} aria-hidden="true" />
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}
