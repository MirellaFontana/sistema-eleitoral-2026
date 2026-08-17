"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { PARTIDOS } from "@/lib/partidos";

type DadosCampanha = {
  campanhaId: string;
  nomeCandidato: string;
  cargo: string | null;
  uf: string | null;
  partido: string | null;
  numeroCandidato: string | null;
  nomeUrna: string | null;
  cnpjCampanha: string | null;
  coligacao: string | null;
  vozCandidato: string | null;
};

const CARGOS = ["deputado estadual", "deputado federal", "senador", "governador"];
const UFS = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB",
  "PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
];

export function CampanhaForm({ dados }: { dados: DadosCampanha }) {
  const router = useRouter();
  const supabase = createClient();

  const [nomeCandidato, setNomeCandidato] = useState(dados.nomeCandidato);
  const [cargo, setCargo] = useState(dados.cargo ?? CARGOS[0]);
  const [uf, setUf] = useState(dados.uf ?? "SP");
  const [partido, setPartido] = useState(dados.partido ?? "");
  const [numeroCandidato, setNumeroCandidato] = useState(dados.numeroCandidato ?? "");
  const [nomeUrna, setNomeUrna] = useState(dados.nomeUrna ?? "");
  const [cnpjCampanha, setCnpjCampanha] = useState(dados.cnpjCampanha ?? "");
  const [coligacao, setColigacao] = useState(dados.coligacao ?? "");
  const [vozCandidato, setVozCandidato] = useState(dados.vozCandidato ?? "");
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);
  const [carregando, setCarregando] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setSucesso(false);
    setCarregando(true);

    const { error } = await supabase
      .from("campanhas")
      .update({
        nome_candidato: nomeCandidato.trim(),
        cargo,
        uf,
        partido: partido.trim() || null,
        numero_candidato: numeroCandidato.trim() || null,
        nome_urna: nomeUrna.trim() || null,
        cnpj_campanha: cnpjCampanha.trim() || null,
        coligacao: coligacao.trim() || null,
        voz_candidato: vozCandidato.trim() || null,
      })
      .eq("id", dados.campanhaId);

    setCarregando(false);
    if (error) {
      setErro(error.message);
      return;
    }
    setSucesso(true);
    setTimeout(() => setSucesso(false), 3000);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded border border-neutral-200 p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1 sm:col-span-2">
          <label className="block text-xs font-medium text-neutral-500">Nome completo do candidato</label>
          <input
            required
            value={nomeCandidato}
            onChange={(e) => setNomeCandidato(e.target.value)}
            className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-medium text-neutral-500">Nome de urna</label>
          <input
            placeholder="Ex.: JOÃO SILVA"
            value={nomeUrna}
            onChange={(e) => setNomeUrna(e.target.value)}
            className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-medium text-neutral-500">Número do candidato</label>
          <input
            placeholder="Ex.: 45"
            value={numeroCandidato}
            onChange={(e) => setNumeroCandidato(e.target.value)}
            className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-medium text-neutral-500">Cargo</label>
          <select
            value={cargo}
            onChange={(e) => setCargo(e.target.value)}
            className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
          >
            {CARGOS.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-medium text-neutral-500">UF</label>
          <select
            value={uf}
            onChange={(e) => setUf(e.target.value)}
            className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
          >
            {UFS.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-medium text-neutral-500">Partido</label>
          <select
            value={partido}
            onChange={(e) => setPartido(e.target.value)}
            className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
          >
            <option value="">Selecione</option>
            {PARTIDOS.map((p) => (
              <option key={p.numero} value={p.sigla}>{p.numero} - {p.sigla}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-medium text-neutral-500">CNPJ da campanha</label>
          <input
            placeholder="00.000.000/0001-00"
            value={cnpjCampanha}
            onChange={(e) => setCnpjCampanha(e.target.value)}
            className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
          />
        </div>

        <div className="space-y-1 sm:col-span-2">
          <label className="block text-xs font-medium text-neutral-500">Coligação / federação</label>
          <input
            placeholder="Ex.: Federação Brasil da Esperança"
            value={coligacao}
            onChange={(e) => setColigacao(e.target.value)}
            className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
          />
        </div>

        <div className="space-y-1 sm:col-span-2">
          <label className="block text-xs font-medium text-neutral-500">
            Voz do candidato{" "}
            <span className="font-normal text-neutral-400">(opcional — melhora a humanização dos textos)</span>
          </label>
          <textarea
            rows={6}
            placeholder={"Cole aqui trechos de falas reais do candidato: entrevistas, debates, lives, conversas.\nA IA vai usar como referência de estilo — expressões, ritmo, jeito de falar.\nQuantos mais exemplos, melhor o resultado."}
            value={vozCandidato}
            onChange={(e) => setVozCandidato(e.target.value)}
            className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
          />
          <p className="text-xs text-neutral-400">
            Transcreva falas reais — entrevistas, debates, lives. A IA usa como referência
            para escrever no estilo do candidato, tornando os textos mais naturais e menos detectáveis como IA.
          </p>
        </div>
      </div>

      {erro && <p className="text-sm text-red-600">{erro}</p>}
      {sucesso && (
        <p className="flex items-center gap-1 text-sm text-green-700">
          <Check size={14} strokeWidth={2} aria-hidden="true" />
          Dados da campanha atualizados.
        </p>
      )}

      <button
        type="submit"
        disabled={carregando}
        className="rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
      >
        {carregando ? "Salvando…" : "Salvar dados da campanha"}
      </button>
    </form>
  );
}
