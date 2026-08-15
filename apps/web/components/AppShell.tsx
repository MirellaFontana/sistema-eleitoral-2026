"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  Activity,
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
  IdCard,
  BookMarked,
  Radio,
  Rocket,
  Shield,
  ShieldAlert,
  ScrollText,
  Lightbulb,
  FileSearch,
  UsersRound,
  Briefcase,
  Sunrise,
  HelpCircle,
  Menu,
  X,
  ChevronRight,
  Landmark,
  Link2,
  Upload,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { SignOutButton } from "./SignOutButton";
import { NotificacaoBell } from "./NotificacaoBell";

type NavItem = { href: string; label: string; icon: LucideIcon };
type NavGroup = { label: string; items: NavItem[] };

const PAPEIS_SO_JURIDICO = new Set(["Advogado responsável", "Assistente jurídico"]);
const GRUPOS_JURIDICO = new Set(["Jurídico"]);
const HREFS_EXTRA_JURIDICO = new Set(["/monitoramento"]);
const FF_ATIVOS = process.env.NEXT_PUBLIC_FF_ATIVOS === "true";

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Estratégia",
    items: [
      { href: "/decisoes", label: "Decisões", icon: Gavel },
      { href: "/recomendacoes", label: "Recomendações", icon: Lightbulb },
      { href: "/propostas-publicos", label: "Propostas x Públicos", icon: UsersRound },
    ],
  },
  {
    label: "Administração",
    items: [
      { href: "/campanha", label: "Cadastro de campanha", icon: IdCard },
      { href: "/usuarios", label: "Usuários", icon: UserCog },
      { href: "/funcoes", label: "Funções e permissões", icon: Shield },
      { href: "/auditoria", label: "Trilha de auditoria", icon: FileSearch },
      { href: "/quarentena", label: "Quarentena de dados", icon: Shield },
      { href: "/retencao", label: "Retenção de dados", icon: CalendarClock },
    ],
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
      { href: "/briefing", label: "Briefing diário", icon: Sunrise },
      { href: "/campo", label: "Escuta de campo", icon: Radio },
      { href: "/demandas-observadas", label: "Demandas", icon: ClipboardList },
      { href: "/geolocalizacao", label: "Mapa", icon: MapPin },
    ],
  },
  {
    label: "Comunicação",
    items: [
      { href: "/mensagens", label: "Mensagens", icon: MessageCircle },
      { href: "/modelos-mensagem", label: "Modelos de mensagem", icon: BookMarked },
      { href: "/avisos", label: "Avisos internos", icon: Radio },
      { href: "/respostas", label: "Respostas", icon: Reply },
    ],
  },
  {
    label: "Jurídico",
    items: [
      { href: "/juridico/processos", label: "Processos", icon: Briefcase },
      { href: "/juridico/consulta", label: "Tira-dúvidas", icon: Search },
      { href: "/dossie-juridico", label: "Dossiê jurídico", icon: Gavel },
      { href: "/calendario-eleitoral", label: "Calendário eleitoral", icon: CalendarClock },
    ],
  },
  {
    label: "Inteligência",
    items: [
      { href: "/diretrizes", label: "Diretrizes da Campanha", icon: ScrollText },
      { href: "/monitoramento", label: "Monitoramento", icon: Eye },
      { href: "/denuncias/nova", label: "Registrar denúncia", icon: ShieldAlert },
      { href: "/alertas", label: "Alertas", icon: Bell },
      { href: "/fontes", label: "Saúde das fontes", icon: Activity },
      { href: "/concorrentes", label: "Concorrentes", icon: Target },
      { href: "/base-conhecimento", label: "Base de conhecimento", icon: BookOpen },
      { href: "/propostas", label: "Propostas", icon: FileText },
      { href: "/narrativas", label: "Narrativas", icon: BookMarked },
      { href: "/base-normativa", label: "Código eleitoral", icon: Scale },
    ],
  },
  {
    label: "Marketing",
    items: [
      { href: "/marketing", label: "Marketing", icon: Megaphone },
      { href: "/marketing/impulsionamento", label: "Impulsionamento (Ads)", icon: Rocket },
      { href: "/pecas-conteudo", label: "Peças de conteúdo", icon: FileText },
    ],
  },
  {
    label: "Ativos Políticos",
    items: [
      { href: "/ativos-politicos", label: "Dashboard", icon: Landmark },
      { href: "/ativos-politicos/lista", label: "Lista de Ativos", icon: Users },
      { href: "/ativos-politicos/mapa", label: "Mapa", icon: MapPin },
      { href: "/ativos-politicos/relacoes", label: "Relações", icon: Link2 },
      { href: "/ativos-politicos/importar", label: "Importação", icon: Upload },
      { href: "/ativos-politicos/configuracoes", label: "Configurações", icon: Settings },
    ],
  },
  {
    label: "Suporte",
    items: [
      { href: "/ajuda", label: "Ajuda do sistema", icon: HelpCircle },
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
      className={`group relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors ${
        active
          ? "bg-teal-500/10 text-teal-300"
          : "text-slate-400 hover:bg-white/5 hover:text-slate-100"
      }`}
    >
      <span
        className={`absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full transition-colors ${
          active ? "bg-teal-400" : "bg-transparent"
        }`}
        aria-hidden="true"
      />
      <Icon
        size={15}
        strokeWidth={2}
        className={`shrink-0 ${active ? "text-teal-400" : "text-slate-500 group-hover:text-slate-300"}`}
        aria-hidden="true"
      />
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
  const [devMode, setDevMode] = useState(false);
  const [advMode, setAdvMode] = useState(false);

  const soJuridico = !devMode && (PAPEIS_SO_JURIDICO.has(papel ?? "") || advMode);
  const gruposBase = FF_ATIVOS
    ? NAV_GROUPS
    : NAV_GROUPS.filter((g) => g.label !== "Ativos Políticos");
  const gruposVisiveis = soJuridico
    ? (gruposBase.map((g) => {
        if (GRUPOS_JURIDICO.has(g.label)) return g;
        const items = g.items.filter((i) => HREFS_EXTRA_JURIDICO.has(i.href));
        return items.length ? { ...g, items } : null;
      }).filter(Boolean) as NavGroup[])
    : gruposBase;

  const [gruposAbertos, setGruposAbertos] = useState<Set<string>>(() => {
    const set = new Set<string>();
    for (const g of gruposVisiveis) {
      if (g.items.some((i) => i.href === pathname)) set.add(g.label);
    }
    return set;
  });

  useEffect(() => {
    setMenuAberto(false);
    for (const g of NAV_GROUPS) {
      if (g.items.some((i) => i.href === pathname)) {
        setGruposAbertos((prev) => new Set([...prev, g.label]));
      }
    }
  }, [pathname]);

  useEffect(() => {
    const supabase = createClient();
    supabase.rpc("is_dev_plataforma").then(({ data }) => {
      if (data === true) setDevMode(true);
    });
    supabase.rpc("is_advogado_externo").then(({ data }) => {
      if (data === true) setAdvMode(true);
    });
  }, []);

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
        className={`fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 -translate-x-full flex-col border-r border-white/5 bg-[#0b1220] transition-transform duration-200 md:static md:w-60 md:translate-x-0 ${
          menuAberto ? "translate-x-0" : ""
        }`}
      >
        <div className="flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- ícone pequeno estático, não precisa de otimização */}
            <img src="/icon.png" alt="" className="h-6 w-6 rounded-md" />
            <p className="text-[13px] font-semibold tracking-wide text-white">Gestão Eleitoral Inteligente</p>
          </div>
          <button
            onClick={() => setMenuAberto(false)}
            className="rounded p-1 text-slate-400 hover:bg-white/5 hover:text-white md:hidden"
            aria-label="Fechar menu"
          >
            <X size={18} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 pb-4">
          {!soJuridico && (
            <NavLink
              href="/dashboard"
              label="Sala de Decisão"
              icon={LayoutDashboard}
              active={pathname === "/dashboard"}
              onNavigate={() => setMenuAberto(false)}
            />
          )}

          {gruposVisiveis.map((group) => {
            const aberto = gruposAbertos.has(group.label);
            return (
              <div key={group.label}>
                <button
                  onClick={() =>
                    setGruposAbertos((prev) => {
                      const next = new Set(prev);
                      if (next.has(group.label)) next.delete(group.label);
                      else next.add(group.label);
                      return next;
                    })
                  }
                  className="flex w-full items-center justify-between px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400 hover:text-slate-300"
                >
                  {group.label}
                  <ChevronRight
                    size={10}
                    className={`shrink-0 transition-transform duration-150 ${aberto ? "rotate-90" : ""}`}
                  />
                </button>
                {aberto && (
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
                )}
              </div>
            );
          })}
        </nav>

        <div className="flex items-center gap-2 border-t border-white/5 px-4 py-3">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
          </span>
          <p className="truncate text-[11px] text-slate-500">
            {campanhaNome ? <span className="text-slate-400">{campanhaNome}</span> : "Sistema online"}
          </p>
        </div>
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
            {devMode && (
              <Link
                href="/dev/campanhas"
                className="hidden items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700 hover:bg-amber-200 sm:inline-flex"
              >
                Dev
              </Link>
            )}
            {advMode && (
              <Link
                href="/adv/clientes"
                className="hidden items-center gap-1 rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-teal-700 hover:bg-teal-200 sm:inline-flex"
              >
                Clientes
              </Link>
            )}
          </div>
          <BuscaGlobalForm />
          <NotificacaoBell />
          <SignOutButton />
        </header>

        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
