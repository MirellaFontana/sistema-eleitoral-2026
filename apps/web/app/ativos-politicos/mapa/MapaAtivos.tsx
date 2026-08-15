"use client";

import { useState, useEffect } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.heat";
import type { PontoAtivo } from "./MapaAtivosWrapper";

const CENTRO_BRASIL = { lat: -14.235, lng: -51.9253, zoom: 4 };

const COR_NIVEL: Record<string, string> = {
  muito_alto: "#7c3aed",
  alto: "#2563eb",
  medio: "#0891b2",
  baixo: "#6b7280",
  nao_avaliado: "#a1a1aa",
};

function HeatLayer({ pontos }: { pontos: PontoAtivo[] }) {
  const map = useMap();
  useEffect(() => {
    if (pontos.length === 0) return;
    const layer = L.heatLayer(
      pontos.map((p) => [p.lat, p.lng, 1]),
      { radius: 25, blur: 15, maxZoom: 17, minOpacity: 0.4 }
    );
    layer.addTo(map);
    return () => { map.removeLayer(layer); };
  }, [map, pontos]);
  return null;
}

export default function MapaAtivos({
  pontos,
  centroPadrao,
}: {
  pontos: PontoAtivo[];
  centroPadrao?: { lat: number; lng: number; zoom: number };
}) {
  const [modo, setModo] = useState<"pins" | "calor">("pins");

  const centro = centroPadrao ?? (pontos.length > 0
    ? { lat: pontos[0].lat, lng: pontos[0].lng, zoom: 8 }
    : CENTRO_BRASIL);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setModo("pins")}
          className={`rounded px-3 py-1 text-xs font-medium ${modo === "pins" ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"}`}
        >
          Marcadores
        </button>
        <button
          onClick={() => setModo("calor")}
          className={`rounded px-3 py-1 text-xs font-medium ${modo === "calor" ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"}`}
        >
          Mapa de calor
        </button>
        <span className="ml-auto text-xs text-neutral-400">{pontos.length} ponto(s)</span>
      </div>

      <MapContainer
        center={[centro.lat, centro.lng]}
        zoom={centro.zoom}
        className="h-[480px] w-full rounded-lg border border-neutral-200"
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {modo === "calor" && <HeatLayer pontos={pontos} />}

        {modo === "pins" && pontos.map((p, i) => (
          <CircleMarker
            key={i}
            center={[p.lat, p.lng]}
            radius={6}
            pathOptions={{
              fillColor: COR_NIVEL[p.nivel] ?? "#6b7280",
              fillOpacity: 0.8,
              color: "#fff",
              weight: 1.5,
            }}
          >
            <Popup>
              <div className="text-xs">
                <p className="font-semibold">{p.nome}</p>
                {p.categoria && <p className="text-neutral-500">{p.categoria}</p>}
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>

      {modo === "pins" && (
        <div className="flex flex-wrap gap-3 text-xs text-neutral-500">
          {Object.entries(COR_NIVEL).map(([nivel, cor]) => (
            <span key={nivel} className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: cor }} />
              {nivel.replace(/_/g, " ")}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
