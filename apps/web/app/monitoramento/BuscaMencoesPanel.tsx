"use client";

import { useState, useEffect } from "react";
import { Sparkles } from "lucide-react";

type Resultado = { titulo: string; link: string; fonte: string; publicadoEm: string | null };
type Grupo = {
  termoId: string;
  termo: string;
  rotulo: string | null;
  noticias: Resultado[];
  erroNoticias: string | null;
  redes: { configurado: boolean; resultados: Resultado[]; erro: string | null };
};

type MencaoAnalise = { indice: number; fonte: string; titulo_original: string };
type GrupoAnalise = {
  id: number;
  titulo_grupo: string;
  resumo: string;
  sentimento: "positivo" | "negativo" | "neutro";
  relevancia: "alta" | "media" | "baixa";
  categoria_sugerida: string;
  mencoes: MencaoAnalise[];
};
type AnaliseIA = {
  resumo_executivo: string;
  total_mencoes: number;
  sentimento_geral: string;
  grupos: GrupoAnalise[];
  alertas: string[];
};

type MencaoFlat = Resultado & { termo: string };

const SENTIMENTO_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  positivo: { bg: "bg-emerald-50", text: "text-emerald-700", label: "Positivo" },
  negativo: { bg: "bg-red-50", text: "text-red-700", label: "Negativo" },
  neutro: { bg: "bg-neutral-100", text: "text-neutral-600", label: "Neutro" },
};

const RELEVANCIA_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  alta: { bg: "bg-amber-50", text: "text-amber-700", label: "Alta" },
  media: { bg: "bg-sky-50", text: "text-sky-700", label: "Média" },
  baixa: { bg: "bg-neutral-50", text: "text-neutral-500", label: "Baixa" },
};

const CATEGORIA_LABEL: Record<string, string> = {
  ameaca_juridica: "Ameaça jurídica",
  deepfake_suspeito: "Deepfake suspeito",
  gestao_crise: "Gestão de crise",
  mencao_positiva: "Menção positiva",
  mencao_neutra: "Menção neutra",
  mencao_negativa: "Menção negativa",
  oportunidade_marketing: "Oportunidade",
  outro: "Outro",
};

function formatarData(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("pt-BR");
}

