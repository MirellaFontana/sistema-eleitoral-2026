"use client";

import dynamic from "next/dynamic";

export type PontoAtivo = {
  lat: number;
  lng: number;
  nome: string;
  categoria: string;
  nivel: string;
};

const MapaAtivos = dynamic(() => import("./MapaAtivos"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[480px] items-center justify-center rounded border border-neutral-200 text-sm text-neutral-400">
      Carregando mapa…
    </div>
  ),
});

export function MapaAtivosWrapper(props: {
  pontos: PontoAtivo[];
  centroPadrao?: { lat: number; lng: number; zoom: number };
}) {
  return <MapaAtivos {...props} />;
}
