"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [modoReset, setModoReset] = useState(false);
  const [resetEnviado, setResetEnviado] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });

    setCarregando(false);
    if (error) {
      setErro(error.message);
      return;
    }
    router.push("/");
    router.refresh();
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/redefinir-senha`,
    });

    setCarregando(false);
    if (error) {
      setErro(error.message);
      return;
    }
    setResetEnviado(true);
  }

  if (resetEnviado) {
    return (
      <main className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-sm space-y-4 text-center">
          <img src="/logo.png" alt="Eleito Online" className="mx-auto mb-6 h-auto w-80" />
          <h1 className="text-xl font-semibold">E-mail enviado</h1>
          <p className="text-sm text-neutral-500">
            Enviamos um link de redefinição para <strong>{email}</strong>.
            Verifique sua caixa de entrada e spam.
          </p>
          <button
            onClick={() => { setModoReset(false); setResetEnviado(false); }}
            className="text-sm text-indigo-600 underline"
          >
            Voltar ao login
          </button>
        </div>
      </main>
    );
  }

  if (modoReset) {
    return (
      <main className="flex-1 flex items-center justify-center px-4">
        <form onSubmit={handleReset} className="w-full max-w-sm space-y-4">
          <div>
            <img src="/logo.png" alt="Eleito Online" className="mx-auto mb-6 h-auto w-80" />
            <h1 className="text-xl font-semibold">Esqueci minha senha</h1>
            <p className="text-sm text-neutral-500">
              Digite seu e-mail para receber o link de redefinição.
            </p>
          </div>

          <div className="space-y-1">
            <label htmlFor="email" className="block text-sm font-medium">E-mail</label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600"
            />
          </div>

          {erro && <p className="text-sm text-red-600">{erro}</p>}

          <button
            type="submit"
            disabled={carregando}
            className="w-full rounded bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {carregando ? "Enviando…" : "Enviar link"}
          </button>

          <button
            type="button"
            onClick={() => { setModoReset(false); setErro(null); }}
            className="w-full text-sm text-neutral-500 underline"
          >
            Voltar ao login
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="flex-1 flex items-center justify-center px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <div>
          <img src="/logo.png" alt="Eleito — Gestão Eleitoral Inteligente" className="mx-auto mb-6 h-auto w-80" />
          <h1 className="text-xl font-semibold">Entrar</h1>
        </div>

        <div className="space-y-1">
          <label htmlFor="email" className="block text-sm font-medium">
            E-mail
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="senha" className="block text-sm font-medium">
            Senha
          </label>
          <input
            id="senha"
            type="password"
            required
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600"
          />
        </div>

        {erro && <p className="text-sm text-red-600">{erro}</p>}

        <button
          type="submit"
          disabled={carregando}
          className="w-full rounded bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {carregando ? "Entrando…" : "Entrar"}
        </button>

        <div className="flex items-center justify-between text-xs text-neutral-400">
          <button
            type="button"
            onClick={() => { setModoReset(true); setErro(null); }}
            className="underline hover:text-neutral-600"
          >
            Esqueci minha senha
          </button>
          <span>Acesso por convite</span>
        </div>
      </form>
    </main>
  );
}
