import Link from "next/link";
import { SignOutButton } from "./SignOutButton";

const NAV = [
  { href: "/usuarios", label: "Usuários" },
  { href: "/base-conhecimento", label: "Base de conhecimento" },
  { href: "/monitoramento", label: "Monitoramento" },
];

export function AppHeader({ campanhaNome, papel }: { campanhaNome?: string; papel?: string }) {
  return (
    <header className="border-b border-neutral-200 px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-6">
        <div>
          <p className="text-sm font-semibold">Sistema Eleitoral 2026</p>
          {campanhaNome && (
            <p className="text-xs text-neutral-500">
              {campanhaNome}
              {papel ? ` · ${papel}` : ""}
            </p>
          )}
        </div>
        <nav className="flex gap-4">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="text-sm text-neutral-600 hover:text-neutral-900">
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
      <SignOutButton />
    </header>
  );
}
