"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Trash2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const TIPOS = [
  { value: "foto_oficial", label: "Foto oficial" },
  { value: "foto_campanha", label: "Foto de campanha" },
  { value: "foto_corpo_inteiro", label: "Foto corpo inteiro" },
  { value: "logo_campanha", label: "Logo da campanha" },
  { value: "logo_partido", label: "Logo do partido" },
  { value: "fundo_padrao", label: "Fundo padrão" },
] as const;

type Foto = {
  id: string;
  tipo: string;
  nome_original: string;
  path: string;
  largura: number | null;
  altura: number | null;
};

export function FotosCampanha({
  campanhaId,
  fotos: fotosIniciais,
  podeEditar,
}: {
  campanhaId: string;
  fotos: Foto[];
  podeEditar: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [fotos, setFotos] = useState(fotosIniciais);
  const [carregando, setCarregando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState<string | null>(null);
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});

  const tiposUsados = new Set(fotos.map((f) => f.tipo));

  async function carregarPreview(foto: Foto) {
    if (previewUrls[foto.id]) return;
    const { data } = await supabase.storage
      .from("fotos-campanha")
      .createSignedUrl(foto.path, 300);
    if (data?.signedUrl) {
      setPreviewUrls((prev) => ({ ...prev, [foto.id]: data.signedUrl }));
    }
  }

  async function handleUpload(tipo: string, file: File) {
    setErro(null);
    setCarregando(tipo);

    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${campanhaId}/${tipo}.${ext}`;

    const { error: storageErr } = await supabase.storage
      .from("fotos-campanha")
      .upload(path, file, { upsert: true });

    if (storageErr) {
      setErro(storageErr.message);
      setCarregando(null);
      return;
    }

    let largura: number | null = null;
    let altura: number | null = null;
    if (file.type.startsWith("image/")) {
      try {
        const bmp = await createImageBitmap(file);
        largura = bmp.width;
        altura = bmp.height;
        bmp.close();
      } catch {}
    }

    const fotoExistente = fotos.find((f) => f.tipo === tipo);
    if (fotoExistente) {
      const { error } = await supabase
        .from("fotos_campanha")
        .update({ path, nome_original: file.name, largura, altura })
        .eq("id", fotoExistente.id);
      if (error) {
        setErro(error.message);
        setCarregando(null);
        return;
      }
    } else {
      const { error } = await supabase.from("fotos_campanha").insert({
        campanha_id: campanhaId,
        tipo,
        path,
        nome_original: file.name,
        largura,
        altura,
      });
      if (error) {
        setErro(error.message);
        setCarregando(null);
        return;
      }
    }

    setCarregando(null);
    setPreviewUrls((prev) => {
      const next = { ...prev };
      if (fotoExistente) delete next[fotoExistente.id];
      return next;
    });
    router.refresh();
  }

  async function handleExcluir(foto: Foto) {
    setErro(null);
    setCarregando(foto.tipo);
    await supabase.storage.from("fotos-campanha").remove([foto.path]);
    await supabase.from("fotos_campanha").delete().eq("id", foto.id);
    setConfirmandoExclusao(null);
    setCarregando(null);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {erro && <p className="text-sm text-red-600">{erro}</p>}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {TIPOS.map(({ value, label }) => {
          const foto = fotos.find((f) => f.tipo === value);

          if (foto) {
            if (!previewUrls[foto.id]) carregarPreview(foto);
          }

          return (
            <div
              key={value}
              className="relative flex flex-col items-center gap-2 rounded border border-neutral-200 p-3"
            >
              <p className="text-xs font-medium text-neutral-500">{label}</p>

              {foto ? (
                <>
                  {previewUrls[foto.id] ? (
                    <img
                      src={previewUrls[foto.id]}
                      alt={label}
                      className="h-24 w-24 rounded object-cover"
                    />
                  ) : (
                    <div className="flex h-24 w-24 items-center justify-center rounded bg-neutral-100 text-xs text-neutral-400">
                      Carregando…
                    </div>
                  )}
                  <p className="max-w-full truncate text-[10px] text-neutral-400">
                    {foto.nome_original}
                    {foto.largura && foto.altura ? ` (${foto.largura}×${foto.altura})` : ""}
                  </p>

                  {podeEditar && (
                    <div className="flex gap-1">
                      <label className="cursor-pointer rounded border border-neutral-300 px-2 py-0.5 text-[10px] hover:bg-neutral-50">
                        Trocar
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handleUpload(value, f);
                          }}
                        />
                      </label>

                      {confirmandoExclusao === foto.id ? (
                        <span className="flex items-center gap-1">
                          <button
                            onClick={() => handleExcluir(foto)}
                            disabled={carregando === foto.tipo}
                            className="rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-medium text-white disabled:opacity-50"
                          >
                            {carregando === foto.tipo ? "…" : "Confirmar"}
                          </button>
                          <button
                            onClick={() => setConfirmandoExclusao(null)}
                            className="rounded px-1 py-0.5 text-neutral-500 hover:bg-neutral-100"
                          >
                            <X size={10} strokeWidth={2} />
                          </button>
                        </span>
                      ) : (
                        <button
                          onClick={() => setConfirmandoExclusao(foto.id)}
                          className="flex items-center gap-0.5 rounded border border-red-200 px-1.5 py-0.5 text-[10px] text-red-600 hover:bg-red-50"
                        >
                          <Trash2 size={10} strokeWidth={2} />
                        </button>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="flex h-24 w-24 items-center justify-center rounded bg-neutral-50 text-neutral-300">
                    <Camera size={24} strokeWidth={1.5} />
                  </div>
                  {podeEditar && (
                    <label className="cursor-pointer rounded bg-indigo-600 px-2.5 py-1 text-[10px] font-medium text-white hover:bg-indigo-700">
                      Enviar
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={carregando === value}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleUpload(value, f);
                        }}
                      />
                    </label>
                  )}
                </>
              )}

              {carregando === value && (
                <p className="text-[10px] text-indigo-600">Enviando…</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