function ListaResultados({
  itens,
  onEscolher,
}: {
  itens: Resultado[];
  onEscolher: (item: { url: string; descricao: string }) => void;
}) {
  return (
    <ul className="space-y-1.5">
      {itens.map((item, i) => (
        <li
          key={i}
          className="rounded border border-neutral-100 p-2 text-sm"
        >
          <div className="mb-1">
            {item.link ? (
              <a
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-indigo-700 hover:text-indigo-900 hover:underline"
              >
                {item.titulo}
              </a>
            ) : (
              <p className="font-medium">{item.titulo}</p>
            )}
            <p className="text-xs text-neutral-400">
              {item.fonte}
              {formatarData(item.publicadoEm) ? ` · ${formatarData(item.publicadoEm)}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {item.link && (
              <a
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-neutral-500 hover:text-neutral-700 underline underline-offset-2"
              >
                Abrir matéria ↗
              </a>
            )}
            <button
              onClick={() => onEscolher({ url: item.link, descricao: item.titulo })}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
            >
              Registrar este item
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}

function GrupoTermoSimples({
  grupo,
  onEscolher,
}: {
  grupo: Grupo;
  onEscolher: (item: { url: string; descricao: string }) => void;
}) {
  return (
    <div className="space-y-3 rounded border border-neutral-200 p-3">
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-800">
          {grupo.termo}
        </span>
        {grupo.rotulo && <span className="text-xs text-neutral-400">{grupo.rotulo}</span>}
        <span className="text-xs text-neutral-400">({grupo.noticias.length} resultados)</span>
      </div>

      <div className="space-y-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Notícias</h4>
        {grupo.erroNoticias && (
          <p className="text-xs text-neutral-500">Não deu pra buscar: {grupo.erroNoticias}</p>
        )}
        {!grupo.erroNoticias && grupo.noticias.length === 0 && (
          <p className="text-xs text-neutral-400">Nenhuma notícia encontrada.</p>
        )}
        <ListaResultados itens={grupo.noticias} onEscolher={onEscolher} />
      </div>

      <div className="space-y-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Redes sociais
        </h4>
        {!grupo.redes.configurado && (
          <p className="text-xs text-amber-700">
            Busca em redes sociais ainda não configurada (falta credencial de API — X/Twitter).
          </p>
        )}
        {grupo.redes.configurado && grupo.redes.erro && (
          <p className="text-xs text-neutral-500">Não deu pra buscar: {grupo.redes.erro}</p>
        )}
        {grupo.redes.configurado && !grupo.redes.erro && grupo.redes.resultados.length === 0 && (
          <p className="text-xs text-neutral-400">Nenhum resultado encontrado.</p>
        )}
        <ListaResultados itens={grupo.redes.resultados} onEscolher={onEscolher} />
      </div>
    </div>
  );
}

function GrupoAnalisado({
  grupo,
  mencoesFlat,
  onEscolher,
}: {
  grupo: GrupoAnalise;
  mencoesFlat: MencaoFlat[];
  onEscolher: (item: { url: string; descricao: string }) => void;
}) {
  const sent = SENTIMENTO_STYLE[grupo.sentimento] ?? SENTIMENTO_STYLE.neutro;
  const rel = RELEVANCIA_STYLE[grupo.relevancia] ?? RELEVANCIA_STYLE.baixa;
  const cat = CATEGORIA_LABEL[grupo.categoria_sugerida] ?? grupo.categoria_sugerida;

  const borderColor =
    grupo.sentimento === "negativo"
      ? "border-l-red-400"
      : grupo.sentimento === "positivo"
        ? "border-l-emerald-400"
        : "border-l-neutral-300";

  return (
    <div className={`rounded border border-neutral-200 border-l-4 ${borderColor} p-3 space-y-2`}>
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="text-sm font-semibold">{grupo.titulo_grupo}</h4>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${sent.bg} ${sent.text}`}>
          {sent.label}
        </span>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${rel.bg} ${rel.text}`}>
          Relevância {rel.label}
        </span>
        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] text-neutral-500">
          {cat}
        </span>
      </div>

      <p className="text-xs text-neutral-500">{grupo.resumo}</p>

      {grupo.mencoes.length > 1 && (
        <p className="text-[11px] font-medium text-neutral-400 uppercase tracking-wide">
          {grupo.mencoes.length} fontes cobriram este fato
        </p>
      )}

      <ul className="space-y-1">
        {grupo.mencoes.map((m) => {
          const original = mencoesFlat[m.indice];
          if (!original) return null;
          return (
            <li key={m.indice} className="rounded bg-neutral-50 p-2 text-sm">
              <div className="mb-1">
                {original.link ? (
                  <a
                    href={original.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-indigo-700 hover:text-indigo-900 hover:underline"
                  >
                    {original.titulo}
                  </a>
                ) : (
                  <span className="font-medium">{original.titulo}</span>
                )}
                <p className="text-xs text-neutral-400">
                  {original.fonte}
                  {formatarData(original.publicadoEm) ? ` · ${formatarData(original.publicadoEm)}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {original.link && (
                  <a
                    href={original.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-neutral-500 hover:text-neutral-700 underline underline-offset-2"
                  >
                    Abrir matéria ↗
                  </a>
                )}
                <button
                  onClick={() =>
                    onEscolher({ url: original.link, descricao: original.titulo })
                  }
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                >
                  Registrar
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const SS_KEY_GRUPOS = "monitoramento:grupos";
const SS_KEY_ANALISE = "monitoramento:analise";
const SS_KEY_FLAT = "monitoramento:flat";

function salvarSessao(grupos: Grupo[], flat: MencaoFlat[], analise: AnaliseIA | null) {
  try {
    sessionStorage.setItem(SS_KEY_GRUPOS, JSON.stringify(grupos));
    sessionStorage.setItem(SS_KEY_FLAT, JSON.stringify(flat));
    if (analise) {
      sessionStorage.setItem(SS_KEY_ANALISE, JSON.stringify(analise));
    } else {
      sessionStorage.removeItem(SS_KEY_ANALISE);
    }
  } catch {}
}

function carregarSessao(): {
  grupos: Grupo[] | null;
  flat: MencaoFlat[];
  analise: AnaliseIA | null;
} {
  try {
    const g = sessionStorage.getItem(SS_KEY_GRUPOS);
    const f = sessionStorage.getItem(SS_KEY_FLAT);
    const a = sessionStorage.getItem(SS_KEY_ANALISE);
    if (!g || !f) return { grupos: null, flat: [], analise: null };
    return {
      grupos: JSON.parse(g),
      flat: JSON.parse(f),
      analise: a ? JSON.parse(a) : null,
    };
  } catch {
    return { grupos: null, flat: [], analise: null };
  }
}

export function BuscaMencoesPanel({
  onEscolher,
}: {
  onEscolher: (item: { url: string; descricao: string }) => void;
}) {
  const [grupos, setGrupos] = useState<Grupo[] | null>(null);
  const [analise, setAnalise] = useState<AnaliseIA | null>(null);
  const [mencoesFlat, setMencoesFlat] = useState<MencaoFlat[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [analisando, setAnalisando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const saved = carregarSessao();
    if (saved.grupos) {
      setGrupos(saved.grupos);
      setMencoesFlat(saved.flat);
      setAnalise(saved.analise);
    }
  }, []);

  async function buscar() {
    setCarregando(true);
    setErro(null);
    setGrupos(null);
    setAnalise(null);
    setMencoesFlat([]);
    try {
      const res = await fetch("/api/monitoramento/buscar");
      const contentType = res.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json")) {
        setErro("Sua sessão expirou. Atualize a página e faça login de novo.");
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        setErro(data.error ?? "erro ao buscar menções");
        return;
      }
      setGrupos(data.grupos);

      const flat: MencaoFlat[] = [];
      for (const g of data.grupos as Grupo[]) {
        for (const n of g.noticias) {
          flat.push({ ...n, termo: g.termo });
        }
        for (const r of g.redes.resultados) {
          flat.push({ ...r, termo: g.termo });
        }
      }
      setMencoesFlat(flat);
      salvarSessao(data.grupos, flat, null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha de conexão. Tente de novo.");
    } finally {
      setCarregando(false);
    }
  }

  async function analisarComIA() {
    if (mencoesFlat.length === 0) return;
    setAnalisando(true);
    setErro(null);
    try {
      const res = await fetch("/api/monitoramento/analisar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mencoes: mencoesFlat.map((m) => ({
            titulo: m.titulo,
            link: m.link,
            fonte: m.fonte,
            publicadoEm: m.publicadoEm,
            termo: m.termo,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErro(data.error ?? "erro ao analisar menções");
        return;
      }
      const analiseResult = data.analise as AnaliseIA;
      setAnalise(analiseResult);
      if (grupos) salvarSessao(grupos, mencoesFlat, analiseResult);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha de conexão ao analisar.");
    } finally {
      setAnalisando(false);
    }
  }

  return (
    <div className="space-y-3 rounded border border-neutral-200 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Buscar menções automaticamente</h3>
          <p className="text-xs text-neutral-500">
            Busca cada termo cadastrado em "O que monitorar". Após buscar, use "Analisar com IA"
            para classificar sentimento, agrupar matérias repetidas e gerar resumo executivo.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            onClick={buscar}
            disabled={carregando}
            className="rounded border border-neutral-300 px-3 py-1.5 text-sm font-medium disabled:opacity-50"
          >
            {carregando ? "Buscando…" : "Buscar"}
          </button>
          {grupos && mencoesFlat.length > 0 && (
            <button
              onClick={analisarComIA}
              disabled={analisando}
              className="flex items-center gap-1 rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              <Sparkles size={13} strokeWidth={2} />
              {analisando ? "Analisando…" : "Analisar com IA"}
            </button>
          )}
        </div>
      </div>

      {erro && <p className="text-sm text-red-600">{erro}</p>}

      {analise && (
        <div className="space-y-3">
          <div className="rounded bg-indigo-50 p-3 space-y-1">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-indigo-700">
              Resumo executivo da IA
            </h4>
            <p className="text-sm text-indigo-900">{analise.resumo_executivo}</p>
            <div className="flex gap-3 text-xs text-indigo-600">
              <span>{analise.total_mencoes} menções analisadas</span>
              <span>Sentimento geral: <strong>{analise.sentimento_geral}</strong></span>
              <span>{analise.grupos.length} grupos identificados</span>
            </div>
          </div>

          {analise.alertas && analise.alertas.length > 0 && (
            <div className="rounded bg-red-50 p-3 space-y-1">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-red-700">
                Alertas
              </h4>
              <ul className="space-y-0.5">
                {analise.alertas.map((a, i) => (
                  <li key={i} className="text-sm text-red-800">• {a}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="space-y-2">
            {analise.grupos.map((g) => (
              <GrupoAnalisado
                key={g.id}
                grupo={g}
                mencoesFlat={mencoesFlat}
                onEscolher={onEscolher}
              />
            ))}
          </div>
        </div>
      )}

      {grupos && !analise && (
        <div className="space-y-3">
          <p className="text-xs text-neutral-400">
            Resultados brutos — clique em "Analisar com IA" para classificar sentimento e agrupar matérias repetidas.
          </p>
          {grupos.map((g) => (
            <GrupoTermoSimples key={g.termoId} grupo={g} onEscolher={onEscolher} />
          ))}
        </div>
      )}
    </div>
  );
}
