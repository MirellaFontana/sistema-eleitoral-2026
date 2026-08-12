"use client";

import { useEffect, useState, useCallback } from "react";
import { Save, CheckCircle, AlertTriangle, Plus, Trash2, History, ChevronDown, Sparkles } from "lucide-react";

type Tema = { id: string; nome: string };
type MensagemMae = { tema: string; mensagem: string; adaptacoes: string };
type Posicao = {
  id: string;
  tema_id: string | null;
  tema_livre: string | null;
  posicao: string;
  evidencias: string | null;
  status: string;
  temas_campanha: { nome: string } | null;
};
type HistoricoItem = {
  id: string;
  versao: number;
  alteracao: string | null;
  created_at: string;
};
type Diretriz = {
  id: string;
  versao: number;
  status: string;
  identidade: string | null;
  valores: string | null;
  vocabulario_preferido: string[];
  vocabulario_proibido: string[];
  assuntos_sensiveis: string[];
  limites: string | null;
  mensagens_mae: MensagemMae[];
};

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  rascunho: { label: "Rascunho", cls: "bg-amber-100 text-amber-800" },
  em_revisao: { label: "Em revisão", cls: "bg-blue-100 text-blue-800" },
  aprovada: { label: "Aprovada", cls: "bg-emerald-100 text-emerald-800" },
};

const POSICAO_STATUS: Record<string, { label: string; cls: string }> = {
  definida: { label: "Definida", cls: "bg-emerald-100 text-emerald-800" },
  sem_definicao: { label: "Sem Definição", cls: "bg-red-100 text-red-800" },
  em_revisao: { label: "Em revisão", cls: "bg-blue-100 text-blue-800" },
};

function TagInput({
  label,
  tags,
  onChange,
  disabled,
  placeholder,
}: {
  label: string;
  tags: string[];
  onChange: (t: string[]) => void;
  disabled: boolean;
  placeholder?: string;
}) {
  const [input, setInput] = useState("");

  function adicionar() {
    const v = input.trim();
    if (!v || tags.includes(v)) return;
    onChange([...tags, v]);
    setInput("");
  }

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-neutral-500">{label}</label>
      <div className="flex flex-wrap gap-1.5">
        {tags.map((t, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-1 rounded bg-neutral-100 px-2 py-0.5 text-xs"
          >
            {t}
            {!disabled && (
              <button
                onClick={() => onChange(tags.filter((_, j) => j !== i))}
                className="text-neutral-400 hover:text-red-600"
              >
                ×
              </button>
            )}
          </span>
        ))}
      </div>
      {!disabled && (
        <div className="flex gap-1.5">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), adicionar())}
            placeholder={placeholder}
            className="flex-1 rounded border border-neutral-200 px-2 py-1 text-sm"
          />
          <button
            onClick={adicionar}
            className="rounded bg-neutral-100 px-2 py-1 text-xs font-medium hover:bg-neutral-200"
          >
            +
          </button>
        </div>
      )}
    </div>
  );
}

