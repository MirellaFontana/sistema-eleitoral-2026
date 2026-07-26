"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";

type Briefing = {
  conteudo: string;
  created_at: string;
};

export function BriefingDiario({
  briefingInicial,
  podeGerar,
  eventosHoje,
}: {
  briefingInicial: Briefing | null;
  podeGerar: boolean;
  eventosHoje: number;
}) {
  const router = useRouter();
  const [briefing, setBriefing] = useState<Briefing | null>(briefingInicial);
  const [semEventos, setSemEventos] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function gerar() {
    setErro(null);
    setSemEventos(false);
    setCarregando(true);
    try {
      const res = await fetch("/api/briefing", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setErro(data.error ?? "erro ao gerar briefing");
        return;
      }
      if (data.semEventos) {
        setSemEventos(true);
        return;
      }
      setBriefing({ conteudo: data.conteudo, created_at: data.created_at });
      router.refresh();
    } catch {
      setErro("Falha de conexão ao gerar o briefing. Tente de novo.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <section className="mb-6 rounded-xl border border-indigo-100 bg-white p-4 shadow-sm shadow-neutral-900/5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-neutral-700">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
            <Sparkles size={14} strokeWidth={2} aria-hidden="true" />
          </span>
          Briefing do dia
          <span className="font-normal text-neutral-400">
            · {eventosHoje} {eventosHoje === 1 ? "evento hoje" : "eventos hoje"}
          </span>
        </h2>
        {podeGerar && (
          <button
            onClick={gerar}
            disabled={carregando}
            className="rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {carregando ? "Gerando…" : briefing ? "Gerar novamente" : "Gerar briefing de hoje"}
          </button>
        )}
      </div>

      {erro && <p className="text-sm text-red-600">{erro}</p>}

      {semEventos && (
        <p className="text-sm text-neutral-500">
          Sem eventos na agenda de hoje — nada para preparar. Cadastre eventos na Agenda para
          gerar o briefing.
        </p>
      )}

      {briefing ? (
        <div className="space-y-2">
          <p className="text-xs text-neutral-400">
            Gerado às{" "}
            {new Date(briefing.created_at).toLocaleTimeString("pt-BR", {
              hour: "2-digit",
              minute: "2-digit",
            })}{" "}
            — apoio à preparação, não instrução automática.
          </p>
          <div className="whitespace-pre-wrap rounded border border-neutral-200 bg-neutral-50 p-3 text-sm leading-relaxed">
            {briefing.conteudo}
          </div>
        </div>
      ) : (
        !semEventos &&
        !erro && (
          <p className="text-sm text-neutral-400">
            {podeGerar
              ? "Nenhum briefing gerado hoje. O briefing cruza a agenda do dia com as demandas da região, lideranças presentes e as propostas da campanha."
              : "Nenhum briefing gerado hoje ainda."}
          </p>
        )
      )}
    </section>
  );
}
