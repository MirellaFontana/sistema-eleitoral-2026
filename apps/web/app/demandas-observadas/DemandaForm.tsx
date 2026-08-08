"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Mic, Image, FileText, File, X, Paperclip } from "lucide-react";

function iconeAnexo(nome: string) {
  const ext = nome.split(".").pop()?.toLowerCase() ?? "";
  if (["mp3", "wav", "ogg", "webm", "m4a", "aac"].includes(ext)) return <Mic size={12} className="shrink-0" />;
  if (["jpg", "jpeg", "png", "webp", "gif"].includes(ext)) return <Image size={12} className="shrink-0" />;
  if (ext === "pdf") return <FileText size={12} className="shrink-0" />;
  return <File size={12} className="shrink-0" />;
}

type Tema = { id: string; nome: string };

export function DemandaForm({
  campanhaId,
  temas: temasIniciais,
  cidadesConhecidas,
}: {
  campanhaId: string;
  temas: Tema[];
  cidadesConhecidas: string[];
}) {
  const router = useRouter();
  const supabase = createClient();

  const [regiao, setRegiao] = useState("");
  const [cidades, setCidades] = useState<string[]>([]);
  const [cidadeInput, setCidadeInput] = useState("");
  const [mostrarSugestoes, setMostrarSugestoes] = useState(false);
  const [temaId, setTemaId] = useState("");
  const [novoTema, setNovoTema] = useState("");
  const [criandoTema, setCriandoTema] = useState(false);
  const [temas, setTemas] = useState(temasIniciais);
  const [demanda, setDemanda] = useState("");
  const [prazo, setPrazo] = useState("");
  const [palavrasChave, setPalavrasChave] = useState<string[]>([]);
  const [palavraInput, setPalavraInput] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [uploadProgresso, setUploadProgresso] = useState<string | null>(null);
  const [gravando, setGravando] = useState(false);
  const inputCidadeRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputArquivoRef = useRef<HTMLInputElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const reconhecimentoRef = useRef<any>(null);

  async function uploadArquivos(files: File[]): Promise<string[]> {
    const caminhos: string[] = [];
    for (let i = 0; i < files.length; i++) {
      setUploadProgresso(`Enviando ${i + 1} de ${files.length}…`);
      const f = files[i];
      const ext = f.name.split(".").pop() ?? "bin";
      const caminho = `${campanhaId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("demandas-anexos").upload(caminho, f);
      if (error) throw new Error(`Erro ao enviar "${f.name}": ${error.message}`);
      caminhos.push(caminho);
    }
    setUploadProgresso(null);
    return caminhos;
  }

  function toggleDitado() {
    if (gravando) {
      reconhecimentoRef.current?.stop();
      setGravando(false);
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const win = window as any;
    const SR = win.SpeechRecognition ?? win.webkitSpeechRecognition;
    if (!SR) {
      setErro("Ditado não suportado. Use o Chrome.");
      return;
    }
    const r = new SR();
    r.lang = "pt-BR";
    r.continuous = true;
    r.interimResults = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    r.onresult = (e: any) => {
      let trecho = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) trecho += e.results[i][0].transcript + " ";
      }
      if (trecho) setDemanda((prev) => (prev ? prev.trimEnd() + " " + trecho.trimEnd() : trecho.trimEnd()));
    };
    r.onerror = () => setGravando(false);
    r.onend = () => setGravando(false);
    reconhecimentoRef.current = r;
    r.start();
    setGravando(true);
  }

  const sugestoesFiltradas = cidadeInput.trim()
    ? cidadesConhecidas.filter(
        (c) =>
          c.toLowerCase().includes(cidadeInput.trim().toLowerCase()) &&
          !cidades.includes(c)
      )
    : cidadesConhecidas.filter((c) => !cidades.includes(c));

  function adicionarCidade(valor?: string) {
    const limpo = (valor ?? cidadeInput).trim();
    if (!limpo || cidades.includes(limpo)) return;
    setCidades([...cidades, limpo]);
    setCidadeInput("");
    setMostrarSugestoes(false);
    inputCidadeRef.current?.focus();
  }

  function removerCidade(idx: number) {
    setCidades(cidades.filter((_, i) => i !== idx));
  }

  async function criarTema() {
    const nome = novoTema.trim();
    if (!nome) return;
    setCriandoTema(true);
    const { data, error } = await supabase
      .from("temas_campanha")
      .insert({ campanha_id: campanhaId, nome, ordem: temas.length + 1 })
      .select("id, nome")
      .single();
    setCriandoTema(false);
    if (error) {
      setErro(error.message);
      return;
    }
    setTemas([...temas, data]);
    setTemaId(data.id);
    setNovoTema("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setSucesso(null);
    setCarregando(true);

    const temaSelecionado = temas.find((t) => t.id === temaId);

    let anexos: string[] = [];
    if (arquivos.length > 0) {
      try {
        anexos = await uploadArquivos(arquivos);
      } catch (e) {
        setCarregando(false);
        setErro(e instanceof Error ? e.message : "Erro ao enviar arquivos");
        return;
      }
    }

    const cidadesFinais = [...cidades];
    const pendCidade = cidadeInput.trim();
    if (pendCidade && !cidadesFinais.includes(pendCidade)) cidadesFinais.push(pendCidade);

    const palavrasFinais = [...palavrasChave];
    const pendPalavra = palavraInput.trim().toLowerCase();
    if (pendPalavra && !palavrasFinais.includes(pendPalavra)) palavrasFinais.push(pendPalavra);

    const { error } = await supabase.from("demandas_observadas").insert({
      campanha_id: campanhaId,
      regiao: regiao.trim() || null,
      cidades: cidadesFinais.length > 0 ? cidadesFinais : [],
      tema: temaSelecionado?.nome ?? null,
      demanda,
      prazo: prazo || null,
      palavras_chave: palavrasFinais,
      anexos,
    });

    setCarregando(false);
    if (error) {
      setErro(error.message);
      return;
    }

    setSucesso("Demanda registrada.");
    setTimeout(() => setSucesso(null), 3000);
    setRegiao("");
    setCidades([]);
    setCidadeInput("");
    setTemaId("");
    setDemanda("");
    setPrazo("");
    setPalavrasChave([]);
    setPalavraInput("");
    setArquivos([]);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded border border-neutral-200 p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="block text-xs font-medium text-neutral-500">Região</label>
          <input
            value={regiao}
            onChange={(e) => setRegiao(e.target.value)}
            className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-medium text-neutral-500">Cidades</label>
          {cidades.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-1">
              {cidades.map((c, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700"
                >
                  {c}
                  <button
                    type="button"
                    onClick={() => removerCidade(i)}
                    className="text-indigo-400 hover:text-indigo-700"
                  >
                    x
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="relative">
            <input
              ref={inputCidadeRef}
              placeholder="Digite para buscar ou adicionar"
              value={cidadeInput}
              onChange={(e) => {
                setCidadeInput(e.target.value);
                setMostrarSugestoes(true);
              }}
              onFocus={() => setMostrarSugestoes(true)}
              onBlur={() => {
                adicionarCidade();
                setTimeout(() => setMostrarSugestoes(false), 150);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  adicionarCidade();
                }
              }}
              className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
            />
            {mostrarSugestoes && sugestoesFiltradas.length > 0 && (
              <div
                ref={dropdownRef}
                className="absolute left-0 right-0 bottom-full mb-1 z-20 max-h-40 overflow-y-auto rounded border border-neutral-200 bg-white shadow-lg"
              >
                {sugestoesFiltradas.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => adicionarCidade(c)}
                    className="block w-full px-3 py-1.5 text-left text-sm hover:bg-indigo-50 hover:text-indigo-700"
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}
          </div>
          {cidadeInput.trim() &&
            !cidadesConhecidas.some(
              (c) => c.toLowerCase() === cidadeInput.trim().toLowerCase()
            ) && (
              <p className="text-xs text-neutral-400 mt-0.5">
                Enter para adicionar &quot;{cidadeInput.trim()}&quot;
              </p>
            )}
        </div>
      </div>

      <div className="space-y-1">
        <label className="block text-xs font-medium text-neutral-500">Tema</label>
        <select
          value={temaId}
          onChange={(e) => setTemaId(e.target.value)}
          className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
        >
          <option value="">Selecione um tema</option>
          {temas.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nome}
            </option>
          ))}
        </select>
        <div className="flex gap-1 mt-1">
          <input
            placeholder="Ou crie um novo tema"
            value={novoTema}
            onChange={(e) => setNovoTema(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                criarTema();
              }
            }}
            className="rounded border border-neutral-300 px-2 py-1 text-xs w-48"
          />
          <button
            type="button"
            onClick={criarTema}
            disabled={criandoTema || !novoTema.trim()}
            className="rounded bg-neutral-100 px-2 py-1 text-xs text-neutral-600 hover:bg-neutral-200 disabled:opacity-50"
          >
            {criandoTema ? "..." : "+ Criar"}
          </button>
        </div>
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <label className="block text-xs font-medium text-neutral-500">Demanda</label>
          <button
            type="button"
            onClick={toggleDitado}
            title={gravando ? "Parar ditado" : "Ditar demanda por voz"}
            className={`flex items-center gap-1 rounded px-2 py-0.5 text-xs transition-colors ${
              gravando
                ? "animate-pulse bg-red-50 text-red-600"
                : "text-neutral-400 hover:text-neutral-600"
            }`}
          >
            <Mic size={12} />
            {gravando ? "Gravando…" : "Ditar"}
          </button>
        </div>
        <textarea
          required
          rows={3}
          value={demanda}
          onChange={(e) => setDemanda(e.target.value)}
          placeholder={gravando ? "Fale agora…" : undefined}
          className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
        />
      </div>

      <div className="space-y-1">
        <label className="block text-xs font-medium text-neutral-500">Prazo (opcional)</label>
        <input
          type="date"
          value={prazo}
          onChange={(e) => setPrazo(e.target.value)}
          className="w-48 rounded border border-neutral-300 px-2 py-1.5 text-sm"
        />
      </div>

      <div className="space-y-1">
        <label className="block text-xs font-medium text-neutral-500">Palavras-chave (opcional)</label>
        {palavrasChave.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-1">
            {palavrasChave.map((p, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700"
              >
                {p}
                <button
                  type="button"
                  onClick={() => setPalavrasChave(palavrasChave.filter((_, j) => j !== i))}
                  className="text-amber-400 hover:text-amber-700"
                >
                  x
                </button>
              </span>
            ))}
          </div>
        )}
        <input
          placeholder="Digite e pressione Enter para adicionar"
          value={palavraInput}
          onChange={(e) => setPalavraInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              const limpo = palavraInput.trim().toLowerCase();
              if (limpo && !palavrasChave.includes(limpo)) {
                setPalavrasChave([...palavrasChave, limpo]);
              }
              setPalavraInput("");
            }
          }}
          className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
        />
      </div>

      <div className="space-y-1">
        <label className="block text-xs font-medium text-neutral-500">
          Anexos — áudio, fotos ou documentos (opcional)
        </label>
        <input
          ref={inputArquivoRef}
          type="file"
          multiple
          accept="audio/*,image/*,application/pdf,.doc,.docx"
          className="hidden"
          onChange={(e) => {
            const novos = Array.from(e.target.files ?? []);
            setArquivos((prev) => [...prev, ...novos]);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => inputArquivoRef.current?.click()}
          className="flex items-center gap-1.5 rounded border border-dashed border-neutral-300 px-3 py-2 text-xs text-neutral-500 hover:border-indigo-400 hover:text-indigo-600"
        >
          <Paperclip size={13} /> Adicionar arquivo
        </button>
        {arquivos.length > 0 && (
          <ul className="mt-1 space-y-1">
            {arquivos.map((f, i) => (
              <li key={i} className="flex items-center gap-1.5 text-xs text-neutral-600">
                {iconeAnexo(f.name)}
                <span className="truncate max-w-[200px]">{f.name}</span>
                <button
                  type="button"
                  onClick={() => setArquivos(arquivos.filter((_, j) => j !== i))}
                  className="ml-auto text-neutral-400 hover:text-red-500"
                >
                  <X size={12} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {uploadProgresso && <p className="text-xs text-indigo-600">{uploadProgresso}</p>}
      {erro && <p className="text-sm text-red-600">{erro}</p>}
      {sucesso && <p className="text-sm text-green-700">{sucesso}</p>}

      <button
        type="submit"
        disabled={carregando}
        className="rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
      >
        {carregando ? "Salvando…" : "Registrar demanda"}
      </button>
    </form>
  );
}
