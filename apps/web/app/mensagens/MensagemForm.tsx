"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Opcao = { id: string; nome: string };

export function MensagemForm({
  podeMandarParaCidadao,
  cidadaos,
  apoiadores,
  liderancas,
}: {
  podeMandarParaCidadao: boolean;
  cidadaos: Opcao[];
  apoiadores: Opcao[];
  liderancas: Opcao[];
}) {
  const router = useRouter();

  const [tipo, setTipo] = useState(podeMandarParaCidadao ? "cidadao" : "apoiador");
  const [destinatarioId, setDestinatarioId] = useState("");
  const [conteudo, setConteudo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  const opcoes = tipo === "cidadao" ? cidadaos : tipo === "apoiador" ? apoiadores : liderancas;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setAviso(null);

    if (!destinatarioId) {
      setErro("Escolha um destinatário.");
      return;
    }

    setCarregando(true);
    const res = await fetch("/api/mensagens/enviar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tipo_destinatario: tipo,
        destinatario_id: destinatarioId,
        canal: "whatsapp",
        conteudo,
      }),
    });
    const data = await res.json();
    setCarregando(false);

    if (!res.ok) {
      setErro(data.error ?? "erro ao registrar mensagem");
      return;
    }

    if (data.status === "pendente_configuracao") {
      setAviso("Mensagem registrada, mas o envio por WhatsApp ainda não está configurado — ninguém recebeu de verdade ainda.");
    } else if (data.status === "falhou") {
      setAviso(`Mensagem registrada, mas o envio falhou: ${data.erro_envio}`);
    } else {
      setAviso("Mensagem enviada.");
    }
    setDestinatarioId("");
    setConteudo("");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded border border-neutral-200 p-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="block text-xs font-medium text-neutral-500">Destinatário é</label>
          <select
            value={tipo}
            onChange={(e) => {
              setTipo(e.target.value);
              setDestinatarioId("");
            }}
            className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
          >
            {podeMandarParaCidadao && <option value="cidadao">Eleitor</option>}
            <option value="apoiador">Apoiador</option>
            <option value="lideranca">Liderança</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="block text-xs font-medium text-neutral-500">Quem</label>
          <select
            required
            value={destinatarioId}
            onChange={(e) => setDestinatarioId(e.target.value)}
            className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
          >
            <option value="">selecione…</option>
            {opcoes.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nome}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-1">
        <label className="block text-xs font-medium text-neutral-500">Mensagem</label>
        <textarea
          required
          rows={3}
          value={conteudo}
          onChange={(e) => setConteudo(e.target.value)}
          className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
        />
      </div>

      {erro && <p className="text-sm text-red-600">{erro}</p>}
      {aviso && <p className="text-sm text-amber-700">{aviso}</p>}

      <button
        type="submit"
        disabled={carregando}
        className="rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
      >
        {carregando ? "Enviando…" : "Enviar mensagem"}
      </button>
    </form>
  );
}
