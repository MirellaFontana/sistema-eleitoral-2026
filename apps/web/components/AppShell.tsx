"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  UserCog,
  Users,
  Heart,
  Network,
  ListChecks,
  MapPin,
  ClipboardList,
  MessageCircle,
  Bell,
  Eye,
  Scale,
  Megaphone,
  FileText,
  BookOpen,
  Gavel,
  Target,
  Menu,
  X,
  type LucideIcon,
} from "lucide-react";
import { SignOutButton } from "./SignOutButton";

type NavItem = { href: string; label: string; icon: LucideIcon };
type NavGroup = { label: string; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Administração",
    items: [{ href: "/usuarios", label: "Usuários", icon: UserCog }],
  },
  {
    label: "Cadastros",
    items: [
      { href: "/cidadaos", label: "Eleitores", icon: Users },
      { href: "/apoiadores", label: "Apoiadores", icon: Heart },
      { href: "/liderancas", label: "Lideranças", icon: Network },
    ],
  },
  {
    label: "Gestão",
    items: [
      { href: "/tarefas", label: "Tarefas", icon: ListChecks },
      { href: "/geolocalizacao", label: "Mapa", icon: MapPin },
      { href: "/demandas-observadas", label: "Demandas", icon: ClipboardList },
    ],
  },
  {
    label: "Comunicação",
    items: [
      { href: "/mensagens", label: "Mensagens", icon: MessageCircle },
      { href: "/alertas", label: "Alertas", icon: Bell },
    ],
  },
  {
    label: "Jurídico",
    items: [
      { href: "/monitoramento", label: "Monitoramento", icon: Eye },
      { href: "/dossie-juridico", label: "Dossiê jurídico", icon: Scale },
    ],
  },
  {
    label: "Marketing",
    items: [
      { href: "/marketing", label: "Marketing", icon: Megaphone },
      { href: "/pecas-conteudo", label: "Peças de conteúdo", icon: FileText },
    ],
  },
  {
    label: "Conhecimento",
    items: [
      { href: "/base-conhecimento", label: "Base de conhecimento", icon: BookOpen },
      { href: "/base-conhecimento#tema-codigo-eleitoral", label: "Código eleitoral", icon: Gavel },
      { href: "/concorrentes", label: "Concorrentes", icon: Target },
    ],
  },
];

function NavLink({
  href,
  label,
  icon: Icon,
  active,
  onNavigate,
}: NavItem & { active: boolean; onNavigate: () => void }) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={`flex items-center gap-2 rounded px-2.5 py-1.5 text-sm transition-colors ${
        active
          ? "bg-indigo-600 text-white"
          : "text-neutral-400 hover:bg-neutral-800/60 hover:text-white"
      }`}
    >
      <Icon size={15} strokeWidth={2} className="shrink-0" aria-hidden="true" />
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
  const [menuAberto, setMenuAberto] = useState(false);

  // Fecha o menu mobile automaticamente ao trocar de rota — sem isso, o drawer ficaria
  // aberto por cima da tela nova depois de navegar.
  useEffect(() => {
    setMenuAberto(false);
  }, [pathname]);

  return (
    <div className="flex min-h-screen flex-1">
      {menuAberto && (
        <div
          onClick={() => setMenuAberto(false)}
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 -translate-x-full flex-col gap-6 border-r border-neutral-800 bg-neutral-900 px-3 py-5 transition-transform duration-200 md:static md:w-56 md:translate-x-0 ${
          menuAberto ? "translate-x-0" : ""
        }`}
      >
        <div className="flex items-center justify-between px-2">
          <p className="text-sm font-semibold text-white">Sistema Eleitoral 2026</p>
          <button
            onClick={() => setMenuAberto(false)}
            className="rounded p-1 text-neutral-400 hover:bg-neutral-800 hover:text-white md:hidden"
            aria-label="Fechar menu"
          >
            <X size={18} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-5 overflow-y-auto">
          <NavLink
            href="/dashboard"
            label="Dashboard"
            icon={LayoutDashboard}
            active={pathname === "/dashboard"}
            onNavigate={() => setMenuAberto(false)}
          />

          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="px-2.5 pb-1.5 text-[11px] font-medium uppercase tracking-wide text-neutral-500">
                {group.label}
              </p>
              <div className="flex flex-col gap-0.5">
                {group.items.map((item) => (
                  <NavLink
                    key={item.href}
                    {...item}
                    active={pathname === item.href}
                    onNavigate={() => setMenuAberto(false)}
                  />
                ))}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-2 border-b border-neutral-200 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <button
              onClick={() => setMenuAberto(true)}
              className="shrink-0 rounded p-1.5 text-neutral-500 hover:bg-neutral-100 md:hidden"
              aria-label="Abrir menu"
            >
              <Menu size={20} strokeWidth={2} aria-hidden="true" />
            </button>
            {campanhaNome && (
              <p className="truncate text-xs text-neutral-500">
                {campanhaNome}
                {papel ? ` · ${papel}` : ""}
              </p>
            )}
          </div>
          <SignOutButton />
        </header>

        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
