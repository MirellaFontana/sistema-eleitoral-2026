"use client";

import { useState } from "react";
import { Megaphone } from "lucide-react";

type Anuncio = {
  id: string;
  pagina: string | null;
  patrocinador: string | null;
  texto: string | null;
  titulo: string | null;
  legenda: string | null;
  inicio: string | null;
  fim: string | null;
  gastoMin: string | null;
  gastoMax: string | null;
  moeda: string | null;
  impressoesMin: string | null;
  impressoesMax: string | null;
  plataformas: string[];
};

function fmtData(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString("pt-BR");
}

export function AnunciosConcorrente({ nome }: { nome: string }) {
  const [anuncios, setAnuncios] = useState<Anuncio[] | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aberto, setAberto] = useState(false);

  async function buscar() {
    setCarregando(true);
    setErro(null);
    try {
      const res = await fetch(
        `/api/concorrentes/anuncios?nome=${encodeURIComponent(nome)}`,
      );
      const data = await res.json();
      if (!res.ok) {
        setErro(data.error ?? "erro ao buscar anúncios");
        return;
      }
      setAnuncios(data.anuncios);
      setAberto(true);
    } catch {
      setErro("Falha de conexão.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        onClick={aberto && anuncios ? () => setAberto(!aberto) : buscar}
        disabled={carregando}
        className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium disabled:opacity-50"
      >
        <Megaphone size={12} />
        {carregando
          ? "Buscando…"
          : aberto
            ? "Recolher anúncios"
            : anuncios
              ? `Ver ${anuncios.length} anúncios`
              : "Ver anúncios (Meta Ad Library)"}
      </button>

      {erro && <p className="text-xs text-red-600">{erro}</p>}

      {aberto && anuncios && (
        <div className="space-y-1.5">
          {anuncios.length === 0 && (
            <p className="text-xs text-neutral-400">
              Nenhum anúncio político encontrado para "{nome}".
            </p>
          )}
          {anuncios.map((ad) => (
            <div
              key={ad.id}
              className="rounded border border-neutral-100 bg-neutral-50 p-2 text-xs space-y-1"
            >
              <div className="flex flex-wrap items-center gap-2">
                {ad.pagina && (
                  <span className="font-medium text-neutral-700">{ad.pagina}</span>
                )}
                {ad.patrocinador && (
                  <span className="text-neutral-400">{ad.patrocinador}</span>
                )}
                {ad.plataformas.length > 0 && (
                  <span className="text-neutral-400">
                    {ad.plataformas.join(", ")}
                  </span>
                )}
              </div>

              {ad.titulo && <p className="font-medium text-neutral-800">{ad.titulo}</p>}
              {ad.texto && (
                <p className="text-neutral-600 line-clamp-3">{ad.texto}</p>
              )}

              <div className="flex flex-wrap gap-3 text-neutral-400">
                {ad.inicio && <span>Início: {fmtData(ad.inicio)}</span>}
                {ad.fim && <span>Fim: {fmtData(ad.fim)}</span>}
                {!ad.fim && ad.inicio && (
                  <span className="text-emerald-600 font-medium">Ativo</span>
                )}
                {ad.gastoMin && ad.gastoMax && (
                  <span>
                    Gasto: {ad.moeda} {ad.gastoMin}–{ad.gastoMax}
                  </span>
                )}
                {ad.impressoesMin && ad.impressoesMax && (
                  <span>
                    Impressões: {Number(ad.impressoesMin).toLocaleString("pt-BR")}–
                    {Number(ad.impressoesMax).toLocaleString("pt-BR")}
                  </span>
                )}
              </div>

              <a
                href={`https://www.facebook.com/ads/library/?id=${ad.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-600 hover:text-indigo-800 underline underline-offset-2"
              >
                Ver na Biblioteca de Anúncios ↗
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
