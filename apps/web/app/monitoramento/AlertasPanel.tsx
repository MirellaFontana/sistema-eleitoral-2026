"use client";

import { useState } from "react";
import { AlertTriangle, ChevronRight, ExternalLink, Forward } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Alerta = {
  id: string;
  texto_ia: string | null;
  canal: string;
  status_envio: string;
  lido_em: string | null;
  created_at: string;
  monitoramento_itens: { url: string | null; descricao: string; categoria: string } | null;
  snapshot_analise: {
    grupos: {
      titulo_grupo: string;
      sentimento: string;
      mencoes: { fonte: string; titulo_original: string }[];
    }[];
  } | null;
  snapshot_brutos: { noticias?: { link: string; fonte: string }[]; redes?: { resultados?: { link: string; fonte: string }[] } }[] | null;
};

type MateriaLink = { fonte: string; titulo: string; url: string };

const DESTINATARIOS = [
  { papel: "candidato", label: "Candidato" },
  { papel: "coord_campanha", label: "Coord. de campanha" },
  { papel: "coord_marketing", label: "Coord. de marketing" },
  { papel: "redator_marketing", label: "Comunicação" },
  { papel: "advogado_responsavel", label: "Advogado responsável" },
];

function extrairMaterias(alerta: Alerta): MateriaLink[] {
  const materias: MateriaLink[] = [];

  if (alerta.monitoramento_itens?.url) {
    materias.push({
      fonte: alerta.monitoramento_itens.categoria,
      titulo: alerta.monitoramento_itens.descricao.substring(0, 80),
      url: alerta.monitoramento_itens.url,
    });
  }

  if (alerta.snapshot_analise && alerta.snapshot_brutos && alerta.texto_ia) {
    const textoLower = alerta.texto_ia.toLowerCase();
    const flatLinks: { link: string; fonte: string }[] = [];
    for (const g of alerta.snapshot_brutos) {
      for (const n of g.noticias ?? []) flatLinks.push(n);
      for (const r of g.redes?.resultados ?? []) flatLinks.push(r);
    }

    for (const grupo of alerta.snapshot_analise.grupos) {
      const tituloLower = grupo.titulo_grupo.toLowerCase();
      const palavras = tituloLower.split(/\s+/).filter((p) => p.length > 4);
      const match = palavras.some((p) => textoLower.includes(p));
      if (match) {
        for (const m of grupo.mencoes) {
          const linkEntry = flatLinks.find((f) => f.fonte === m.fonte);
          if (linkEntry) {
            materias.push({ fonte: m.fonte, titulo: m.titulo_original, url: linkEntry.link });
          }
        }
      }
    }
  }

  const seen = new Set<string>();
  return materias.filter((m) => {
    if (seen.has(m.url)) return false;
    seen.add(m.url);
    return true;
  });
}

