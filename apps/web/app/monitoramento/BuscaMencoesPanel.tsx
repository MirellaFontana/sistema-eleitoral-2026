"use client";

import { useState } from "react";

type Resultado = { titulo: string; link: string; fonte: string; publicadoEm: string | null };
type Grupo = {
  termoId: string;
  termo: string;
  rotulo: string | null;
  noticias: Resultado[];
  erroNoticias: string | null;
  redes: { configurado: boolean; resultados: Resultado[]; erro: string | null };
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
          className="flex items-start justify-between gap-3 rounded border border-neutral-100 p-2 text-sm"
        >
          <div>
            <p>{item.titulo}</p>
            <p className="text-xs text-neutral-400">
              {item.fonte}
              {formatarData(item.publicadoEm) ? ` · ${formatarData(item.publicadoEm)}` : ""}
            </p>
          </div>
          <button
            onClick={() => onEscolher({ url: item.link, descricao: item.titulo })}
            className="shrink-0 text-xs text-neutral-900 underline underline-offset-2"
          >
            Usar este item
          </button>
        </li>
      ))}
    </ul>
  );
}

function GrupoTermo({
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

export function BuscaMencoesPanel({
  onEscolher,
}: {
  onEscolher: (item: { url: string; descricao: string }) => void;
}) {
  const [grupos, setGrupos] = useState<Grupo[] | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function buscar() {
    setCarregando(true);
    setErro(null);
    setGrupos(null);
    try {
      const res = await fetch("/api/monitoramento/buscar");

      // Sessão expirada faz o middleware redirecionar a própria chamada de API pro
      // /login (HTML) em vez de rodar a rota — isso geraria uma resposta que não é JSON,
      // e res.json() quebraria silenciosamente, deixando o botão travado sem erro.
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
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha de conexão ao buscar menções. Tente de novo.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="space-y-3 rounded border border-neutral-200 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Buscar menções automaticamente</h3>
          <p className="text-xs text-neutral-500">
            Busca cada termo cadastrado em "O que monitorar" — notícias (e redes sociais, se
            configurado). Nada é registrado sozinho — você escolhe o que vira item.
          </p>
        </div>
        <button
          onClick={buscar}
          disabled={carregando}
          className="shrink-0 rounded border border-neutral-300 px-3 py-1.5 text-sm font-medium disabled:opacity-50"
        >
          {carregando ? "Buscando…" : "Buscar"}
        </button>
      </div>

      {erro && <p className="text-sm text-red-600">{erro}</p>}

      {grupos && (
        <div className="space-y-3">
          {grupos.map((g) => (
            <GrupoTermo key={g.termoId} grupo={g} onEscolher={onEscolher} />
          ))}
        </div>
      )}
    </div>
  );
}
