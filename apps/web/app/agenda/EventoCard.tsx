"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, CheckCircle2, MapPin, Pencil, Trash2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { EventoForm, type EventoInicial, type LiderancaOpcao, type Territorio } from "./EventoForm";

export type Participante = { liderancaId: string; nome: string; compareceu: boolean | null };

export type EventoView = {
  id: string;
  titulo: string;
  tipo: string;
  status: string;
  dataInicio: string;
  dataFim: string | null;
  territorioId: string | null;
  territorioNome: string | null;
  localTexto: string | null;
  descricao: string | null;
  publicoEstimado: number | null;
  participantes: Participante[];
};

const TIPO_LABEL: Record<string, string> = {
  caminhada: "Caminhada",
  reuniao: "Reunião",
  comicio: "Comício",
  carreata: "Carreata",
  entrevista: "Entrevista",
  agenda_interna: "Agenda interna",
  outro: "Outro",
};

const STATUS_META: Record<string, { label: string; cls: string }> = {
  planejado: { label: "Planejado", cls: "bg-neutral-100 text-neutral-600" },
  confirmado: { label: "Confirmado", cls: "bg-indigo-50 text-indigo-700" },
  realizado: { label: "Realizado", cls: "bg-green-100 text-green-800" },
  cancelado: { label: "Cancelado", cls: "bg-neutral-100 text-neutral-400 line-through" },
};

const TIPOS_RUA = new Set(["caminhada", "comicio", "carreata"]);
const INICIO_PROPAGANDA = new Date(2026, 7, 16);

