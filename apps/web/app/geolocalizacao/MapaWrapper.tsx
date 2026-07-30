"use client";

import dynamic from "next/dynamic";
import type { Circulo, Ponto } from "./MapaCobertura";

// Leaflet depende de window — só carrega no cliente.
const MapaCobertura = dynamic(() => import("./MapaCobertura"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[480px] items-center justify-center rounded border border-neutral-200 text-sm text-neutral-400">
      Carregando mapa…
    </div>
  ),
});

export function MapaWrapper(props: {
  circulos: Circulo[];
  eleitores: Ponto[];
  apoiadores: Ponto[];
  liderancas: Ponto[];
  semCoordenada: number;
  centroPadrao?: { lat: number; lng: number; zoom: number };
}) {
  return <MapaCobertura {...props} />;
}