export function DiretrizesEditor({
  temas,
  podeEditar,
}: {
  temas: Tema[];
  podeEditar: boolean;
}) {
  const [diretriz, setDiretriz] = useState<Diretriz | null>(null);
  const [posicoes, setPosicoes] = useState<Posicao[]>([]);
  const [historico, setHistorico] = useState<HistoricoItem[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [aprovando, setAprovando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [historicoAberto, setHistoricoAberto] = useState(false);

  // Form state
  const [identidade, setIdentidade] = useState("");
  const [valores, setValores] = useState("");
  const [vocabPreferido, setVocabPreferido] = useState<string[]>([]);
  const [vocabProibido, setVocabProibido] = useState<string[]>([]);
  const [sensiveis, setSensiveis] = useState<string[]>([]);
  const [limites, setLimites] = useState("");
  const [feitosMandatos, setFeitosMandatos] = useState("");
  const [mensagensMae, setMensagensMae] = useState<MensagemMae[]>([]);

  // Nova posição
  const [novaPosicaoAberta, setNovaPosicaoAberta] = useState(false);
  const [novaTemaId, setNovaTemaId] = useState("");
  const [novaTemaLivre, setNovaTemaLivre] = useState("");
  const [novaPosicao, setNovaPosicao] = useState("");
  const [novaEvidencia, setNovaEvidencia] = useState("");
  const [novoStatus, setNovoStatus] = useState("definida");

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const res = await fetch("/api/diretrizes");
      const data = await res.json();
      if (data.diretriz) {
        const d = data.diretriz;
        setDiretriz(d);
        setIdentidade(d.identidade ?? "");
        setValores(d.valores ?? "");
        setVocabPreferido(d.vocabulario_preferido ?? []);
        setVocabProibido(d.vocabulario_proibido ?? []);
        setSensiveis(d.assuntos_sensiveis ?? []);
        setLimites(d.limites ?? "");
        setFeitosMandatos(d.feitos_mandatos_anteriores ?? "");
        setMensagensMae(d.mensagens_mae ?? []);
      }
      setPosicoes(data.posicoes ?? []);
      setHistorico(data.historico ?? []);
    } catch {
      setErro("Falha ao carregar diretrizes.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  function flash(msg: string) {
    setSucesso(msg);
    setTimeout(() => setSucesso(null), 3000);
  }

  async function salvar() {
    setSalvando(true);
    setErro(null);
    try {
      const res = await fetch("/api/diretrizes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identidade, valores,
          vocabulario_preferido: vocabPreferido,
          vocabulario_proibido: vocabProibido,
          assuntos_sensiveis: sensiveis,
          limites,
          feitos_mandatos_anteriores: feitosMandatos,
          mensagens_mae: mensagensMae,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setErro(data.error); return; }
      flash("Diretrizes salvas");
      carregar();
    } catch {
      setErro("Falha ao salvar.");
    } finally {
      setSalvando(false);
    }
  }

  async function aprovar() {
    setAprovando(true);
    setErro(null);
    try {
      const res = await fetch("/api/diretrizes/aprovar", { method: "POST" });
      const data = await res.json();
      if (!res.ok) { setErro(data.error); return; }
      flash(`Aprovada — versão ${data.versao}`);
      carregar();
    } catch {
      setErro("Falha ao aprovar.");
    } finally {
      setAprovando(false);
    }
  }

  async function adicionarPosicao() {
    setErro(null);
    const res = await fetch("/api/diretrizes/posicoes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tema_id: novaTemaId || null,
        tema_livre: novaTemaLivre || null,
        posicao: novaPosicao,
        evidencias: novaEvidencia || null,
        status: novoStatus,
      }),
    });
    const data = await res.json();
    if (!res.ok) { setErro(data.error); return; }
    setNovaPosicaoAberta(false);
    setNovaTemaId("");
    setNovaTemaLivre("");
    setNovaPosicao("");
    setNovaEvidencia("");
    setNovoStatus("definida");
    flash("Posição adicionada");
    carregar();
  }

  async function removerPosicao(id: string) {
    await fetch(`/api/diretrizes/posicoes?id=${id}`, { method: "DELETE" });
    carregar();
  }

  function adicionarMensagemMae() {
    setMensagensMae([...mensagensMae, { tema: "", mensagem: "", adaptacoes: "" }]);
  }

  function atualizarMensagemMae(idx: number, campo: keyof MensagemMae, valor: string) {
    setMensagensMae(mensagensMae.map((m, i) => (i === idx ? { ...m, [campo]: valor } : m)));
  }

  function removerMensagemMae(idx: number) {
    setMensagensMae(mensagensMae.filter((_, i) => i !== idx));
  }

  const [onboardingAberto, setOnboardingAberto] = useState(false);
  const [onbNome, setOnbNome] = useState("");
  const [onbCargo, setOnbCargo] = useState("");
  const [onbPartido, setOnbPartido] = useState("");
  const [onbCidade, setOnbCidade] = useState("");
  const [onbBiografia, setOnbBiografia] = useState("");
  const [onbTemas, setOnbTemas] = useState("");
  const [onbGerando, setOnbGerando] = useState(false);

  async function gerarOnboarding() {
    if (!onbNome.trim() || !onbCargo.trim()) return;
    setOnbGerando(true);
    setErro(null);
    try {
      const res = await fetch("/api/diretrizes/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: onbNome.trim(),
          cargo: onbCargo.trim(),
          partido: onbPartido.trim() || undefined,
          cidade: onbCidade.trim() || undefined,
          biografia: onbBiografia.trim() || undefined,
          temas_prioritarios: onbTemas.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setErro(data.error); return; }
      const r = data.rascunho;
      if (r.identidade) setIdentidade(r.identidade);
      if (r.valores) setValores(r.valores);
      if (r.vocabulario_preferido) setVocabPreferido(r.vocabulario_preferido);
      if (r.vocabulario_proibido) setVocabProibido(r.vocabulario_proibido);
      if (r.assuntos_sensiveis) setSensiveis(r.assuntos_sensiveis);
      if (r.limites) setLimites(r.limites);
      if (r.mensagens_mae) setMensagensMae(r.mensagens_mae);
      setOnboardingAberto(false);
      flash("Rascunho gerado pela IA — revise e salve");
    } catch {
      setErro("Falha ao gerar rascunho.");
    } finally {
      setOnbGerando(false);
    }
  }

  if (carregando) return <p className="text-sm text-neutral-400">Carregando diretrizes…</p>;

  const diretrizVazia = !diretriz || (!diretriz.identidade && !diretriz.valores && diretriz.mensagens_mae.length === 0);
  const statusInfo = STATUS_BADGE[diretriz?.status ?? "rascunho"] ?? STATUS_BADGE.rascunho;
  const temasComPosicao = new Set(posicoes.filter((p) => p.tema_id).map((p) => p.tema_id));
  const TEMAS_REFERENCIA = new Set(["Código Eleitoral"]);
  const temasSemPosicao = temas.filter((t) => !temasComPosicao.has(t.id) && !TEMAS_REFERENCIA.has(t.nome));

  return (
    <div className="space-y-8">
      {/* Status bar */}
      <div className="flex items-center gap-3">
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusInfo.cls}`}>
          {statusInfo.label}
        </span>
        {diretriz && (
          <span className="text-xs text-neutral-400">v{diretriz.versao}</span>
        )}
        {podeEditar && diretriz && diretriz.status !== "aprovada" && (
          <button
            onClick={aprovar}
            disabled={aprovando}
            className="ml-auto flex items-center gap-1 rounded bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            <CheckCircle size={13} />
            {aprovando ? "Aprovando…" : "Aprovar diretrizes"}
          </button>
        )}
      </div>

      {erro && <p className="text-sm text-red-600">{erro}</p>}
      {sucesso && <p className="text-sm text-emerald-600">{sucesso}</p>}

      {/* Onboarding IA */}
      {podeEditar && diretrizVazia && !onboardingAberto && (
        <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4">
          <div className="flex items-start gap-3">
            <Sparkles size={18} className="mt-0.5 shrink-0 text-indigo-600" />
            <div>
              <p className="text-sm font-medium text-indigo-900">Configure suas diretrizes com ajuda da IA</p>
              <p className="mt-0.5 text-xs text-indigo-700">
                Responda algumas perguntas sobre o candidato e a IA gerará um rascunho completo para você revisar.
              </p>
              <button
                onClick={() => setOnboardingAberto(true)}
                className="mt-2 rounded bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
              >
                Iniciar onboarding
              </button>
            </div>
          </div>
        </div>
      )}

      {onboardingAberto && (
        <div className="space-y-3 rounded-lg border border-indigo-200 bg-indigo-50/50 p-4">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-indigo-600" />
            <h3 className="text-sm font-semibold text-indigo-900">Onboarding assistido por IA</h3>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <input value={onbNome} onChange={(e) => setOnbNome(e.target.value)} placeholder="Nome do candidato *" className="rounded border border-neutral-300 px-3 py-1.5 text-sm" required />
            <input value={onbCargo} onChange={(e) => setOnbCargo(e.target.value)} placeholder="Cargo pretendido * (ex.: Prefeito)" className="rounded border border-neutral-300 px-3 py-1.5 text-sm" required />
            <input value={onbPartido} onChange={(e) => setOnbPartido(e.target.value)} placeholder="Partido (opcional)" className="rounded border border-neutral-300 px-3 py-1.5 text-sm" />
            <input value={onbCidade} onChange={(e) => setOnbCidade(e.target.value)} placeholder="Cidade / região (opcional)" className="rounded border border-neutral-300 px-3 py-1.5 text-sm" />
          </div>
          <textarea value={onbBiografia} onChange={(e) => setOnbBiografia(e.target.value)} placeholder="Breve biografia e trajetória do candidato (opcional)" rows={3} className="w-full rounded border border-neutral-300 px-3 py-1.5 text-sm" />
          <input value={onbTemas} onChange={(e) => setOnbTemas(e.target.value)} placeholder="Temas prioritários separados por vírgula (ex.: saúde, educação, segurança)" className="w-full rounded border border-neutral-300 px-3 py-1.5 text-sm" />
          <div className="flex gap-2">
            <button
              onClick={gerarOnboarding}
              disabled={onbGerando || !onbNome.trim() || !onbCargo.trim()}
              className="flex items-center gap-1.5 rounded bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              <Sparkles size={13} />
              {onbGerando ? "Gerando rascunho…" : "Gerar diretrizes"}
            </button>
            <button onClick={() => setOnboardingAberto(false)} className="text-xs text-neutral-500 hover:text-neutral-700">
              Cancelar
            </button>
          </div>
          {onbGerando && <p className="text-xs text-indigo-600">A IA está analisando as informações e gerando o rascunho. Isso pode levar alguns segundos…</p>}
        </div>
      )}

      {/* Alerta: temas sem posição */}
      {temasSemPosicao.length > 0 && (
        <div className="flex items-start gap-2 rounded border border-amber-200 bg-amber-50 p-3">
          <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-600" />
          <div>
            <p className="text-xs font-medium text-amber-800">Diretrizes sem Definição</p>
            <p className="text-xs text-amber-700">
              {temasSemPosicao.length} {temasSemPosicao.length === 1 ? "tema" : "temas"} da base de
              conhecimento sem posição definida:{" "}
              {temasSemPosicao.map((t) => t.nome).join(", ")}
            </p>
          </div>
        </div>
      )}

      {/* Identidade */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Identidade, biografia e trajetória
        </h2>
        <textarea
          value={identidade}
          onChange={(e) => setIdentidade(e.target.value)}
          disabled={!podeEditar}
          rows={4}
          placeholder="Quem é o candidato, sua trajetória, experiência e história…"
          className="w-full rounded border border-neutral-200 px-3 py-2 text-sm disabled:bg-neutral-50"
        />
      </section>

      {/* Valores */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Valores, causas e compromissos
        </h2>
        <textarea
          value={valores}
          onChange={(e) => setValores(e.target.value)}
          disabled={!podeEditar}
          rows={4}
          placeholder="Valores fundamentais, causas defendidas, compromissos públicos…"
          className="w-full rounded border border-neutral-200 px-3 py-2 text-sm disabled:bg-neutral-50"
        />
      </section>

      {/* Vocabulário */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Vocabulário e tom
        </h2>
        <TagInput
          label="Termos preferidos (usar)"
          tags={vocabPreferido}
          onChange={setVocabPreferido}
          disabled={!podeEditar}
          placeholder="Ex.: cidadão, comunidade, transformar…"
        />
        <TagInput
          label="Termos proibidos (nunca usar)"
          tags={vocabProibido}
          onChange={setVocabProibido}
          disabled={!podeEditar}
          placeholder="Ex.: inimigo, destruir, guerra…"
        />
      </section>

      {/* Assuntos sensíveis e limites */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Assuntos sensíveis e limites
        </h2>
        <TagInput
          label="Assuntos que exigem cuidado"
          tags={sensiveis}
          onChange={setSensiveis}
          disabled={!podeEditar}
          placeholder="Ex.: religião, aborto, armas…"
        />
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-neutral-500">
            Limites (o que nunca fazer ou dizer)
          </label>
          <textarea
            value={limites}
            onChange={(e) => setLimites(e.target.value)}
            disabled={!podeEditar}
            rows={3}
            placeholder="Ex.: nunca atacar pessoalmente outro candidato, nunca prometer cargos…"
            className="w-full rounded border border-neutral-200 px-3 py-2 text-sm disabled:bg-neutral-50"
          />
        </div>
      </section>

      {/* Feitos de mandatos anteriores */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Feitos de mandatos anteriores
        </h2>
        <textarea
          value={feitosMandatos}
          onChange={(e) => setFeitosMandatos(e.target.value)}
          disabled={!podeEditar}
          rows={5}
          placeholder="Realizações e conquistas de mandatos anteriores do candidato: obras, projetos, leis aprovadas, emendas destinadas, programas implementados…"
          className="w-full rounded border border-neutral-200 px-3 py-2 text-sm disabled:bg-neutral-50"
        />
      </section>

      {/* Mensagens-mãe */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Mensagens-mãe
          </h2>
          {podeEditar && (
            <button
              onClick={adicionarMensagemMae}
              className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800"
            >
              <Plus size={13} /> Adicionar
            </button>
          )}
        </div>
        {mensagensMae.length === 0 && (
          <p className="text-xs text-neutral-400">
            Nenhuma mensagem-mãe cadastrada. São as frases-chave que podem ser adaptadas por contexto.
          </p>
        )}
        {mensagensMae.map((m, i) => (
          <div key={i} className="space-y-1.5 rounded border border-neutral-200 p-3">
            <div className="flex items-center gap-2">
              <input
                value={m.tema}
                onChange={(e) => atualizarMensagemMae(i, "tema", e.target.value)}
                disabled={!podeEditar}
                placeholder="Tema (ex.: Saúde)"
                className="flex-1 rounded border border-neutral-200 px-2 py-1 text-sm"
              />
              {podeEditar && (
                <button onClick={() => removerMensagemMae(i)} className="text-neutral-400 hover:text-red-600">
                  <Trash2 size={13} />
                </button>
              )}
            </div>
            <textarea
              value={m.mensagem}
              onChange={(e) => atualizarMensagemMae(i, "mensagem", e.target.value)}
              disabled={!podeEditar}
              rows={2}
              placeholder="A mensagem-mãe…"
              className="w-full rounded border border-neutral-200 px-2 py-1 text-sm"
            />
            <input
              value={m.adaptacoes}
              onChange={(e) => atualizarMensagemMae(i, "adaptacoes", e.target.value)}
              disabled={!podeEditar}
              placeholder="Adaptações permitidas por contexto (ex.: simplificar para redes, expandir para debate)"
              className="w-full rounded border border-neutral-200 px-2 py-1 text-xs"
            />
          </div>
        ))}
      </section>

      {/* Posições por tema */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Posições aprovadas por tema
          </h2>
          {podeEditar && (
            <button
              onClick={() => setNovaPosicaoAberta(!novaPosicaoAberta)}
              className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800"
            >
              <Plus size={13} /> Adicionar posição
            </button>
          )}
        </div>

        {/* Form nova posição */}
        {novaPosicaoAberta && (
          <div className="space-y-2 rounded border border-indigo-200 bg-indigo-50/50 p-3">
            <div className="flex gap-2">
              <select
                value={novaTemaId}
                onChange={(e) => { setNovaTemaId(e.target.value); if (e.target.value) setNovaTemaLivre(""); }}
                className="flex-1 rounded border border-neutral-200 px-2 py-1 text-sm"
              >
                <option value="">Tema livre</option>
                {temas.map((t) => (
                  <option key={t.id} value={t.id}>{t.nome}</option>
                ))}
              </select>
              {!novaTemaId && (
                <input
                  value={novaTemaLivre}
                  onChange={(e) => setNovaTemaLivre(e.target.value)}
                  placeholder="Nome do tema"
                  className="flex-1 rounded border border-neutral-200 px-2 py-1 text-sm"
                />
              )}
            </div>
            <textarea
              value={novaPosicao}
              onChange={(e) => setNovaPosicao(e.target.value)}
              rows={2}
              placeholder="Posição aprovada para este tema…"
              className="w-full rounded border border-neutral-200 px-2 py-1 text-sm"
            />
            <textarea
              value={novaEvidencia}
              onChange={(e) => setNovaEvidencia(e.target.value)}
              rows={2}
              placeholder="Evidências e provas de credibilidade (opcional)"
              className="w-full rounded border border-neutral-200 px-2 py-1 text-sm"
            />
            <div className="flex items-center gap-2">
              <select
                value={novoStatus}
                onChange={(e) => setNovoStatus(e.target.value)}
                className="rounded border border-neutral-200 px-2 py-1 text-xs"
              >
                <option value="definida">Definida</option>
                <option value="sem_definicao">Sem Definição</option>
                <option value="em_revisao">Em revisão</option>
              </select>
              <button
                onClick={adicionarPosicao}
                disabled={!novaPosicao.trim()}
                className="rounded bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                Adicionar
              </button>
              <button
                onClick={() => setNovaPosicaoAberta(false)}
                className="text-xs text-neutral-500 hover:text-neutral-700"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {posicoes.length === 0 && !novaPosicaoAberta && (
          <p className="text-xs text-neutral-400">Nenhuma posição cadastrada.</p>
        )}

        {posicoes.map((p) => {
          const st = POSICAO_STATUS[p.status] ?? POSICAO_STATUS.definida;
          const nomeTema =
            p.temas_campanha?.nome ?? p.tema_livre ?? "Tema livre";
          return (
            <div key={p.id} className="space-y-1 rounded border border-neutral-200 p-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{nomeTema}</span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${st.cls}`}>
                  {st.label}
                </span>
                {podeEditar && (
                  <button
                    onClick={() => removerPosicao(p.id)}
                    className="ml-auto text-neutral-400 hover:text-red-600"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
              <p className="text-sm text-neutral-700">{p.posicao}</p>
              {p.evidencias && (
                <p className="text-xs text-neutral-500">
                  <span className="font-medium">Evidências:</span> {p.evidencias}
                </p>
              )}
            </div>
          );
        })}
      </section>

      {/* Salvar */}
      {podeEditar && (
        <div className="flex gap-3 border-t border-neutral-200 pt-4">
          <button
            onClick={salvar}
            disabled={salvando}
            className="flex items-center gap-1.5 rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            <Save size={14} />
            {salvando ? "Salvando…" : "Salvar diretrizes"}
          </button>
        </div>
      )}

      {/* Histórico */}
      {historico.length > 0 && (
        <section className="space-y-2">
          <button
            onClick={() => setHistoricoAberto(!historicoAberto)}
            className="flex items-center gap-1 text-sm font-semibold uppercase tracking-wide text-neutral-500"
          >
            <History size={14} />
            Histórico de versões
            <ChevronDown size={14} className={`transition-transform ${historicoAberto ? "rotate-180" : ""}`} />
          </button>
          {historicoAberto && (
            <ul className="space-y-1.5">
              {historico.map((h) => (
                <li key={h.id} className="rounded border border-neutral-100 bg-neutral-50 p-2 text-xs">
                  <span className="font-medium">v{h.versao}</span>
                  {" — "}
                  {h.alteracao ?? "Snapshot salvo"}
                  <span className="ml-2 text-neutral-400">
                    {new Date(h.created_at).toLocaleDateString("pt-BR")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
