"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export type AvisoView = {
  id: string;
  categoria: string;
  titulo: string;
  mensagem: string;
  destinatarioPapel: string | null;
  criadoPorNome: string | null;
  createdAt: string;
  lido: boolean;
};

const CATEGORIA_LABEL: Record<string, string> = {
  mudanca_agenda: "Mudança de agenda",
  nova_tarefa: "Nova tarefa",
  peca_aguardando_aprovacao: "Peça aguardando aprovação",
  prazo_eleitoral_proximo: "Prazo eleitoral próximo",
  crise_identificada: "Crise identificada",
  evento_alterado: "Evento alterado",
  orientacao_juridica: "Orientação jurídica",
  material_disponivel: "Material disponível",
  reuniao_convocada: "Reunião convocada",
  ocorrencia_territorio: "Ocorrência em território",
  acesso_revogado: "Acesso revogado",
  incidente_seguranca: "Incidente de segurança",
};

const PAPEL_LABEL: Record<string, string> = {
  coord_campanha: "Coord. de campanha",
  candidato: "Candidato",
  advogado_responsavel: "Advogado responsável",
  assistente_juridico: "Assistente jurídico",
  coord_marketing: "Coord. de marketing",
  redator_marketing: "Redator de marketing",
  embaixador: "Embaixador",
  apoio_marketing: "Apoio de marketing",
  apoio_campanha: "Apoio de campanha",
  apoio_coordenacao: "Apoio de coordenação",
};

export function AvisoCard({ aviso, currentUserId }: { aviso: AvisoView; currentUserId: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [lido, setLido] = useState(aviso.lido);
  const [carregando, setCarregando] = useState(false);

  async function marcarLido() {
    setCarregando(true);
    const { error } = await supabase
      .from("avisos_internos_lidos")
      .insert({ aviso_id: aviso.id, usuario_id: currentUserId });
    setCarregando(false);
    if (!error) {
      setLido(true);
      router.refresh();
    }
  }

  return (
    <li
      className={`space-y-1.5 rounded border p-3 ${
        lido ? "border-neutral-200" : "border-indigo-200 bg-indigo-50/40"
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600">
          {CATEGORIA_LABEL[aviso.categoria] ?? aviso.categoria}
        </span>
        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-500">
          {aviso.destinatarioPapel ? PAPEL_LABEL[aviso.destinatarioPapel] ?? aviso.destinatarioPapel : "Todos"}
        </span>
        {!lido && (
          <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-700">
            novo
          </span>
        )}
        <span className="ml-auto text-xs text-neutral-400">
          {new Date(aviso.createdAt).toLocaleString("pt-BR")}
        </span>
      </div>
      <p className="text-sm font-medium">{aviso.titulo}</p>
      <p className="text-sm text-neutral-700">{aviso.mensagem}</p>
      <div className="flex items-center justify-between">
        <p className="text-xs text-neutral-400">{aviso.criadoPorNome ?? "Sistema"}</p>
        {!lido && (
          <button
            onClick={marcarLido}
            disabled={carregando}
            className="flex items-center gap-1 rounded border border-neutral-300 px-2 py-1 text-xs text-neutral-600 hover:bg-neutral-50 disabled:opacity-50"
          >
            <Check size={12} strokeWidth={2} aria-hidden="true" />
            Marcar como lido
          </button>
        )}
      </div>
    </li>
  );
}
