"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Advogado = {
  id: string;
  email: string;
  nome: string;
  ativo: boolean;
  created_at: string;
};

export function AdvogadosExternos({ advogados }: { advogados: Advogado[] }) {
  const router = useRouter();
  const supabase = createClient();

  const [aberto, setAberto] = useState(false);
  const [email, setEmail] = useState("");
  const [nome, setNome] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);

    const res = await fetch("/api/dev/advogados-externos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
        nome: nome.trim(),
        senha,
      }),
    });

    const data = await res.json();
    setCarregando(false);

    if (!res.ok) {
      setErro(data.error ?? "Erro ao cadastrar");
      return;
    }

    setEmail("");
    setNome("");
    setSenha("");
    setAberto(false);
    router.refresh();
  }

  async function toggleAtivo(id: string, ativo: boolean) {
    await supabase
      .from("advogados_externos")
      .update({ ativo: !ativo })
      .eq("id", id);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-teal-600">
            Advogados Externos
          </h2>
          <p className="text-xs text-neutral-400">
            Profissionais com acesso apenas ao módulo jurídico
          </p>
        </div>
      </div>

      {!aberto ? (
        <button
          onClick={() => setAberto(true)}
          className="w-full rounded border border-dashed border-neutral-300 px-3 py-2 text-sm text-neutral-500 hover:border-teal-400 hover:text-teal-600 transition"
        >
          + Cadastrar advogado externo
        </button>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3 rounded border border-teal-200 bg-teal-50/30 p-4">
          <div className="space-y-1">
            <label className="block text-xs font-medium text-neutral-500">Nome</label>
            <input
              required
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Dr. João Silva"
              className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="block text-xs font-medium text-neutral-500">Email</label>
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="advogado@email.com"
                className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-neutral-500">Senha</label>
              <input
                required
                type="password"
                minLength={6}
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
              />
            </div>
          </div>

          {erro && <p className="text-sm text-red-600">{erro}</p>}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={carregando}
              className="rounded bg-teal-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
            >
              {carregando ? "Salvando…" : "Cadastrar"}
            </button>
            <button
              type="button"
              onClick={() => setAberto(false)}
              className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-50"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {advogados.length === 0 ? (
        <p className="text-sm text-neutral-400">Nenhum advogado externo cadastrado.</p>
      ) : (
        <ul className="space-y-2">
          {advogados.map((a) => (
            <li
              key={a.id}
              className="flex items-center justify-between rounded border border-neutral-200 p-3"
            >
              <div>
                <p className="text-sm font-medium">{a.nome}</p>
                <p className="text-xs text-neutral-400">{a.email}</p>
              </div>
              <button
                onClick={() => toggleAtivo(a.id, a.ativo)}
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition ${
                  a.ativo
                    ? "bg-green-100 text-green-700 hover:bg-red-100 hover:text-red-700"
                    : "bg-neutral-100 text-neutral-500 hover:bg-green-100 hover:text-green-700"
                }`}
              >
                {a.ativo ? "Ativo" : "Inativo"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
