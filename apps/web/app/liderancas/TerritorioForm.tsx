"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function TerritorioForm({ campanhaId }: { campanhaId: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [nomeBairro, setNomeBairro] = useState("");
  const [cidade, setCidade] = useState("");
  const [zonaEleitoral, setZonaEleitoral] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [buscando, setBuscando] = useState(false);

  // Busca a coordenada no Nominatim (OpenStreetMap). Bairro é opcional — cidade pequena pode
  // ter só uma liderança pra cidade inteira, sem granularidade de bairro. Só nome de
  // bairro/cidade sai do sistema — nunca dado pessoal.
  async function buscarCoordenada() {
    setErro(null);
    if (!cidade.trim()) {
      setErro("Preencha ao menos a cidade antes de buscar a coordenada.");
      return;
    }
    setBuscando(true);
    try {
      const partes = [nomeBairro.trim(), cidade.trim(), "Brasil"].filter(Boolean);
      const q = encodeURIComponent(partes.join(", "));
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${q}`, {
        headers: { Accept: "application/json" },
      });
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        setLat(String(data[0].lat));
        setLng(String(data[0].lon));
        setSucesso(null);
      } else {
        setErro("Coordenada não encontrada — informe lat/lng manualmente.");
      }
    } catch {
      setErro("Falha ao consultar o serviço de mapa — informe lat/lng manualmente.");
    }
    setBuscando(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setSucesso(null);

    if (!nomeBairro.trim() && !cidade.trim()) {
      setErro("Informe ao menos o bairro ou a cidade.");
      return;
    }

    setCarregando(true);
    const temCoordenada = lat.trim() !== "" && lng.trim() !== "";
    const { error } = await supabase.from("territorios").insert({
      campanha_id: campanhaId,
      nome_bairro: nomeBairro.trim() || null,
      cidade: cidade.trim() || null,
      zona_eleitoral: zonaEleitoral || null,
      centro: temCoordenada ? `POINT(${Number(lng)} ${Number(lat)})` : null,
    });

    setCarregando(false);
    if (error) {
      setErro(error.message);
      return;
    }
    const nomeExibido = [nomeBairro.trim(), cidade.trim()].filter(Boolean).join(" · ");
    setSucesso(`Território "${nomeExibido}" adicionado${temCoordenada ? " com coordenada" : ""}.`);
    setNomeBairro("");
    setCidade("");
    setZonaEleitoral("");
    setLat("");
    setLng("");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2">
      <div className="space-y-1">
        <label className="block text-xs font-medium text-neutral-500">Bairro (opcional)</label>
        <input
          value={nomeBairro}
          onChange={(e) => setNomeBairro(e.target.value)}
          className="rounded border border-neutral-300 px-2 py-1.5 text-sm"
        />
      </div>
      <div className="space-y-1">
        <label className="block text-xs font-medium text-neutral-500">
          Cidade {!nomeBairro.trim() && "(obrigatório sem bairro)"}
        </label>
        <input
          value={cidade}
          onChange={(e) => setCidade(e.target.value)}
          className="rounded border border-neutral-300 px-2 py-1.5 text-sm"
        />
      </div>
      <div className="space-y-1">
        <label className="block text-xs font-medium text-neutral-500">Zona eleitoral</label>
        <input
          value={zonaEleitoral}
          onChange={(e) => setZonaEleitoral(e.target.value)}
          className="w-24 rounded border border-neutral-300 px-2 py-1.5 text-sm"
        />
      </div>
      <button
        type="button"
        onClick={buscarCoordenada}
        disabled={buscando}
        className="flex items-center gap-1 rounded border border-neutral-300 px-3 py-1.5 text-sm font-medium hover:bg-neutral-50 disabled:opacity-50"
      >
        <MapPin size={14} strokeWidth={2} aria-hidden="true" />
        {buscando ? "Buscando…" : "Buscar coordenada"}
      </button>
      <div className="space-y-1">
        <label className="block text-xs font-medium text-neutral-500">Lat</label>
        <input
          value={lat}
          onChange={(e) => setLat(e.target.value)}
          className="w-28 rounded border border-neutral-300 px-2 py-1.5 text-sm"
        />
      </div>
      <div className="space-y-1">
        <label className="block text-xs font-medium text-neutral-500">Lng</label>
        <input
          value={lng}
          onChange={(e) => setLng(e.target.value)}
          className="w-28 rounded border border-neutral-300 px-2 py-1.5 text-sm"
        />
      </div>
      <button
        type="submit"
        disabled={carregando}
        className="rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
      >
        {carregando ? "Adicionando…" : "Adicionar território"}
      </button>
      {erro && <p className="w-full text-sm text-red-600">{erro}</p>}
      {sucesso && <p className="w-full text-sm text-green-700">{sucesso}</p>}
    </form>
  );
}
