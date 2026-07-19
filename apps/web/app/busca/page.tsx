import { redirect } from "next/navigation";
import Link from "next/link";
import { Users, Heart, Network, ArrowRight, type LucideIcon } from "lucide-react";
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
};

const CIRCULO_LABEL: Record<string, { label: string; dot: string }> = {
  quente: { label: "Quente", dot: "bg-rose-500" },
  morno: { label: "Morno", dot: "bg-amber-400" },
  frio: { label: "Frio", dot: "bg-sky-400" },
};

// Prepara o termo pro filtro `or(...ilike...)` do PostgREST: escapa curingas do ILIKE
// e remove vírgula/parênteses, que são separadores da própria sintaxe do or().
function sanitizarTermo(bruto: string): string {
  return bruto
    .replace(/[%_]/g, (m) => `\\${m}`)
    .replace(/[,()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function Secao({
  titulo,
  icon: Icon,
  total,
  hrefModulo,
  children,
}: {
  titulo: string;
  icon: LucideIcon;
  total: number;
  hrefModulo: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          <Icon size={14} strokeWidth={2} aria-hidden="true" />
          {titulo}
          <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium normal-case tracking-normal">
            {total}
          </span>
        </h2>
        <Link
          href={hrefModulo}
          className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700"
        >
          ver no módulo
          <ArrowRight size={12} strokeWidth={2} aria-hidden="true" />
        </Link>
      </div>
      {children}
    </section>
  );
}

export default async function BuscaPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
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

  const { q } = await searchParams;
  const bruto = (q ?? "").trim();
  const termo = sanitizarTermo(bruto);
  const digitos = bruto.replace(/\D/g, "");
  const buscar = termo.length >= 2;

  let cidadaos: { id: string; nome: string; whatsapp: string; email: string | null; circulo: string }[] = [];
  let apoiadores: { id: string; nome: string; telefone: string; bairro: string | null; status: string }[] = [];
  let liderancas: { id: string; nome: string; telefone: string | null; bairro: string | null; status: string }[] = [];

  if (buscar) {
    const pat = `%${termo}%`;
    // Variante só-dígitos pra achar telefone digitado com ou sem máscara.
    const foneExtra = (col: string) => (digitos.length >= 4 ? `,${col}.ilike.%${digitos}%` : "");

    const [cidRes, apoRes, lidRes] = await Promise.all([
      supabase
        .from("cidadaos")
        .select("id, nome, whatsapp, email, circulo")
        .or(`nome.ilike.${pat},whatsapp.ilike.${pat},email.ilike.${pat}${foneExtra("whatsapp")}`)
        .limit(20),
      supabase
        .from("apoiadores")
        .select("id, nome, telefone, bairro, status")
        .or(`nome.ilike.${pat},telefone.ilike.${pat},bairro.ilike.${pat}${foneExtra("telefone")}`)
        .limit(20),
      supabase
        .from("liderancas")
        .select("id, nome, telefone, bairro, status")
        .or(`nome.ilike.${pat},telefone.ilike.${pat},bairro.ilike.${pat}${foneExtra("telefone")}`)
        .limit(20),
    ]);

    cidadaos = cidRes.data ?? [];
    apoiadores = apoRes.data ?? [];
    liderancas = lidRes.data ?? [];
  }

  const nenhumResultado = buscar && cidadaos.length === 0 && apoiadores.length === 0 && liderancas.length === 0;

  return (
    <AppShell campanhaNome={campanha?.nome_candidato ?? undefined} papel={PAPEL_LABEL[eu.papel]}>
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-8 px-4 py-8">
        <div>
          <h1 className="text-lg font-semibold">Busca</h1>
          <p className="text-sm text-neutral-500">
            {buscar
              ? `Resultados para “${bruto}” em eleitores, apoiadores e lideranças.`
              : "Digite pelo menos 2 caracteres no campo de busca — nome, telefone (com ou sem máscara) ou bairro."}
          </p>
        </div>

        {nenhumResultado && (
          <p className="rounded border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-500">
            Nenhum resultado para “{bruto}”. A busca respeita o seu nível de acesso — registros fora
            do seu alcance não aparecem.
          </p>
        )}

        {buscar && cidadaos.length > 0 && (
          <Secao titulo="Eleitores" icon={Users} total={cidadaos.length} hrefModulo="/cidadaos">
            <ul className="divide-y divide-neutral-100 rounded border border-neutral-200">
              {cidadaos.map((c) => {
                const circ = CIRCULO_LABEL[c.circulo];
                return (
                  <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
                    <p className="text-sm font-medium">{c.nome}</p>
                    <p className="text-xs text-neutral-500">
                      {c.whatsapp}
                      {c.email ? ` · ${c.email}` : ""}
                    </p>
                    {circ && (
                      <span className="ml-auto flex items-center gap-1 text-xs text-neutral-500">
                        <span className={`h-1.5 w-1.5 rounded-full ${circ.dot}`} aria-hidden="true" />
                        {circ.label}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </Secao>
        )}

        {buscar && apoiadores.length > 0 && (
          <Secao titulo="Apoiadores" icon={Heart} total={apoiadores.length} hrefModulo="/apoiadores">
            <ul className="divide-y divide-neutral-100 rounded border border-neutral-200">
              {apoiadores.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
                  <p className="text-sm font-medium">{a.nome}</p>
                  <p className="text-xs text-neutral-500">
                    {a.telefone}
                    {a.bairro ? ` · ${a.bairro}` : ""}
                  </p>
                  <span className="ml-auto text-xs text-neutral-400">{a.status}</span>
                </li>
              ))}
            </ul>
          </Secao>
        )}

        {buscar && liderancas.length > 0 && (
          <Secao titulo="Lideranças" icon={Network} total={liderancas.length} hrefModulo="/liderancas">
            <ul className="divide-y divide-neutral-100 rounded border border-neutral-200">
              {liderancas.map((l) => (
                <li key={l.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
                  <p className="text-sm font-medium">{l.nome}</p>
                  <p className="text-xs text-neutral-500">
                    {l.telefone ?? "sem telefone"}
                    {l.bairro ? ` · ${l.bairro}` : ""}
                  </p>
                  <span className="ml-auto text-xs text-neutral-400">{l.status}</span>
                </li>
              ))}
            </ul>
          </Secao>
        )}
      </main>
    </AppShell>
  );
}
