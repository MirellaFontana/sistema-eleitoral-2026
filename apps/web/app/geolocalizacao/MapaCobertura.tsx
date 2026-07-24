"use client";

import { useState, useEffect } from "react";
import { MapContainer, TileLayer, Circle, CircleMarker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.heat";
import { labelTerritorio } from "@/lib/territorio";

export type Circulo = {
  id: string;
  bairro: string | null;
  cidade: string | null;
  lat: number;
  lng: number;
  cadastros: number;
  apoiadores: number;
  liderancas: number;
  metaAlvo: number | null;
};

export type Ponto = { lat: number; lng: number };

function HeatLayer({ pontos }: { pontos: Ponto[] }) {
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

function corDoCirculo(c: Circulo): string {
  if (!c.metaAlvo) return "#2563eb"; // azul — sem meta
  const pct = (c.cadastros / c.metaAlvo) * 100;
  if (pct >= 100) return "#059669"; // verde
  if (pct >= 70) return "#d97706"; // âmbar
  return "#dc2626"; // vermelho
}

// Centro do Brasil — último recurso, só se a campanha não tiver UF e ainda não houver
// nenhum território com coordenada (não deveria acontecer no fluxo normal de cadastro).
const CENTRO_BRASIL = { lat: -14.235, lng: -51.9253, zoom: 4 };

export default function MapaCobertura({
  circulos,
  eleitores,
  semCoordenada,
  centroPadrao,
}: {
  circulos: Circulo[];
  eleitores: Ponto[];
  semCoordenada: number;
  centroPadrao?: { lat: number; lng: number; zoom: number };
}) {
  const [modoEleitores, setModoEleitores] = useState<"off" | "heatmap" | "pontos">("off");

  // Com território cadastrado, centraliza na média real dos círculos (mais preciso, mais
  // próximo). Sem nenhum ainda, usa o estado da campanha como enquadramento inicial.
  const temCirculos = circulos.length > 0;
  const centro = temCirculos
    ? {
        lat: circulos.reduce((s, c) => s + c.lat, 0) / circulos.length,
        lng: circulos.reduce((s, c) => s + c.lng, 0) / circulos.length,
        zoom: 12,
      }
    : (centroPadrao ?? CENTRO_BRASIL);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-4 text-sm text-neutral-700">
        <span className="font-medium">Eleitores ({eleitores.length} com GPS):</span>
        {(["off", "heatmap", "pontos"] as const).map((modo) => (
          <label key={modo} className="flex items-center gap-1.5">
            <input
              type="radio"
              name="modoEleitores"
              checked={modoEleitores === modo}
              onChange={() => setModoEleitores(modo)}
            />
            {modo === "off" ? "Oculto" : modo === "heatmap" ? "Mapa de calor" : "Pontos"}
          </label>
        ))}
      </div>

      <div className="overflow-hidden rounded border border-neutral-200">
        <MapContainer
          key={`${centro.lat}-${centro.lng}`}
          center={[centro.lat, centro.lng]}
          zoom={centro.zoom}
          style={{ height: 480, width: "100%" }}
          scrollWheelZoom
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {circulos.map((c) => {
            const cor = corDoCirculo(c);
            const raio = Math.min(1600, 350 + Math.sqrt(c.cadastros) * 90);
            const pct = c.metaAlvo ? Math.round((c.cadastros / c.metaAlvo) * 100) : null;
            return (
              <Circle
                key={c.id}
                center={[c.lat, c.lng]}
                radius={raio}
                pathOptions={{ color: cor, fillColor: cor, fillOpacity: 0.25, weight: 2 }}
              >
                <Popup>
                  <div style={{ minWidth: 170 }}>
                    <p style={{ fontWeight: 600, marginBottom: 4 }}>{labelTerritorio(c.bairro, c.cidade)}</p>
                    <p style={{ margin: 0 }}>Cadastros: {c.cadastros}</p>
                    <p style={{ margin: 0 }}>Apoiadores: {c.apoiadores}</p>
                    <p style={{ margin: 0 }}>Lideranças: {c.liderancas}</p>
                    {c.metaAlvo ? (
                      <p style={{ margin: 0 }}>
                        Meta: {c.cadastros}/{c.metaAlvo} ({pct}%)
                      </p>
                    ) : (
                      <p style={{ margin: 0, color: "#6b7280" }}>Sem meta definida</p>
                    )}
                    {semCoordenada > 0 && (
                      <p style={{ margin: "4px 0 0", color: "#c2410c" }}>
                        {semCoordenada} sem coordenada no mapa
                      </p>
                    )}
                  </div>
                </Popup>
              </Circle>
            );
          })}

          {modoEleitores === "heatmap" && <HeatLayer pontos={eleitores} />}

          {modoEleitores === "pontos" &&
            eleitores.map((p, i) => (
              <CircleMarker
                key={i}
                center={[p.lat, p.lng]}
                radius={4}
                pathOptions={{ color: "#1e2761", fillColor: "#1e2761", fillOpacity: 0.7, weight: 1 }}
              />
            ))}
        </MapContainer>
      </div>
    </div>
  );
}
