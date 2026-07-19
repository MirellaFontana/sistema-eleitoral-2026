"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
  Reply,
  BookOpen,
  Gavel,
  Target,
  Search,
  CalendarClock,
  CalendarDays,
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
      { href: "/agenda", label: "Agenda", icon: CalendarDays },
      { href: "/geolocalizacao", label: "Mapa", icon: MapPin },
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
      { href: "/dossie-juridico", label: "Dossiê jurídico", icon: Scale },
      { href: "/calendario-eleitoral", label: "Calendário eleitoral", icon: CalendarClock },
    ],
  },
  {
    label: "Marketing",
    items: [
      { href: "/monitoramento", label: "Monitoramento", icon: Eye },
      { href: "/respostas", label: "Respostas", icon: Reply },
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
      { href: "/demandas-observadas", label: "Demandas", icon: ClipboardList },
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
          : "text-neutral-400 hover:bg-[#2c323c]/60 hover:text-white"
      }`}
    >
      <Icon size={15} strokeWidth={2} className="shrink-0" aria-hidden="true" />
      {label}
    </Link>
  );
}

function BuscaGlobalForm() {
  const router = useRouter();
  const [termo, setTermo] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = termo.trim();
    if (q.length < 2) return;
    router.push(`/busca?q=${encodeURIComponent(q)}`);
  }

  return (
    <form onSubmit={handleSubmit} className="relative min-w-0 flex-1 max-w-[180px] sm:max-w-xs">
      <Search
        size={14}
        strokeWidth={2}
        className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-neutral-400"
        aria-hidden="true"
      />
      <input
        type="search"
        value={termo}
        onChange={(e) => setTermo(e.target.value)}
        placeholder="Buscar pessoa…"
        aria-label="Buscar pessoa em eleitores, apoiadores e lideranças"
        className="w-full rounded border border-neutral-200 bg-neutral-50 py-1.5 pl-7 pr-2 text-sm placeholder:text-neutral-400"
      />
    </form>
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
        className={`fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 -translate-x-full flex-col gap-6 border-r border-[#3a414d] bg-[#232830] px-3 py-5 transition-transform duration-200 md:static md:w-56 md:translate-x-0 ${
          menuAberto ? "translate-x-0" : ""
        }`}
      >
        <div className="flex items-center justify-between px-2">
          <p className="text-sm font-semibold text-white">Sistema Eleitoral 2026</p>
          <button
            onClick={() => setMenuAberto(false)}
            className="rounded p-1 text-neutral-400 hover:bg-[#2c323c] hover:text-white md:hidden"
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
              <p className="hidden truncate text-xs text-neutral-500 sm:block">
                {campanhaNome}
                {papel ? ` · ${papel}` : ""}
              </p>
            )}
          </div>
          <BuscaGlobalForm />
          <SignOutButton />
        </header>

        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
