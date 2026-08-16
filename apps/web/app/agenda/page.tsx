import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import { proximaRotaMfa } from "@/lib/mfa";
import { BotaoImprimir } from "@/components/BotaoImprimir";
import { hojeBR } from "@/lib/fuso";
import { EventoForm } from "./EventoForm";
import { EventoCard, type EventoView, type Participante } from "./EventoCard";

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

const STATUS_FILTRO = [
  { value: "", label: "todos os status" },
  { value: "planejado", label: "Planejado" },
  { value: "confirmado", label: "Confirmado" },
  { value: "realizado", label: "Realizado" },
  { value: "cancelado", label: "Cancelado" },
];

type LinhaEvento = {
  id: string;
  titulo: string;
  tipo: string;
  status: string;
  data_inicio: string;
  data_fim: string | null;
  territorio_id: string | null;
  local_texto: string | null;
  descricao: string | null;
  publico_estimado: number | null;
  territorios: { nome_bairro: string | null } | { nome_bairro: string | null }[] | null;
  eventos_liderancas: {
    lideranca_id: string;
    compareceu: boolean | null;
    liderancas: { nome: string } | { nome: string }[] | null;
  }[];
};

function paraView(e: LinhaEvento): EventoView {
  const territorio = Array.isArray(e.territorios) ? e.territorios[0] : e.territorios;
  const participantes: Participante[] = (e.eventos_liderancas ?? []).map((el) => {
    const lideranca = Array.isArray(el.liderancas) ? el.liderancas[0] : el.liderancas;
    return {
      liderancaId: el.lideranca_id,
      nome: lideranca?.nome ?? "liderança removida",
      compareceu: el.compareceu,
    };
  });
  return {
    id: e.id,
    titulo: e.titulo,
    tipo: e.tipo,
    status: e.status,
    dataInicio: e.data_inicio,
    dataFim: e.data_fim,
    territorioId: e.territorio_id,
    territorioNome: territorio?.nome_bairro ?? null,
    localTexto: e.local_texto,
    descricao: e.descricao,
    publicoEstimado: e.publico_estimado,
    participantes,
  };
}

function labelDia(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    timeZone: "America/Sao_Paulo",
  });
}

function chaveDia(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function agruparPorDia(eventos: EventoView[]): { chave: string; label: string; itens: EventoView[] }[] {
  const grupos: { chave: string; label: string; itens: EventoView[] }[] = [];
  for (const e of eventos) {
    const chave = chaveDia(e.dataInicio);
    let grupo = grupos.find((g) => g.chave === chave);
    if (!grupo) {
      grupo = { chave, label: labelDia(e.dataInicio), itens: [] };
      grupos.push(grupo);
    }
    grupo.itens.push(e);
  }
  return grupos;
}

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; territorio?: string }>;
}) {
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
  const podeEditar = eu.papel === "coord_campanha";

  const { status: filtroStatus, territorio: filtroTerritorio } = await searchParams;

  let query = supabase
    .from("eventos_campanha")
    .select(
      "id, titulo, tipo, status, data_inicio, data_fim, territorio_id, local_texto, descricao, publico_estimado, territorios(nome_bairro), eventos_liderancas(lideranca_id, compareceu, liderancas(nome))"
    )
    .order("data_inicio");
  if (filtroStatus) query = query.eq("status", filtroStatus);
  if (filtroTerritorio) query = query.eq("territorio_id", filtroTerritorio);

  const [eventosRes, territoriosRes, liderancasRes] = await Promise.all([
    query,
    supabase.from("territorios").select("id, nome_bairro").order("nome_bairro"),
    supabase.from("liderancas").select("id, nome").eq("status", "ativa").order("nome"),
  ]);

  const territorios = territoriosRes.data ?? [];
  const liderancas = liderancasRes.data ?? [];
  const eventos = ((eventosRes.data ?? []) as unknown as LinhaEvento[]).map(paraView);

  const inicioHoje = new Date(`${hojeBR()}T00:00:00-03:00`);
  const proximos = eventos.filter((e) => new Date(e.dataInicio) >= inicioHoje);
  const anteriores = eventos
    .filter((e) => new Date(e.dataInicio) < inicioHoje)
    .sort((a, b) => b.dataInicio.localeCompare(a.dataInicio))
    .slice(0, 20);

  const gruposProximos = agruparPorDia(proximos);
  const gruposAnteriores = agruparPorDia(anteriores);

  return (
    <AppShell campanhaNome={campanha?.nome_candidato ?? undefined} papel={PAPEL_LABEL[eu.papel]}>
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-8 px-4 py-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold">Agenda de campanha</h1>
            <p className="text-sm text-neutral-500">
              Caminhadas, reuniões, comícios e demais atos — com território, lideranças envolvidas
              e presença registrada depois do evento.
            </p>
          </div>
          <BotaoImprimir />
        </div>

        {podeEditar && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
              Novo evento
            </h2>
            <EventoForm
              campanhaId={eu.campanha_id}
              territorios={territorios}
              liderancas={liderancas}
            />
          </section>
        )}

        <form method="get" className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <label htmlFor="status" className="block text-xs font-medium text-neutral-500">
              Status
            </label>
            <select
              id="status"
              name="status"
              defaultValue={filtroStatus ?? ""}
              className="rounded border border-neutral-300 px-2 py-1.5 text-sm"
            >
              {STATUS_FILTRO.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label htmlFor="territorio" className="block text-xs font-medium text-neutral-500">
              Território
            </label>
            <select
              id="territorio"
              name="territorio"
              defaultValue={filtroTerritorio ?? ""}
              className="rounded border border-neutral-300 px-2 py-1.5 text-sm"
            >
              <option value="">todos</option>
              {territorios.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome_bairro ?? "sem nome"}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-50"
          >
            Filtrar
          </button>
        </form>

        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Próximos eventos
          </h2>
          {gruposProximos.length === 0 && (
            <p className="text-sm text-neutral-400">Nenhum evento futuro na agenda.</p>
          )}
          {gruposProximos.map((grupo) => (
            <div key={grupo.chave} className="space-y-2">
              <p className="text-xs font-medium capitalize text-neutral-500">{grupo.label}</p>
              {grupo.itens.map((e) => (
                <EventoCard
                  key={e.id}
                  evento={e}
                  campanhaId={eu.campanha_id}
                  territorios={territorios}
                  liderancas={liderancas}
                  podeEditar={podeEditar}
                />
              ))}
            </div>
          ))}
        </section>

        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Anteriores
          </h2>
          {gruposAnteriores.length === 0 && (
            <p className="text-sm text-neutral-400">Nenhum evento passado.</p>
          )}
          {gruposAnteriores.map((grupo) => (
            <div key={grupo.chave} className="space-y-2">
              <p className="text-xs font-medium capitalize text-neutral-500">{grupo.label}</p>
              {grupo.itens.map((e) => (
                <EventoCard
                  key={e.id}
                  evento={e}
                  campanhaId={eu.campanha_id}
                  territorios={territorios}
                  liderancas={liderancas}
                  podeEditar={podeEditar}
                />
              ))}
            </div>
          ))}
        </section>
      </main>
    </AppShell>
  );
}
