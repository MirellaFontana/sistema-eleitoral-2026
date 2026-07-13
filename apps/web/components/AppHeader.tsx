import { SignOutButton } from "./SignOutButton";

export function AppHeader({ campanhaNome, papel }: { campanhaNome?: string; papel?: string }) {
  return (
    <header className="border-b border-neutral-200 px-6 py-4 flex items-center justify-between">
      <div>
        <p className="text-sm font-semibold">Sistema Eleitoral 2026</p>
        {campanhaNome && (
          <p className="text-xs text-neutral-500">
            {campanhaNome}
            {papel ? ` · ${papel}` : ""}
          </p>
        )}
      </div>
      <SignOutButton />
    </header>
  );
}