function EncaminharMenu({ alertaId, campanhaId }: { alertaId: string; campanhaId: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [menuAberto, setMenuAberto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [enviados, setEnviados] = useState<string[]>([]);

  function toggle(papel: string) {
    const next = new Set(selecionados);
    if (next.has(papel)) next.delete(papel);
    else next.add(papel);
    setSelecionados(next);
  }

  async function enviar() {
    if (selecionados.size === 0) return;
    setEnviando(true);
    const { data: { user } } = await supabase.auth.getUser();
    const agora = new Date().toISOString();
    const labels: string[] = [];

    for (const papel of selecionados) {
      const label = DESTINATARIOS.find((d) => d.papel === papel)?.label ?? papel;
      labels.push(label);
      await supabase.from("alertas").insert({
        campanha_id: campanhaId,
        monitoramento_item_id: null,
        destinatario_papel: papel,
        canal: "app",
        texto_ia: null,
        encaminhado_por: user?.id,
        encaminhado_em: agora,
        encaminhado_nota: `Encaminhado do alerta ${alertaId}`,
      });
    }

    await supabase
      .from("alertas")
      .update({ encaminhado_por: user?.id, encaminhado_em: agora, encaminhado_nota: `Encaminhado para: ${labels.join(", ")}` })
      .eq("id", alertaId);

    setEnviando(false);
    setEnviados(labels);
    setMenuAberto(false);
    setSelecionados(new Set());
    router.refresh();
  }

  if (enviados.length > 0) {
    return (
      <span className="text-[11px] text-emerald-600 font-medium">
        Encaminhado → {enviados.join(", ")}
      </span>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setMenuAberto(!menuAberto)}
        disabled={enviando}
        className="flex items-center gap-1 text-[11px] font-medium text-neutral-400 hover:text-indigo-600 transition-colors"
      >
        <Forward size={12} />
        Encaminhar
      </button>
      {menuAberto && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setMenuAberto(false)} />
          <div className="absolute left-0 top-full z-20 mt-1 rounded-lg border border-neutral-200 bg-white py-1 shadow-lg min-w-48">
            {DESTINATARIOS.map((d) => (
              <label
                key={d.papel}
                className="flex items-center gap-2 px-3 py-1.5 text-xs text-neutral-700 hover:bg-indigo-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selecionados.has(d.papel)}
                  onChange={() => toggle(d.papel)}
                  className="rounded border-neutral-300 text-indigo-600 focus:ring-indigo-500"
                />
                {d.label}
              </label>
            ))}
            <div className="border-t border-neutral-100 px-3 py-1.5">
              <button
                onClick={enviar}
                disabled={selecionados.size === 0 || enviando}
                className="w-full rounded bg-indigo-600 px-2 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-40"
              >
                {enviando ? "Enviando…" : `Enviar (${selecionados.size})`}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export function AlertasPanel({ alertas: alertasBrutos, campanhaId }: { alertas: Alerta[]; campanhaId: string }) {
  const [aberto, setAberto] = useState(false);

  const vistos = new Set<string>();
  const alertas = alertasBrutos.filter((a) => {
    const chave = a.texto_ia ?? a.monitoramento_itens?.descricao ?? a.id;
    if (vistos.has(chave)) return false;
    vistos.add(chave);
    return true;
  });

  const naoLidos = alertas.filter((a) => !a.lido_em).length;

  return (
    <div className="rounded border border-neutral-200">
      <button
        type="button"
        onClick={() => setAberto(!aberto)}
        className="flex w-full items-center gap-2 p-3 text-left hover:bg-neutral-50"
      >
        <ChevronRight
          size={14}
          className={`text-neutral-400 transition-transform ${aberto ? "rotate-90" : ""}`}
        />
        <AlertTriangle size={14} className="text-red-500" />
        <span className="text-sm font-semibold">Alertas</span>
        {naoLidos > 0 && (
          <span className="rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white leading-none">
            {naoLidos}
          </span>
        )}
        <span className="text-xs text-neutral-400">
          {alertas.length} último{alertas.length !== 1 ? "s" : ""}
        </span>
      </button>

      {aberto && (
        <div className="border-t border-neutral-100 divide-y divide-neutral-100">
          {alertas.length === 0 && (
            <p className="p-4 text-xs text-neutral-400">Nenhum alerta registrado.</p>
          )}
          {alertas.map((a) => {
            const materias = extrairMaterias(a);
            const texto = a.texto_ia ?? a.monitoramento_itens?.descricao ?? "Alerta sem descrição";
            return (
              <div key={a.id} className={`p-3 space-y-1.5 ${a.lido_em ? "opacity-60" : ""}`}>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm leading-relaxed">{texto}</p>
                  <span className="shrink-0 text-[10px] text-neutral-400">
                    {new Date(a.created_at).toLocaleDateString("pt-BR")}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  {materias.map((m, i) => (
                    <a
                      key={i}
                      href={m.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-[11px] font-medium text-indigo-600 hover:text-indigo-800"
                      title={m.titulo}
                    >
                      <ExternalLink size={10} />
                      {m.fonte}
                    </a>
                  ))}
                  <EncaminharMenu alertaId={a.id} campanhaId={campanhaId} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
