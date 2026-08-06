"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Zap,
  CalendarCheck,
  Eye,
  TrendingUp,
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

type Resumo = {
  fontesComProblema: number;
  normativasDesatualizadas: number;
  temasIncoerentes: number;
  decisoesAtivas: number;
  demandasComPrazo: number;
  sinaisConcorrentes: number;
};

type DadosSala = {
  decidaAgora: ItemDecisao[];
  facaHoje: ItemDecisao[];
  fiqueAtento: ItemDecisao[];
  oQueMudou: ItemDecisao[];
  resumo?: Resumo;
};

const QUADRANTES = [
  { key: "decidaAgora" as const, label: "Decida agora", icon: Zap, borda: "border-red-200", bordaAtiva: "border-red-400 ring-1 ring-red-200", icoCor: "text-red-500", desc: "Recomendações críticas que precisam de ação imediata" },
  { key: "facaHoje" as const, label: "Faça hoje", icon: CalendarCheck, borda: "border-amber-200", bordaAtiva: "border-amber-400 ring-1 ring-amber-200", icoCor: "text-amber-600", desc: "Tarefas prioritárias e prazos urgentes" },
  { key: "fiqueAtento" as const, label: "Fique atento", icon: Eye, borda: "border-blue-200", bordaAtiva: "border-blue-400 ring-1 ring-blue-200", icoCor: "text-blue-500", desc: "Alertas, diretrizes sem definição, riscos no radar" },
  { key: "oQueMudou" as const, label: "O que mudou", icon: TrendingUp, borda: "border-indigo-200", bordaAtiva: "border-indigo-400 ring-1 ring-indigo-200", icoCor: "text-indigo-500", desc: "Mudanças recentes das últimas 24h" },
] as const;

export function SalaDecisao() {
  const [dados, setDados] = useState<DadosSala | null>(null);
  const [loading, setLoading] = useState(true);
  const [selecionado, setSelecionado] = useState<typeof QUADRANTES[number]["key"]>("decidaAgora");

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
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl border border-neutral-200 bg-neutral-50" />
        ))}
      </div>
    );
  }

  if (!dados) return null;

  const r = dados.resumo;

  return (
    <>
      {r && (r.fontesComProblema > 0 || r.normativasDesatualizadas > 0 || r.temasIncoerentes > 0 || r.decisoesAtivas > 0 || r.demandasComPrazo > 0 || r.sinaisConcorrentes > 0) && (
        <div className="mb-3 flex flex-wrap gap-2 text-xs">
          {r.decisoesAtivas > 0 && (
            <Link href="/decisoes" className="rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-indigo-700 hover:bg-indigo-100">
              {r.decisoesAtivas} {r.decisoesAtivas === 1 ? "decisão ativa" : "decisões ativas"}
            </Link>
          )}
          {r.temasIncoerentes > 0 && (
            <Link href="/narrativas" className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-amber-700 hover:bg-amber-100">
              {r.temasIncoerentes} {r.temasIncoerentes === 1 ? "tema com baixa coerência" : "temas com baixa coerência"}
            </Link>
          )}
          {r.fontesComProblema > 0 && (
            <Link href="/fontes" className="rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-red-700 hover:bg-red-100">
              {r.fontesComProblema} {r.fontesComProblema === 1 ? "fonte com problema" : "fontes com problema"}
            </Link>
          )}
          {r.normativasDesatualizadas > 0 && (
            <Link href="/base-normativa" className="rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-orange-700 hover:bg-orange-100">
              {r.normativasDesatualizadas} {r.normativasDesatualizadas === 1 ? "norma alterada" : "normas alteradas"}
            </Link>
          )}
          {r.demandasComPrazo > 0 && (
            <Link href="/demandas-observadas" className="rounded-full border border-purple-200 bg-purple-50 px-2.5 py-1 text-purple-700 hover:bg-purple-100">
              {r.demandasComPrazo} {r.demandasComPrazo === 1 ? "demanda com prazo próximo" : "demandas com prazo próximo"}
            </Link>
          )}
          {r.sinaisConcorrentes > 0 && (
            <Link href="/concorrentes" className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-rose-700 hover:bg-rose-100">
              {r.sinaisConcorrentes} {r.sinaisConcorrentes === 1 ? "sinal de concorrente" : "sinais de concorrentes"}
            </Link>
          )}
        </div>
      )}
    <div className="mb-3 grid grid-cols-2 gap-3 md:grid-cols-4">
      {QUADRANTES.map((q) => {
        const itens = dados[q.key];
        const ativo = selecionado === q.key;
        return (
          <button
            key={q.key}
            onClick={() => setSelecionado(q.key)}
            className={`rounded-xl border bg-white p-3 text-left shadow-sm transition-all ${
              ativo ? q.bordaAtiva : `${q.borda} hover:border-neutral-300`
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <q.icon size={15} className={q.icoCor} />
                <h3 className="text-[13px] font-semibold text-neutral-700">{q.label}</h3>
              </div>
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-neutral-100 px-1 text-[10px] font-medium text-neutral-500">
                {itens.length}
              </span>
            </div>
            <p className="mt-1 line-clamp-2 text-[11px] text-neutral-400">{q.desc}</p>
          </button>
        );
      })}
    </div>

    {(() => {
      const q = QUADRANTES.find((x) => x.key === selecionado)!;
      const itens = dados[q.key];
      return (
        <div className={`mb-6 rounded-xl border ${q.bordaAtiva} bg-white p-3 shadow-sm`}>
          <div className="mb-2 flex items-center gap-2">
            <q.icon size={16} className={q.icoCor} />
            <h3 className="text-sm font-semibold text-neutral-700">{q.label}</h3>
            <span className="rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-neutral-500">
              {itens.length}
            </span>
          </div>
          {itens.length === 0 ? (
            <p className="py-3 text-center text-xs text-neutral-400">{q.desc}</p>
          ) : (
            <ul className="space-y-1.5">
              {itens.map((item) => (
                <ItemCard key={item.id} item={item} />
              ))}
            </ul>
          )}
        </div>
      );
    })()}
    </>
  );
}

function ItemCard({ item }: { item: ItemDecisao }) {
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
          {item.link ? (
            <Link
              href={item.link}
              className="mt-1 inline-block rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-500 hover:bg-indigo-50 hover:text-indigo-600"
            >
              {item.fonte}
            </Link>
          ) : (
            <span className="mt-1 inline-block rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-400">
              {item.fonte}
            </span>
          )}
        </div>
      </div>
    </li>
  );
}
