"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function MfaEnrollPage() {
  const router = useRouter();
  const supabase = createClient();

  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [codigo, setCodigo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [verificando, setVerificando] = useState(false);

  useEffect(() => {
    (async () => {
      // Limpa tentativas de enrollment anteriores não confirmadas, pra não acumular fator solto.
      // `data.totp` só traz fatores já VERIFICADOS — os não confirmados só aparecem em `data.all`.
      const { data: fatores } = await supabase.auth.mfa.listFactors();
      for (const f of fatores?.all ?? []) {
        if (f.factor_type === "totp" && f.status === "unverified") {
          await supabase.auth.mfa.unenroll({ factorId: f.id });
        }
      }

      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: `totp-${Date.now()}`,
      });
      setCarregando(false);
      if (error || !data) {
        setErro(error?.message ?? "não foi possível iniciar o cadastro de MFA");
        return;
      }
      setFactorId(data.id);
      setQrCode(data.totp.qr_code);
      setSecret(data.totp.secret);
    })();
  }, [supabase]);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!factorId) return;
    setErro(null);
    setVerificando(true);

    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
      factorId,
    });
    if (challengeError || !challenge) {
      setVerificando(false);
      setErro(challengeError?.message ?? "erro ao gerar desafio");
      return;
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code: codigo,
    });

    setVerificando(false);
    if (verifyError) {
      setErro(verifyError.message);
      return;
    }

    router.push("/usuarios");
    router.refresh();
  }

  return (
    <main className="flex-1 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm space-y-4">
        <div>
          <h1 className="text-xl font-semibold">Ativar autenticação em duas etapas</h1>
          <p className="text-sm text-neutral-500">
            Obrigatório para este papel. Escaneie o QR code com um app autenticador (Google
            Authenticator, Authy, 1Password) e digite o código de 6 dígitos.
          </p>
        </div>

        {carregando && <p className="text-sm text-neutral-500">Gerando QR code…</p>}

        {qrCode && (
          // eslint-disable-next-line @next/next/no-img-element -- data: URI, next/image não aceita
          <img src={qrCode} alt="QR code para configurar o autenticador" className="mx-auto w-48 h-48" />
        )}

        {secret && (
          <p className="text-center text-xs text-neutral-500">
            Não consegue escanear? Digite manualmente no app:{" "}
            <span className="font-mono tracking-wider">{secret}</span>
          </p>
        )}

        {qrCode && (
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
              {verificando ? "Confirmando…" : "Confirmar e ativar"}
            </button>
          </form>
        )}

        {erro && !qrCode && <p className="text-sm text-red-600">{erro}</p>}
      </div>
    </main>
  );
}
