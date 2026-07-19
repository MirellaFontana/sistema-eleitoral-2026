import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import { proximaRotaMfa } from "@/lib/mfa";
import { VerCapturaButton } from "../monitoramento/VerCapturaButton";

const PAPEL_LABEL: Record<string, string> = {
  embaixador: "Embaixador",
  advogado_responsavel: "Advogado responsável",
  assistente_juridico: "Assistente jurídico",
  coord_marketing: "Coord. de marketing",
  redator_marketing: "Redator de marketing",
  coord_campanha: "Coord. de campanha",
  candidato: "Candidato",
};

const CATEGORIA_LABEL: Record<string, string> = {
  ameaca_juridica: "Ameaça jurídica",
  deepfake_suspeito: "Deepfake suspeito",
  gestao_crise: "Gestão de crise",
};

const GRAVIDADE_LABEL: Record<string, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
};

export default async function DossieJuridicoPage() {
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

  // Mesma policy monitoramento_itens_select de sempre — esta página só filtra
  // o que já é legível por qualquer papel interno, não abre acesso novo.
  const { data: itens } = await supabase
    .from("monitoramento_itens")
    .select("id, url, descricao, categoria, gravidade, captura_path, hash_evidencia, hash_calculado_em, created_at")
    .not("hash_evidencia", "is", null)
    .order("created_at", { ascending: false });

  return (
    <AppShell campanhaNome={campanha?.nome_candidato ?? undefined} papel={PAPEL_LABEL[eu.papel]}>
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-8 px-4 py-8">
        <div>
          <h1 className="text-lg font-semibold">Dossiê jurídico</h1>
          <p className="text-sm text-neutral-500">
            Escudo antideepfake — evidências lacradas (hash + carimbo de data/hora calculados no
            momento do registro). Prova de cadeia de custódia interna, não substitui notarização
            externa caso seja exigida em processo judicial formal.
          </p>
        </div>

        <section className="space-y-2">
          {(itens ?? []).length === 0 && (
            <p className="text-sm text-neutral-400">Nenhuma evidência lacrada ainda.</p>
          )}

          <ul className="space-y-2">
            {(itens ?? []).map((item) => (
              <li key={item.id} className="rounded border border-neutral-200 p-3 space-y-1">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-full bg-neutral-100 px-2 py-0.5 font-medium">
                    {CATEGORIA_LABEL[item.categoria] ?? item.categoria}
                  </span>
                  {item.gravidade && (
                    <span className="rounded-full bg-neutral-100 px-2 py-0.5">
                      Gravidade: {GRAVIDADE_LABEL[item.gravidade] ?? item.gravidade}
                    </span>
                  )}
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-800">
                    🔒 Lacrado em{" "}
                    {item.hash_calculado_em &&
                      new Date(item.hash_calculado_em).toLocaleString("pt-BR", { timeZone: "UTC" })}
                  </span>
                </div>
                <p className="text-sm">{item.descricao}</p>
                <p className="break-all font-mono text-xs text-neutral-400">
                  SHA-256: {item.hash_evidencia}
                </p>
                <div className="flex gap-3">
                  {item.url && (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-neutral-900 underline underline-offset-2"
                    >
                      Abrir link
                    </a>
                  )}
                  {item.captura_path && <VerCapturaButton path={item.captura_path} />}
                </div>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </AppShell>
  );
}
