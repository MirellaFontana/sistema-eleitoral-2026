import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import { proximaRotaMfa } from "@/lib/mfa";
import { MensagemForm } from "./MensagemForm";

const PAPEL_LABEL: Record<string, string> = {
  embaixador: "Liderança de campo (legado)",
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

const TIPO_LABEL: Record<string, string> = { cidadao: "Eleitor", apoiador: "Apoiador", lideranca: "Liderança" };
const STATUS_LABEL: Record<string, string> = {
  pendente_configuracao: "Pendente (WhatsApp não configurado)",
  enviada: "Enviada",
  falhou: "Falhou",
};

const PAPEIS_QUE_MANDAM = new Set(["coord_campanha", "coord_marketing"]);

export default async function MensagensPage() {
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

  const podeMandar = PAPEIS_QUE_MANDAM.has(eu.papel);
  const podeMandarParaCidadao = eu.papel === "coord_campanha";
  const campanha = Array.isArray(eu.campanhas) ? eu.campanhas[0] : eu.campanhas;

  const [{ data: mensagens }, apoiadoresRes, liderancasRes, cidadaosRes] = await Promise.all([
    supabase
      .from("mensagens")
      .select(
        "id, tipo_destinatario, canal, conteudo, status, erro_envio, created_at, cidadaos(nome), apoiadores(nome), liderancas(nome)"
      )
      .order("created_at", { ascending: false }),
    supabase.from("apoiadores").select("id, nome").eq("status", "ativo").order("nome"),
    supabase.from("liderancas").select("id, nome").eq("status", "ativa").order("nome"),
    podeMandarParaCidadao
      ? supabase.from("cidadaos").select("id, nome").order("nome")
      : Promise.resolve({ data: [] as { id: string; nome: string }[] }),
  ]);

  const linhas = (mensagens ?? []).map((m) => {
    const cidadao = Array.isArray(m.cidadaos) ? m.cidadaos[0] : m.cidadaos;
    const apoiador = Array.isArray(m.apoiadores) ? m.apoiadores[0] : m.apoiadores;
    const lideranca = Array.isArray(m.liderancas) ? m.liderancas[0] : m.liderancas;
    const destinatarioNome = cidadao?.nome ?? apoiador?.nome ?? lideranca?.nome ?? "—";
    return {
      id: m.id,
      tipo: m.tipo_destinatario,
      destinatarioNome,
      canal: m.canal,
      conteudo: m.conteudo,
      status: m.status,
      erroEnvio: m.erro_envio,
      createdAt: m.created_at,
    };
  });

  return (
    <AppShell campanhaNome={campanha?.nome_candidato ?? undefined} papel={PAPEL_LABEL[eu.papel]}>
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-8 px-4 py-8">
        <div>
          <h1 className="text-lg font-semibold">Mensagens</h1>
          <p className="text-sm text-neutral-500">
            Envio individual pra quem já está cadastrado — eleitor, apoiador ou liderança. Sempre
            um destinatário por vez, nunca em massa.
          </p>
        </div>

        {podeMandar && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
              Nova mensagem
            </h2>
            <MensagemForm
              podeMandarParaCidadao={podeMandarParaCidadao}
              cidadaos={cidadaosRes.data ?? []}
              apoiadores={apoiadoresRes.data ?? []}
              liderancas={liderancasRes.data ?? []}
            />
          </section>
        )}

        <section className="space-y-3">
          {linhas.length === 0 && <p className="text-sm text-neutral-400">Nenhuma mensagem registrada ainda.</p>}

          <ul className="space-y-2">
            {linhas.map((m) => (
              <li key={m.id} className="rounded border border-neutral-200 p-3 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-full bg-neutral-100 px-2 py-0.5 font-medium">
                    {TIPO_LABEL[m.tipo] ?? m.tipo}: {m.destinatarioNome}
                  </span>
                  <span className="rounded-full bg-neutral-100 px-2 py-0.5">{m.canal}</span>
                  <span
                    className={
                      m.status === "enviada"
                        ? "rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-800"
                        : m.status === "falhou"
                          ? "rounded-full bg-red-100 px-2 py-0.5 font-medium text-red-800"
                          : "rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-800"
                    }
                  >
                    {STATUS_LABEL[m.status] ?? m.status}
                  </span>
                  <span className="text-neutral-400">
                    {new Date(m.createdAt).toLocaleString("pt-BR", { timeZone: "UTC" })}
                  </span>
                </div>
                <p className="text-sm">{m.conteudo}</p>
                {m.erroEnvio && <p className="text-xs text-neutral-500">Detalhe: {m.erroEnvio}</p>}
              </li>
            ))}
          </ul>
        </section>
      </main>
    </AppShell>
  );
}
