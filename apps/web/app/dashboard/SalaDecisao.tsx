"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Zap,
  CalendarCheck,
  Eye,
  TrendingUp,
  Info,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
} from "lucide-react";

type ItemDecisao = {
  id: string;
  titulo: string;
  descricao: string;
  tipo: string;
  urgencia: string;
  fonte: string;
  porqueEstouVendo: string;
  link?: string;
};

type DadosSala = {
  decidaAgora: ItemDecisao[];
  facaHoje: ItemDecisao[];
  fiqueAtento: ItemDecisao[];
  oQueMudou: ItemDecisao[];
};

const QUADRANTES = [
  { key: "decidaAgora" as const, label: "Decida agora", icon: Zap, cor: "border-red-200 bg-red-50", icoCor: "text-red-500", desc: "Recomendações aprovadas ou críticas que precisam de ação imediata" },
  { key: "facaHoje" as const, label: "Faça hoje", icon: CalendarCheck, cor: "border-amber-200 bg-amber-50", icoCor: "text-amber-600", desc: "Tarefas prioritárias e prazos urgentes" },
  { key: "fiqueAtento" as const, label: "Fique atento", icon: Eye, cor: "border-blue-200 bg-blue-50", icoCor: "text-blue-500", desc: "Alertas, diretrizes sem definição, riscos no radar" },
  { key: "oQueMudou" as const, label: "O que mudou", icon: TrendingUp, cor: "border-indigo-200 bg-indigo-50", icoCor: "text-indigo-500", desc: "Mudanças recentes no monitoramento, novos alertas, recomendações geradas" },
] as const;

export function SalaDecisao() {
  const [dados, setDados] = useState<DadosSala | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandido, setExpandido] = useState<Record<string, boolean>>({});

  const carregar = useCallback(async () => {
    try {
      const res = await fetch("/api/sala-decisao");
      if (res.ok) setDados(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  if (loading) {
    return (
      <div className="mb-6 grid grid-cols-1 gap-3 lg:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-32 animate-pulse rounded-xl border border-neutral-200 bg-neutral-50" />
        ))}
      </div>
    );
  }

  if (!dados) return null;

  return (
    <div className="mb-6 grid grid-cols-1 gap-3 lg:grid-cols-2">
      {QUADRANTES.map((q) => {
        const itens = dados[q.key];
        const aberto = expandido[q.key] ?? true;
        return (
          <div key={q.key} className={`rounded-xl border ${q.cor} shadow-sm`}>
            <button
              onClick={() => setExpandido((p) => ({ ...p, [q.key]: !aberto }))}
              className="flex w-full items-center justify-between p-3"
            >
              <div className="flex items-center gap-2">
                <q.icon size={16} className={q.icoCor} />
                <h3 className="text-sm font-semibold text-neutral-700">{q.label}</h3>
                <span className="rounded-full bg-white/80 px-1.5 py-0.5 text-[10px] font-medium text-neutral-500">
                  {itens.length}
                </span>
              </div>
              {aberto ? <ChevronUp size={14} className="text-neutral-400" /> : <ChevronDown size={14} className="text-neutral-400" />}
            </button>

            {aberto && (
              <div className="border-t border-white/50 px-3 pb-3">
                {itens.length === 0 ? (
                  <p className="py-3 text-center text-xs text-neutral-400">{q.desc}</p>
                ) : (
                  <ul className="mt-1 space-y-1.5">
                    {itens.map((item) => (
                      <ItemCard key={item.id} item={item} />
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ItemCard({ item }: { item: ItemDecisao }) {
  const [showWhy, setShowWhy] = useState(false);

  const tituloEl = <p className="font-medium text-neutral-700">{item.titulo}</p>;

  return (
    <li className="rounded-lg bg-white/80 p-2.5 text-xs">
      <div className="flex items-start gap-2">
        {item.urgencia === "critica" && (
          <AlertTriangle size={12} className="mt-0.5 shrink-0 text-red-500" />
        )}
        <div className="min-w-0 flex-1">
          {item.link ? <Link href={item.link} className="hover:underline">{tituloEl}</Link> : tituloEl}
          {item.descricao && (
            <p className="mt-0.5 text-neutral-500 line-clamp-2">{item.descricao}</p>
          )}
          <div className="mt-1 flex items-center gap-2">
            <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-400">
              {item.fonte}
            </span>
            <button
              onClick={(e) => { e.preventDefault(); setShowWhy(!showWhy); }}
              className="flex items-center gap-0.5 text-[10px] text-indigo-500 hover:text-indigo-700"
            >
              <Info size={10} /> Por que estou vendo isto?
            </button>
          </div>
          {showWhy && (
            <p className="mt-1 rounded bg-indigo-50 px-2 py-1 text-[10px] text-indigo-600">
              {item.porqueEstouVendo}
            </p>
          )}
        </div>
      </div>
    </li>
  );
}
