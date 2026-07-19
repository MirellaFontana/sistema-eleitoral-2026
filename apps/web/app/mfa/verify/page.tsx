"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function MfaVerifyPage() {
  const router = useRouter();
  const supabase = createClient();

  const [factorId, setFactorId] = useState<string | null>(null);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [codigo, setCodigo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [verificando, setVerificando] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: fatores, error: listError } = await supabase.auth.mfa.listFactors();
      const fator = fatores?.totp.find((f) => f.status === "verified");

      if (listError || !fator) {
        setCarregando(false);
        setErro("nenhum fator de MFA verificado encontrado");
        return;
      }
      setFactorId(fator.id);

      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: fator.id,
      });
      setCarregando(false);
      if (challengeError || !challenge) {
        setErro(challengeError?.message ?? "erro ao gerar desafio");
        return;
      }
      setChallengeId(challenge.id);
    })();
  }, [supabase]);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!factorId || !challengeId) return;
    setErro(null);
    setVerificando(true);

    const { error } = await supabase.auth.mfa.verify({ factorId, challengeId, code: codigo });

    setVerificando(false);
    if (error) {
      setErro(error.message);
      return;
    }

    router.push("/usuarios");
    router.refresh();
  }

  return (
    <main className="flex-1 flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-4">
        <div>
          <h1 className="text-xl font-semibold">Confirmar identidade</h1>
          <p className="text-sm text-neutral-500">
            Digite o código do seu app autenticador para continuar.
          </p>
        </div>

        {carregando && <p className="text-sm text-neutral-500">Preparando desafio…</p>}

        {challengeId && (
          <form onSubmit={handleVerify} className="space-y-3">
            <div className="space-y-1">
              <label htmlFor="codigo" className="block text-sm font-medium">
                Código de 6 dígitos
              </label>
              <input
                id="codigo"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                autoFocus
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                className="w-full rounded border border-neutral-300 px-3 py-2 text-sm tracking-widest focus:outline-none focus:ring-2 focus:ring-indigo-600"
              />
            </div>

            {erro && <p className="text-sm text-red-600">{erro}</p>}

            <button
              type="submit"
              disabled={verificando}
              className="w-full rounded bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {verificando ? "Verificando…" : "Confirmar"}
            </button>
          </form>
        )}

        {erro && !challengeId && !carregando && (
          <p className="text-sm text-red-600">{erro}</p>
        )}
      </div>
    </main>
  );
}
