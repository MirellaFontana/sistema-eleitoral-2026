"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignOutButton } from "./SignOutButton";

type NavItem = { href: string; label: string };
type NavGroup = { label: string; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Administração",
    items: [{ href: "/usuarios", label: "Usuários" }],
  },
  {
    label: "Cadastros",
    items: [
      { href: "/cidadaos", label: "Eleitores" },
      { href: "/apoiadores", label: "Apoiadores" },
      { href: "/liderancas", label: "Lideranças" },
    ],
  },
  {
    label: "Gestão",
    items: [
      { href: "/tarefas", label: "Tarefas" },
      { href: "/geolocalizacao", label: "Mapa" },
      { href: "/demandas-observadas", label: "Demandas" },
    ],
  },
  {
    label: "Comunicação",
    items: [
      { href: "/mensagens", label: "Mensagens" },
      { href: "/alertas", label: "Alertas" },
    ],
  },
  {
    label: "Jurídico",
    items: [
      { href: "/monitoramento", label: "Monitoramento" },
      { href: "/dossie-juridico", label: "Dossiê jurídico" },
    ],
  },
  {
    label: "Marketing",
    items: [
      { href: "/marketing", label: "Marketing" },
      { href: "/pecas-conteudo", label: "Peças de conteúdo" },
    ],
  },
  {
    label: "Conhecimento",
    items: [
      { href: "/base-conhecimento", label: "Base de conhecimento" },
      { href: "/base-conhecimento#tema-codigo-eleitoral", label: "Código eleitoral" },
      { href: "/concorrentes", label: "Concorrentes" },
    ],
  },
];

function NavLink({ href, label, active }: NavItem & { active: boolean }) {
  return (
    <Link
      href={href}
      className={`rounded px-2.5 py-1.5 text-sm transition-colors ${
        active
          ? "bg-neutral-800 text-white"
          : "text-neutral-400 hover:bg-neutral-800/60 hover:text-white"
      }`}
    >
      {label}
    </Link>
  );
}

export function AppShell({
  campanhaNome,
  papel,
  children,
}: {
  campanhaNome?: string;
  papel?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen flex-1">
      <aside className="flex w-56 shrink-0 flex-col gap-6 border-r border-neutral-800 bg-neutral-900 px-3 py-5">
        <p className="px-2 text-sm font-semibold text-white">Sistema Eleitoral 2026</p>

        <nav className="flex flex-1 flex-col gap-5 overflow-y-auto">
          <NavLink href="/dashboard" label="Dashboard" active={pathname === "/dashboard"} />

          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="px-2.5 pb-1.5 text-[11px] font-medium uppercase tracking-wide text-neutral-500">
                {group.label}
              </p>
              <div className="flex flex-col gap-0.5">
                {group.items.map((item) => (
                  <NavLink key={item.href} {...item} active={pathname === item.href} />
                ))}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-neutral-200 px-6 py-3">
          <div>
            {campanhaNome && (
              <p className="text-xs text-neutral-500">
                {campanhaNome}
                {papel ? ` · ${papel}` : ""}
              </p>
            )}
          </div>
          <SignOutButton />
        </header>

        {children}
      </div>
    </div>
  );
}
