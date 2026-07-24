"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Territorio = { id: string; nome_bairro: string | null };
type Funcao = { id: string; nome: string };

// "Embaixador" saiu das opções: liderança de campo não tem mais login — vira registro em
// /liderancas (ref. specs.md [2026-07-15] "Remodelagem do campo"). O papel segue no banco
// só como legado.
const PAPEIS = [
  { value: "advogado_responsavel", label: "Advogado responsável" },
  { value: "assistente_juridico", label: "Assistente jurídico" },
  { value: "coord_marketing", label: "Coord. de marketing" },
  { value: "redator_marketing", label: "Redator de marketing" },
  { value: "coord_campanha", label: "Coord. de campanha" },
  { value: "candidato", label: "Candidato" },
  { value: "apoio_marketing", label: "Apoio de marketing" },
  { value: "apoio_campanha", label: "Apoio de campanha" },
  { value: "apoio_coordenacao", label: "Apoio de coordenação" },
];

const MFA_OBRIGATORIO = new Set(["coord_campanha", "candidato"]);

export function InviteUserForm({ territorios, funcoes }: { territorios: Territorio[]; funcoes: Funcao[] }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [papel, setPapel] = useState("redator_marketing");
  const [territorioId, setTerritorioId] = useState("");
  const [expiraEm, setExpiraEm] = useState("");
  const [funcaoId, setFuncaoId] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  const precisaTerritorio = papel === "embaixador";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setSucesso(null);

    if (precisaTerritorio && (!territorioId || !expiraEm)) {
      setErro("Embaixador precisa de território e data de expiração.");
      return;
    }

    setCarregando(true);
    const res = await fetch("/api/usuarios/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        nome,
        telefone: telefone.trim(),
        papel,
        territorio_id: precisaTerritorio ? territorioId : null,
        exige_mfa: MFA_OBRIGATORIO.has(papel),
        expira_em: precisaTerritorio ? expiraEm : null,
        funcao_id: funcaoId || null,
      }),
    });
    const data = await res.json();
    setCarregando(false);

    if (!res.ok) {
      setErro(data.error ?? "erro ao convidar");
      return;
    }

    setSucesso(`Convite enviado para ${email}.`);
    setEmail("");
    setNome("");
    setTelefone("");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded border border-neutral-200 p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="block text-xs font-medium text-neutral-500">Nome</label>
          <input
            required
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label className="block text-xs font-medium text-neutral-500">E-mail</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="block text-xs font-medium text-neutral-500">
            Telefone (WhatsApp)
          </label>
          <input
            required
            placeholder="+55819..."
            value={telefone}
            onChange={(e) => setTelefone(e.target.value)}
            className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="block text-xs font-medium text-neutral-500">Papel</label>
          <select
            value={papel}
            onChange={(e) => setPapel(e.target.value)}
            className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
          >
            {PAPEIS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-medium text-neutral-500">Função (permissões)</label>
          <select
            value={funcaoId}
            onChange={(e) => setFuncaoId(e.target.value)}
            className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
          >
            <option value="">— automática pelo papel —</option>
            {funcoes.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome}
              </option>
            ))}
          </select>
        </div>

        {precisaTerritorio && (
          <div className="space-y-1">
            <label className="block text-xs font-medium text-neutral-500">Território</label>
            <select
              value={territorioId}
              onChange={(e) => setTerritorioId(e.target.value)}
              className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
            >
              <option value="">selecione…</option>
              {territorios.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome_bairro}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {precisaTerritorio && (
        <div className="space-y-1">
          <label className="block text-xs font-medium text-neutral-500">
            Expira em (fim do ciclo)
          </label>
          <input
            type="date"
            value={expiraEm}
            onChange={(e) => setExpiraEm(e.target.value)}
            className="rounded border border-neutral-300 px-2 py-1.5 text-sm"
          />
        </div>
      )}

      {MFA_OBRIGATORIO.has(papel) && (
        <p className="text-xs text-neutral-500">MFA obrigatório para este papel.</p>
      )}

      {erro && <p className="text-sm text-red-600">{erro}</p>}
      {sucesso && <p className="text-sm text-green-700">{sucesso}</p>}

      <button
        type="submit"
        disabled={carregando}
        className="rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
      >
        {carregando ? "Convidando…" : "Convidar usuário"}
      </button>
    </form>
  );
}
