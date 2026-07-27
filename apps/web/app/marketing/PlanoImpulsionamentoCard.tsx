"use client";

type Publico = { nome: string; descricao: string; tamanho_estimado?: string };
type Criativo = {
  variacao: string;
  hook: string;
  corpo: string;
  cta: string;
  orientacao_arte?: string;
};

export type PlanoImpulsionamento = {
  objetivo_meta?: string;
  estrategia_geral?: string;
  estrutura_campanha?: { tipo?: string; numero_ad_sets?: number; descricao?: string };
  publicos?: Publico[];
  criativos?: Criativo[];
  orcamento?: {
    total_reais?: number;
    diario_recomendado_reais?: number;
    distribuicao?: string;
    reserva_escala?: string;
  };
  cronograma?: { fase_teste_dias?: number; fase_escala_dias?: number; checkpoint_dias?: number[] };
  metricas_alvo?: Record<string, string | number>;
  regras_otimizacao?: { kill?: string[]; scale?: string[] };
  compliance_eleitoral?: string[];
  avisos?: string[];
};

export type PlanoRow = {
  id: string;
  peca_descricao: string;
  objetivo: string;
  publico_prioritario: string;
  orcamento_total: number;
  prazo_dias: number;
  plano_json: PlanoImpulsionamento;
  created_at: string;
};

const OBJETIVO_LABEL: Record<string, string> = {
  alcance: "Alcance",
  trafego: "Tráfego",
  engajamento: "Engajamento",
  video_views: "Vídeo",
  conversao: "Conversão",
  mensagens: "Mensagens",
  seguidores: "Seguidores",
};

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
        {titulo}
      </p>
      {children}
    </div>
  );
}

export function PlanoImpulsionamentoCard({ plano: row }: { plano: PlanoRow }) {
  const p = row.plano_json;

  return (
    <li className="space-y-3 rounded border border-neutral-200 p-3 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-indigo-100 px-2 py-0.5 font-medium text-indigo-800">
          {OBJETIVO_LABEL[row.objetivo] ?? row.objetivo}
        </span>
        <span className="rounded-full bg-neutral-100 px-2 py-0.5 font-medium">
          R$ {row.orcamento_total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
        </span>
        <span className="rounded-full bg-neutral-100 px-2 py-0.5 font-medium">
          {row.prazo_dias} dias
        </span>
        <span className="ml-auto text-[10px] text-neutral-400">
          {new Date(row.created_at).toLocaleString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>

      <p className="line-clamp-2 rounded bg-neutral-50 px-2 py-1 text-neutral-600">
        <span className="font-medium">Peça:</span> {row.peca_descricao}
      </p>

      {p.estrategia_geral && (
        <Bloco titulo="Estratégia">
          <p className="text-neutral-700">{p.estrategia_geral}</p>
        </Bloco>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {p.estrutura_campanha && (
          <Bloco titulo="Estrutura">
            <p className="text-neutral-700">
              <strong>{p.estrutura_campanha.tipo ?? "—"}</strong>
              {p.estrutura_campanha.numero_ad_sets
                ? ` · ${p.estrutura_campanha.numero_ad_sets} ad sets`
                : ""}
            </p>
            {p.estrutura_campanha.descricao && (
              <p className="text-neutral-500">{p.estrutura_campanha.descricao}</p>
            )}
          </Bloco>
        )}

        {p.orcamento && (
          <Bloco titulo="Orçamento">
            <p className="text-neutral-700">
              Diário: R$ {(p.orcamento.diario_recomendado_reais ?? 0).toLocaleString("pt-BR")}
            </p>
            {p.orcamento.distribuicao && (
              <p className="text-neutral-500">{p.orcamento.distribuicao}</p>
            )}
            {p.orcamento.reserva_escala && (
              <p className="text-neutral-500">
                <em>Reserva escala:</em> {p.orcamento.reserva_escala}
              </p>
            )}
          </Bloco>
        )}
      </div>

      {p.publicos && p.publicos.length > 0 && (
        <Bloco titulo={`Públicos (${p.publicos.length})`}>
          <ul className="space-y-1.5">
            {p.publicos.map((pub, i) => (
              <li key={i} className="rounded bg-neutral-50 px-2 py-1.5">
                <p className="font-medium text-neutral-700">
                  {pub.nome}
                  {pub.tamanho_estimado ? (
                    <span className="ml-2 text-[10px] text-neutral-500">
                      · {pub.tamanho_estimado}
                    </span>
                  ) : null}
                </p>
                <p className="text-neutral-600">{pub.descricao}</p>
              </li>
            ))}
          </ul>
        </Bloco>
      )}

      {p.criativos && p.criativos.length > 0 && (
        <Bloco titulo={`Criativos (${p.criativos.length})`}>
          <ul className="space-y-1.5">
            {p.criativos.map((c, i) => (
              <li key={i} className="rounded bg-neutral-50 px-2 py-1.5">
                <p className="font-medium text-neutral-700">{c.variacao}</p>
                <p className="text-neutral-600">
                  <strong>Hook:</strong> {c.hook}
                </p>
                <p className="text-neutral-600">
                  <strong>Corpo:</strong> {c.corpo}
                </p>
                <p className="text-neutral-600">
                  <strong>CTA:</strong> {c.cta}
                </p>
                {c.orientacao_arte && (
                  <p className="text-neutral-500">
                    <em>Arte:</em> {c.orientacao_arte}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </Bloco>
      )}

      {p.metricas_alvo && Object.keys(p.metricas_alvo).length > 0 && (
        <Bloco titulo="Métricas-alvo">
          <ul className="flex flex-wrap gap-1.5">
            {Object.entries(p.metricas_alvo).map(([k, v]) => (
              <li
                key={k}
                className="rounded bg-neutral-100 px-2 py-0.5 text-[10px] text-neutral-700"
              >
                <strong>{k.replace(/_/g, " ")}:</strong> {String(v)}
              </li>
            ))}
          </ul>
        </Bloco>
      )}

      {p.regras_otimizacao && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {p.regras_otimizacao.kill && p.regras_otimizacao.kill.length > 0 && (
            <Bloco titulo="Kill rules">
              <ul className="list-inside list-disc space-y-0.5 text-neutral-600">
                {p.regras_otimizacao.kill.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </Bloco>
          )}
          {p.regras_otimizacao.scale && p.regras_otimizacao.scale.length > 0 && (
            <Bloco titulo="Scale rules">
              <ul className="list-inside list-disc space-y-0.5 text-neutral-600">
                {p.regras_otimizacao.scale.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </Bloco>
          )}
        </div>
      )}

      {p.compliance_eleitoral && p.compliance_eleitoral.length > 0 && (
        <Bloco titulo="Compliance eleitoral">
          <ul className="list-inside list-disc space-y-0.5 rounded bg-amber-50 p-2 text-neutral-700">
            {p.compliance_eleitoral.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </Bloco>
      )}

      {p.avisos && p.avisos.length > 0 && (
        <Bloco titulo="Avisos">
          <ul className="list-inside list-disc space-y-0.5 text-neutral-600">
            {p.avisos.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </Bloco>
      )}
    </li>
  );
}
