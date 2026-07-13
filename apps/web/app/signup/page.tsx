"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [aguardandoConfirmacao, setAguardandoConfirmacao] = useState(false);
  const [carregando, setCarregando] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);

    const { data, error } = await supabase.auth.signUp({ email, password: senha });

    setCarregando(false);
    if (error) {
      setErro(error.message);
      return;
    }

    if (data.session) {
      // Confirmação de e-mail desligada no projeto — já entra logado.
      router.push("/onboarding");
      router.refresh();
      return;
    }

    setAguardandoConfirmacao(true);
  }

  if (aguardandoConfirmacao) {
    return (
      <main className="flex-1 flex items-center justify-center px-4">
        <div className="max-w-sm text-center space-y-2">
          <h1 className="text-xl font-semibold">Confirme seu e-mail</h1>
          <p className="text-sm text-neutral-500">
            Enviamos um link de confirmação para <strong>{email}</strong>. Depois de confirmar,
            volte e entre normalmente.
          </p>
          <Link href="/login" className="text-sm underline">
            Ir para o login
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 flex items-center justify-center px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <div>
          <h1 className="text-xl font-semibold">Criar conta</h1>
          <p className="text-sm text-neutral-500">
            Primeiro acesso — depois de criar a conta, você cadastra os dados da campanha.
          </p>
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
            className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
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
            minLength={8}
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
          />
        </div>

        {erro && <p className="text-sm text-red-600">{erro}</p>}

        <button
          type="submit"
          disabled={carregando}
          className="w-full rounded bg-neutral-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {carregando ? "Criando…" : "Criar conta"}
        </button>

        <p className="text-sm text-neutral-500">
          Já tem conta?{" "}
          <Link href="/login" className="underline">
            Entrar
          </Link>
        </p>
      </form>
    </main>
  );
}
