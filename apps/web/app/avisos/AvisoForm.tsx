"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const CATEGORIAS = [
  { value: "mudanca_agenda", label: "Mudança de agenda" },
  { value: "nova_tarefa", label: "Nova tarefa" },
  { value: "peca_aguardando_aprovacao", label: "Peça aguardando aprovação" },
  { value: "prazo_eleitoral_proximo", label: "Prazo eleitoral próximo" },
  { value: "crise_identificada", label: "Crise identificada" },
  { value: "evento_alterado", label: "Evento alterado" },
  { value: "orientacao_juridica", label: "Orientação jurídica" },
  { value: "material_disponivel", label: "Material disponível" },
  { value: "reuniao_convocada", label: "Reunião convocada" },
  { value: "ocorrencia_territorio", label: "Ocorrência em território" },
  { value: "acesso_revogado", label: "Acesso revogado" },
  { value: "incidente_seguranca", label: "Incidente de segurança" },
];

const DESTINATARIOS = [
  { value: "", label: "Todos os papéis internos" },
  { value: "coord_campanha", label: "Coord. de campanha" },
  { value: "candidato", label: "Candidato" },
  { value: "advogado_responsavel", label: "Advogado responsável" },
  { value: "assistente_juridico", label: "Assistente jurídico" },
  { value: "coord_marketing", label: "Coord. de marketing" },
  { value: "redator_marketing", label: "Redator de marketing" },
  { value: "apoio_marketing", label: "Apoio de marketing" },
  { value: "apoio_campanha", label: "Apoio de campanha" },
  { value: "apoio_coordenacao", label: "Apoio de coordenação" },
];

export function AvisoForm({ campanhaId }: { campanhaId: string }) {
  const router = useRouter();
  const supabase = createClient();

  const [categoria, setCategoria] = useState(CATEGORIAS[0].value);
  const [destinatario, setDestinatario] = useState("");
  const [titulo, setTitulo] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);

    const { error } = await supabase.from("avisos_internos").insert({
      campanha_id: campanhaId,
      categoria,
      titulo: titulo.trim(),
      mensagem: mensagem.trim(),
      destinatario_papel: destinatario || null,
    });

    setCarregando(false);
    if (error) {
      setErro(error.message);
      return;
    }
    setTitulo("");
    setMensagem("");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded border border-neutral-200 p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="block text-xs font-medium text-neutral-500">Categoria</label>
          <select
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
          >
            {CATEGORIAS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="block text-xs font-medium text-neutral-500">Destinatário</label>
          <select
            value={destinatario}
            onChange={(e) => setDestinatario(e.target.value)}
            className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
          >
            {DESTINATARIOS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-1">
        <label className="block text-xs font-medium text-neutral-500">Título</label>
        <input
          required
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
        />
      </div>

      <div className="space-y-1">
        <label className="block text-xs font-medium text-neutral-500">Mensagem</label>
        <textarea
          required
          rows={3}
          value={mensagem}
          onChange={(e) => setMensagem(e.target.value)}
          className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
        />
      </div>

      {erro && <p className="text-sm text-red-600">{erro}</p>}

      <button
        type="submit"
        disabled={carregando}
        className="rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
      >
        {carregando ? "Publicando…" : "Publicar aviso"}
      </button>
    </form>
  );
}

export { CATEGORIAS };