function horario(iso: string, fimIso: string | null): string {
  const fmt = (d: Date) =>
    `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  const inicio = fmt(new Date(iso));
  return fimIso ? `${inicio}–${fmt(new Date(fimIso))}` : inicio;
}

function RealizadoForm({ evento, onDone }: { evento: EventoView; onDone: () => void }) {
  const router = useRouter();
  const supabase = createClient();
  const [publico, setPublico] = useState<string>(evento.publicoEstimado?.toString() ?? "");
  const [presenca, setPresenca] = useState<Record<string, boolean>>(
    Object.fromEntries(evento.participantes.map((p) => [p.liderancaId, p.compareceu ?? false]))
  );
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function salvar() {
    setErro(null);
    setCarregando(true);
    try {
      const { error } = await supabase
        .from("eventos_campanha")
        .update({
          status: "realizado",
          publico_estimado: publico.trim() === "" ? null : Number(publico),
        })
        .eq("id", evento.id);
      if (error) throw new Error(error.message);

      for (const p of evento.participantes) {
        const { error: errPresenca } = await supabase
          .from("eventos_liderancas")
          .update({ compareceu: presenca[p.liderancaId] ?? false })
          .eq("evento_id", evento.id)
          .eq("lideranca_id", p.liderancaId);
        if (errPresenca) throw new Error(errPresenca.message);
      }

      onDone();
      router.refresh();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao marcar como realizado.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="space-y-3 rounded border border-neutral-200 bg-neutral-50 p-3">
      <div className="space-y-1">
        <label className="block text-xs font-medium text-neutral-500">
          Público estimado <span className="font-normal text-neutral-400">(opcional)</span>
        </label>
        <input
          type="number"
          min={0}
          value={publico}
          onChange={(e) => setPublico(e.target.value)}
          className="w-32 rounded border border-neutral-300 px-2 py-1.5 text-sm"
        />
      </div>

      {evento.participantes.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-neutral-500">Presença das lideranças</p>
          {evento.participantes.map((p) => (
            <label key={p.liderancaId} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={presenca[p.liderancaId] ?? false}
                onChange={(e) =>
                  setPresenca((atual) => ({ ...atual, [p.liderancaId]: e.target.checked }))
                }
              />
              {p.nome}
            </label>
          ))}
        </div>
      )}

      {erro && <p className="text-sm text-red-600">{erro}</p>}

      <div className="flex gap-2">
        <button
          onClick={salvar}
          disabled={carregando}
          className="flex items-center gap-1 rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          <CheckCircle2 size={14} strokeWidth={2} aria-hidden="true" />
          {carregando ? "Salvando…" : "Confirmar realização"}
        </button>
        <button
          onClick={onDone}
          className="flex items-center gap-1 rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-100"
        >
          <X size={14} strokeWidth={2} aria-hidden="true" />
          Cancelar
        </button>
      </div>
    </div>
  );
}

export function EventoCard({
  evento,
  campanhaId,
  territorios,
  liderancas,
  podeEditar,
}: {
  evento: EventoView;
  campanhaId: string;
  territorios: Territorio[];
  liderancas: LiderancaOpcao[];
  podeEditar: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [editando, setEditando] = useState(false);
  const [marcandoRealizado, setMarcandoRealizado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const statusMeta = STATUS_META[evento.status] ?? STATUS_META.planejado;
  const passadoSemAtualizar =
    new Date(evento.dataInicio) < new Date() &&
    (evento.status === "planejado" || evento.status === "confirmado");
  const avisoPrePropaganda =
    TIPOS_RUA.has(evento.tipo) &&
    new Date(evento.dataInicio) < INICIO_PROPAGANDA &&
    evento.status !== "cancelado" &&
    evento.status !== "realizado";

  async function cancelarEvento() {
    if (!confirm(`Cancelar o evento "${evento.titulo}"?`)) return;
    const { error } = await supabase
      .from("eventos_campanha")
      .update({ status: "cancelado" })
      .eq("id", evento.id);
    if (error) setErro(error.message);
    else router.refresh();
  }

  async function excluirEvento() {
    if (!confirm(`Excluir o evento "${evento.titulo}"? Isso não pode ser desfeito.`)) return;
    const { error } = await supabase.from("eventos_campanha").delete().eq("id", evento.id);
    if (error) setErro(error.message);
    else router.refresh();
  }

  if (editando) {
    const inicial: EventoInicial = {
      id: evento.id,
      titulo: evento.titulo,
      tipo: evento.tipo,
      status: evento.status,
      dataInicio: evento.dataInicio,
      dataFim: evento.dataFim,
      territorioId: evento.territorioId,
      localTexto: evento.localTexto,
      descricao: evento.descricao,
      liderancaIds: evento.participantes.map((p) => p.liderancaId),
    };
    return (
      <EventoForm
        campanhaId={campanhaId}
        territorios={territorios}
        liderancas={liderancas}
        evento={inicial}
        onDone={() => setEditando(false)}
      />
    );
  }

  return (
    <div
      className={`space-y-2 rounded border p-3 ${
        passadoSemAtualizar ? "border-amber-300 bg-amber-50/50" : "border-neutral-200"
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-neutral-500">
          {horario(evento.dataInicio, evento.dataFim)}
        </span>
        <p className="text-sm font-medium">{evento.titulo}</p>
        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">
          {TIPO_LABEL[evento.tipo] ?? evento.tipo}
        </span>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusMeta.cls}`}>
          {statusMeta.label}
        </span>
        {passadoSemAtualizar && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
            pendente de atualização
          </span>
        )}
      </div>

      {(evento.territorioNome || evento.localTexto) && (
        <p className="flex items-center gap-1 text-xs text-neutral-500">
          <MapPin size={12} strokeWidth={2} aria-hidden="true" />
          {[evento.territorioNome, evento.localTexto].filter(Boolean).join(" · ")}
        </p>
      )}

      {evento.descricao && <p className="text-sm text-neutral-600">{evento.descricao}</p>}

      {evento.participantes.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {evento.participantes.map((p) => (
            <span
              key={p.liderancaId}
              className="flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600"
            >
              {evento.status === "realizado" && p.compareceu === true && (
                <Check size={11} strokeWidth={2.5} className="text-green-700" aria-hidden="true" />
              )}
              {evento.status === "realizado" && p.compareceu === false && (
                <X size={11} strokeWidth={2.5} className="text-neutral-400" aria-hidden="true" />
              )}
              {p.nome}
            </span>
          ))}
        </div>
      )}

      {evento.status === "realizado" && evento.publicoEstimado !== null && (
        <p className="text-xs text-neutral-500">
          Público estimado: <strong className="text-neutral-700">{evento.publicoEstimado}</strong>
        </p>
      )}

      {avisoPrePropaganda && (
        <p className="flex items-start gap-1.5 text-xs text-amber-800">
          <AlertTriangle size={13} strokeWidth={2} className="mt-0.5 shrink-0" aria-hidden="true" />
          Evento de rua antes de 16/08/2026 — confirme o enquadramento legal com o jurídico.
        </p>
      )}

      {erro && <p className="text-sm text-red-600">{erro}</p>}

      {marcandoRealizado && (
        <RealizadoForm evento={evento} onDone={() => setMarcandoRealizado(false)} />
      )}

      {podeEditar && !marcandoRealizado && (
        <div className="flex flex-wrap gap-2 pt-1">
          <button
            onClick={() => setEditando(true)}
            className="flex items-center gap-1 rounded border border-neutral-300 px-2 py-1 text-xs text-neutral-600 hover:bg-neutral-50"
          >
            <Pencil size={12} strokeWidth={2} aria-hidden="true" />
            Editar
          </button>
          {evento.status !== "realizado" && evento.status !== "cancelado" && (
            <>
              <button
                onClick={() => setMarcandoRealizado(true)}
                className="flex items-center gap-1 rounded border border-green-300 px-2 py-1 text-xs text-green-700 hover:bg-green-50"
              >
                <CheckCircle2 size={12} strokeWidth={2} aria-hidden="true" />
                Marcar realizado
              </button>
              <button
                onClick={cancelarEvento}
                className="flex items-center gap-1 rounded border border-neutral-300 px-2 py-1 text-xs text-neutral-600 hover:bg-neutral-50"
              >
                <X size={12} strokeWidth={2} aria-hidden="true" />
                Cancelar evento
              </button>
            </>
          )}
          <button
            onClick={excluirEvento}
            className="flex items-center gap-1 rounded border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
          >
            <Trash2 size={12} strokeWidth={2} aria-hidden="true" />
            Excluir
          </button>
        </div>
      )}
    </div>
  );
}
