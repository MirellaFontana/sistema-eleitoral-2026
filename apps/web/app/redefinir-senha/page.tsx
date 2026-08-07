"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function RedefinirSenhaPage() {
  const router = useRouter();
  const supabase = createClient();
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);

    if (senha.length < 8) {
      setErro("A senha deve ter no mínimo 8 caracteres.");
      return;
    }
    if (senha !== confirmacao) {
      setErro("As senhas não coincidem.");
      return;
    }

    setCarregando(true);
    const { error } = await supabase.auth.updateUser({ password: senha });
    setCarregando(false);

    if (error) {
      setErro(error.message);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <main className="flex-1 flex items-center justify-center px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <div>
          <img src="/logo.png" alt="Eleito Online" className="mx-auto mb-6 h-auto w-80" />
          <h1 className="text-xl font-semibold">Redefinir senha</h1>
          <p className="text-sm text-neutral-500">Digite sua nova senha.</p>
        </div>

        <div className="space-y-1">
          <label htmlFor="senha" className="block text-sm font-medium">Nova senha</label>
          <input
            id="senha"
            type="password"
            required
            minLength={8}
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="confirmacao" className="block text-sm font-medium">Confirmar senha</label>
          <input
            id="confirmacao"
            type="password"
            required
            minLength={8}
            value={confirmacao}
            onChange={(e) => setConfirmacao(e.target.value)}
            className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600"
          />
        </div>

        {erro && <p className="text-sm text-red-600">{erro}</p>}

        <button
          type="submit"
          disabled={carregando}
          className="w-full rounded bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {carregando ? "Salvando…" : "Salvar nova senha"}
        </button>
      </form>
    </main>
  );
}
