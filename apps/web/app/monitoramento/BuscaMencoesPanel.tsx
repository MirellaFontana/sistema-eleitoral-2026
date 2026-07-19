"use client";

import { useState } from "react";

type Resultado = { titulo: string; link: string; fonte: string; publicadoEm: string | null };
type RespostaBusca = {
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

export function BuscaMencoesPanel({
  onEscolher,
}: {
  onEscolher: (item: { url: string; descricao: string }) => void;
}) {
  const [resultado, setResultado] = useState<RespostaBusca | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function buscar() {
    setCarregando(true);
    setErro(null);
    const res = await fetch("/api/monitoramento/buscar");
    const data = await res.json();
    setCarregando(false);

    if (!res.ok) {
      setErro(data.error ?? "erro ao buscar menções");
      return;
    }
    setResultado(data);
  }

  return (
    <div className="space-y-3 rounded border border-neutral-200 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Buscar menções automaticamente</h3>
          <p className="text-xs text-neutral-500">
            Busca pelo nome do candidato em notícias (e redes sociais, se configurado). Nada é
            registrado sozinho — você escolhe o que vira item.
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

      {resultado && (
        <div className="space-y-4">
          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Notícias
            </h4>
            {resultado.erroNoticias && (
              <p className="text-xs text-neutral-500">
                Não deu pra buscar: {resultado.erroNoticias}
              </p>
            )}
            {!resultado.erroNoticias && resultado.noticias.length === 0 && (
              <p className="text-xs text-neutral-400">Nenhuma notícia encontrada.</p>
            )}
            <ListaResultados itens={resultado.noticias} onEscolher={onEscolher} />
          </div>

          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Redes sociais
            </h4>
            {!resultado.redes.configurado && (
              <p className="text-xs text-amber-700">
                Busca em redes sociais ainda não configurada (falta credencial de API — X/Twitter).
              </p>
            )}
            {resultado.redes.configurado && resultado.redes.erro && (
              <p className="text-xs text-neutral-500">
                Não deu pra buscar: {resultado.redes.erro}
              </p>
            )}
            {resultado.redes.configurado &&
              !resultado.redes.erro &&
              resultado.redes.resultados.length === 0 && (
                <p className="text-xs text-neutral-400">Nenhum resultado encontrado.</p>
              )}
            <ListaResultados itens={resultado.redes.resultados} onEscolher={onEscolher} />
          </div>
        </div>
      )}
    </div>
  );
}
