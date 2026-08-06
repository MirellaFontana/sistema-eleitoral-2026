import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import { proximaRotaMfa } from "@/lib/mfa";
import { AlertaCard } from "./AlertaCard";

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

export default async function AlertasPage() {
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
  const podeEncaminhar = eu.papel === "advogado_responsavel";

  const { data: alertas } = await supabase
    .from("alertas")
    .select(
      "id, destinatario_papel, canal, status_envio, lido_em, encaminhado_por, encaminhado_em, encaminhado_nota, texto_ia, categoria, ciente_em, ciente_por, providencia_em, providencia_por, providencia_nota, created_at, monitoramento_itens(descricao, categoria, gravidade, url, captura_path), usuarios_internos!encaminhado_por(nome), monitoramento_snapshots(analise_ia, resultados_brutos)"
    )
    .order("created_at", { ascending: false });


  return (
    <AppShell campanhaNome={campanha?.nome_candidato ?? undefined} papel={PAPEL_LABEL[eu.papel]}>
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-8">
        <div>
          <h1 className="text-lg font-semibold">Alertas</h1>
          <p className="text-sm text-neutral-500">
            Toda ameaça grave registrada no monitoramento (categoria jurídica, deepfake ou gestão
            de crise, gravidade alta) gera um alerta aqui automaticamente.
          </p>
        </div>

        {(alertas ?? []).length === 0 && (
          <p className="text-sm text-neutral-400">Nenhum alerta gerado ainda.</p>
        )}

        <ul className="space-y-3">
          {(alertas ?? []).map((a) => {
            const item = Array.isArray(a.monitoramento_itens) ? a.monitoramento_itens[0] : a.monitoramento_itens;
            const encaminhador = Array.isArray(a.usuarios_internos) ? a.usuarios_internos[0] : a.usuarios_internos;
            const snap = Array.isArray(a.monitoramento_snapshots) ? a.monitoramento_snapshots[0] : a.monitoramento_snapshots;

            const fontes: { nome: string; url: string }[] = [];
            if (snap?.analise_ia && snap?.resultados_brutos && a.texto_ia) {
              const brutos = snap.resultados_brutos as { noticias?: { link: string; fonte: string }[]; redes?: { resultados?: { link: string; fonte: string }[] } }[];
              const flatLinks: { link: string; fonte: string }[] = [];
              for (const g of brutos) {
                for (const n of g.noticias ?? []) flatLinks.push(n);
                for (const r of g.redes?.resultados ?? []) flatLinks.push(r);
              }
              const analise = snap.analise_ia as { grupos?: { titulo_grupo: string; mencoes: { fonte: string; titulo_original: string }[] }[] };
              const textoLower = a.texto_ia.toLowerCase();
              for (const grupo of analise.grupos ?? []) {
                const palavras = grupo.titulo_grupo.toLowerCase().split(/\s+/).filter((p: string) => p.length > 4);
                if (palavras.some((p: string) => textoLower.includes(p))) {
                  for (const m of grupo.mencoes) {
                    const entry = flatLinks.find((f) => f.fonte === m.fonte);
                    if (entry && !fontes.some((f) => f.url === entry.link)) {
                      fontes.push({ nome: m.fonte, url: entry.link });
                    }
                  }
                }
              }
            }

            return (
              <AlertaCard
                key={a.id}
                alerta={{
                  id: a.id,
                  destinatarioPapel: a.destinatario_papel,
                  canal: a.canal,
                  statusEnvio: a.status_envio,
                  lidoEm: a.lido_em,
                  encaminhadoPor: a.encaminhado_por,
                  encaminhadoPorNome: encaminhador?.nome ?? null,
                  encaminhadoEm: a.encaminhado_em,
                  encaminhadoNota: a.encaminhado_nota,
                  createdAt: a.created_at,
                  itemDescricao: item?.descricao ?? "",
                  itemCategoria: a.categoria ?? item?.categoria ?? "",
                  itemGravidade: item?.gravidade ?? null,
                  itemUrl: item?.url ?? null,
                  textoIA: a.texto_ia ?? null,
                  fontes,
                  cienteEm: a.ciente_em ?? null,
                  cientePor: a.ciente_por ?? null,
                  providenciaEm: a.providencia_em ?? null,
                  providenciaPor: a.providencia_por ?? null,
                  providenciaNota: a.providencia_nota ?? null,
                }}
                podeEncaminhar={podeEncaminhar}
                currentUserId={user.id}
              />
            );
          })}
        </ul>
      </main>
    </AppShell>
  );
}
