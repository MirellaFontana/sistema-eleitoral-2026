import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import { proximaRotaMfa } from "@/lib/mfa";

const PAPEL_LABEL: Record<string, string> = {
  embaixador: "Embaixador",
  advogado_responsavel: "Advogado responsável",
  assistente_juridico: "Assistente jurídico",
  coord_marketing: "Coord. de marketing",
  redator_marketing: "Redator de marketing",
  coord_campanha: "Coord. de campanha",
  candidato: "Candidato",
  apoio_marketing: "Apoio de marketing",
  apoio_campanha: "Apoio de campanha",
  apoio_coordenacao: "Apoio de coordenação",
};

const CATEGORIA_LABEL: Record<string, string> = {
  convencoes: "Convenções",
  registro: "Registro",
  propaganda: "Propaganda",
  financeiro: "Financeiro",
  votacao: "Votação",
  outro: "Outro",
};

const MES_LABEL = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

type Prazo = {
  id: string;
  data: string;
  titulo: string;
  descricao: string | null;
  categoria: string;
  fonte: string;
};

// Dias entre hoje e a data do prazo, em dias de calendário (não horas corridas).
function diasAte(dataIso: string, hoje: Date): number {
  const [ano, mes, dia] = dataIso.split("-").map(Number);
  const alvo = new Date(ano, mes - 1, dia);
  const base = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  return Math.round((alvo.getTime() - base.getTime()) / 86_400_000);
}

function BadgeEstado({ dias }: { dias: number }) {
  if (dias < 0) {
    return (
      <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-500">
        passou
      </span>
    );
  }
  if (dias === 0) {
    return (
      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
        é hoje
      </span>
    );
  }
  if (dias <= 7) {
    return (
      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
        faltam {dias} {dias === 1 ? "dia" : "dias"}
      </span>
    );
  }
  return (
    <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
      faltam {dias} dias
    </span>
  );
}

export default async function CalendarioEleitoralPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: eu } = await supabase
    .from("usuarios_internos")
    .select("papel, campanha_id, campanhas(nome_candidato)")
    .eq("id", user.id)
    .maybeSingle();

  if (!eu) redirect("/onboarding");

  const rotaMfa = await proximaRotaMfa(supabase, eu.papel);
  if (rotaMfa) redirect(rotaMfa);

  const campanha = Array.isArray(eu.campanhas) ? eu.campanhas[0] : eu.campanhas;

  const { data: prazos } = await supabase
    .from("prazos_eleitorais")
    .select("id, data, titulo, descricao, categoria, fonte")
    .order("data");

  const hoje = new Date();

  // Agrupa por mês/ano preservando a ordem cronológica.
  const grupos: { chave: string; label: string; itens: Prazo[] }[] = [];
  for (const p of prazos ?? []) {
    const [ano, mes] = p.data.split("-").map(Number);
    const chave = `${ano}-${mes}`;
    let grupo = grupos.find((g) => g.chave === chave);
    if (!grupo) {
      grupo = { chave, label: `${MES_LABEL[mes - 1]} de ${ano}`, itens: [] };
      grupos.push(grupo);
    }
    grupo.itens.push(p);
  }

  return (
    <AppShell campanhaNome={campanha?.nome_candidato ?? undefined} papel={PAPEL_LABEL[eu.papel]}>
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-8 px-4 py-8">
        <div>
          <h1 className="text-lg font-semibold">Calendário eleitoral 2026</h1>
          <p className="text-sm text-neutral-500">
            Prazos oficiais do ciclo eleitoral. Datas marcadas com "conferir" vêm da resolução
            anual do TSE e devem ser confirmadas na publicação oficial — o calendário aqui é
            apoio operacional, não substitui a orientação do jurídico da campanha.
          </p>
        </div>

        {grupos.length === 0 && (
          <p className="text-sm text-neutral-400">Nenhum prazo cadastrado.</p>
        )}

        {grupos.map((grupo) => (
          <section key={grupo.chave} className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
              {grupo.label}
            </h2>
            <ul className="space-y-2">
              {grupo.itens.map((p) => {
                const dias = diasAte(p.data, hoje);
                const [, , diaNum] = p.data.split("-").map(Number);
                return (
                  <li
                    key={p.id}
                    className={`flex gap-3 rounded border p-3 ${
                      dias < 0 ? "border-neutral-200 opacity-60" : "border-neutral-200"
                    }`}
                  >
                    <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg bg-neutral-100 text-neutral-700">
                      <span className="text-sm font-semibold leading-none">{diaNum}</span>
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium">{p.titulo}</p>
                        <BadgeEstado dias={dias} />
                        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-500">
                          {CATEGORIA_LABEL[p.categoria] ?? p.categoria}
                        </span>
                      </div>
                      {p.descricao && <p className="text-sm text-neutral-600">{p.descricao}</p>}
                      <p className="text-xs text-neutral-400">{p.fonte}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </main>
    </AppShell>
  );
}
