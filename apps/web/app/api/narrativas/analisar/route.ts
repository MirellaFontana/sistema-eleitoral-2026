import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { criarClienteIA, respostaErroIA } from "@/lib/ia-client";
import { montarContextoConhecimento, type TemaComItens } from "@/lib/anthropic";
import { parseJsonSeguro } from "@/lib/parse-json-seguro";
import { obterContextoDiretrizes } from "@/lib/diretrizes-context";

const PAPEIS_ANALISAM = new Set(["coord_campanha", "candidato", "coord_marketing"]);

const SISTEMA = `Você é analista sênior de inteligência narrativa para campanha eleitoral brasileira.
Analise os dados fornecidos e produza uma COMPARAÇÃO DE NARRATIVAS entre a campanha e os concorrentes.

Responda APENAS um JSON válido com esta estrutura, sem markdown:
{
  "resumo": "resumo executivo de 3-5 frases sobre o cenário narrativo geral",
  "temas": [
    {
      "tema": "nome do tema",
      "narrativa_propria": {
        "posicao": "posição da campanha sobre o tema (das diretrizes)",
        "clareza": "alta|media|baixa",
        "presenca": "alta|media|baixa",
        "evidencias": "que evidências sustentam a narrativa (dados, propostas, ações)"
      },
      "narrativas_concorrentes": [
        {
          "concorrente": "nome",
          "posicao": "posição ou promessa do concorrente",
          "ressonancia": "alta|media|baixa",
          "sinais": "quais sinais públicos indicam ressonância (menções, demandas, cobertura)"
        }
      ],
      "ressonancia_propria": {
        "nivel": "alta|media|baixa",
        "sinais": "de onde vem a leitura (menções, demandas de campo, alertas, cobertura)"
      },
      "lacunas": ["onde a narrativa própria precisa de clareza, evidência ou presença"],
      "oportunidades": ["oportunidades de reforçar propostas sem copiar ou reagir"],
      "perguntas_recorrentes": ["perguntas e objeções que aparecem nos dados"],
      "consistencia": "alta|media|baixa — coerência entre canais/territórios/períodos"
    }
  ]
}

Regras:
- Analise TODOS os temas da campanha, mesmo os sem posição definida.
- Baseie-se APENAS nos dados fornecidos. Nunca invente fatos.
- Ressonância = leitura combinada de alcance, engajamento, imprensa, demandas, escuta de campo, perguntas e reações. NÃO é intenção de voto.
- Se um tema não tem dados suficientes, indique clareza/presença/ressonância como "baixa" e explique nos sinais.
- Identifique OPORTUNIDADES concretas, não apenas observações.
- Use apenas dados públicos e sinais legítimos.`;

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  const limited = checkRateLimit(user.id);
  if (limited) return limited;

  const { data: eu } = await supabase
    .from("usuarios_internos")
    .select("papel, campanha_id, campanhas(nome_candidato)")
    .eq("id", user.id)
    .maybeSingle();
  if (!eu) return NextResponse.json({ error: "sem campanha" }, { status: 403 });
  if (!PAPEIS_ANALISAM.has(eu.papel))
    return NextResponse.json({ error: "sem permissão" }, { status: 403 });

  const ia = await criarClienteIA(supabase);
  if (!ia)
    return NextResponse.json({ error: "Nenhuma chave de IA configurada." }, { status: 400 });

  const campanha = Array.isArray(eu.campanhas) ? eu.campanhas[0] : eu.campanhas;

  const [
    temasRes, concorrentesRes, demandasRes, snapshotRes, alertasRes, posicoesRes,
  ] = await Promise.all([
    supabase.from("temas_campanha")
      .select("nome, publicos_alvo, regioes_prioritarias, base_conhecimento_itens(titulo, descricao)")
      .order("ordem").limit(20),
    supabase.from("concorrentes").select("nome, partido, pontos_fortes, pontos_fracos, promessas"),
    supabase.from("demandas_observadas").select("regiao, cidades, tema, demanda")
      .order("created_at", { ascending: false }).limit(40),
    supabase.from("monitoramento_snapshots")
      .select("analise_ia, resultados_brutos, created_at")
      .order("created_at", { ascending: false }).limit(3),
    supabase.from("alertas").select("texto_ia, created_at")
      .order("created_at", { ascending: false }).limit(20),
    supabase.from("diretrizes_posicoes")
      .select("posicao, evidencias, status, tema_livre, temas_campanha(nome)")
      .limit(30),
  ]);

  const temasCtx: TemaComItens[] = (temasRes.data ?? []).map((t) => ({
    nome: t.nome,
    publicos_alvo: t.publicos_alvo ?? [],
    regioes_prioritarias: t.regioes_prioritarias ?? [],
    itens: (Array.isArray(t.base_conhecimento_itens) ? t.base_conhecimento_itens : []) as { titulo: string; descricao: string | null }[],
  }));

  const diretrizes = await obterContextoDiretrizes(supabase, eu.campanha_id);
  const conhecimento = montarContextoConhecimento(temasCtx);

  const concorrentesTxt = (concorrentesRes.data ?? [])
    .map((c) => `- ${c.nome} (${c.partido ?? "?"}): promessas=${c.promessas ?? "?"} | fortes=${c.pontos_fortes ?? "?"} | fracos=${c.pontos_fracos ?? "?"}`)
    .join("\n") || "(nenhum concorrente cadastrado)";

  const demandasTxt = (demandasRes.data ?? [])
    .map((d) => {
      const cidades = Array.isArray(d.cidades) && d.cidades.length > 0 ? d.cidades.join(", ") : "";
      return `- [${d.tema ?? "sem tema"}] ${d.regiao ?? ""} ${cidades}: ${d.demanda}`;
    })
    .join("\n") || "(nenhuma demanda)";

  const snapshots = (snapshotRes.data ?? []).map((s) => {
    const dt = new Date(s.created_at).toLocaleDateString("pt-BR");
    const analise = s.analise_ia ? JSON.stringify(s.analise_ia, null, 0).slice(0, 2000) : "";
    const brutos = Array.isArray(s.resultados_brutos)
      ? (s.resultados_brutos as { titulo?: string; fonte?: string }[]).slice(0, 15).map((r) => `  "${r.titulo ?? "?"}" (${r.fonte ?? "?"})`).join("\n")
      : "";
    return `Snapshot ${dt}:\n${analise}\nMenções:\n${brutos}`;
  }).join("\n\n") || "(sem monitoramento)";

  const alertasTxt = (alertasRes.data ?? [])
    .map((a) => `- ${a.texto_ia ?? "(sem texto)"}`)
    .join("\n") || "(nenhum alerta)";

  const posicoesTxt = (posicoesRes.data ?? []).map((p) => {
    const tema = Array.isArray(p.temas_campanha)
      ? (p.temas_campanha[0] as { nome: string } | undefined)?.nome
      : (p.temas_campanha as { nome: string } | null)?.nome;
    const nome = tema ?? p.tema_livre ?? "?";
    return `- ${nome} [${p.status}]: ${p.posicao ?? "(sem posição)"} | evidências: ${p.evidencias ?? "nenhuma"}`;
  }).join("\n") || "(nenhuma posição definida)";

  const mensagem = [
    `CANDIDATO: ${campanha?.nome_candidato ?? "(não cadastrado)"}`,
    diretrizes || null,
    conhecimento ? `BASE DE CONHECIMENTO:\n${conhecimento}` : null,
    `POSIÇÕES POR TEMA:\n${posicoesTxt}`,
    `CONCORRENTES:\n${concorrentesTxt}`,
    `DEMANDAS DE CAMPO:\n${demandasTxt}`,
    `MONITORAMENTO (últimos snapshots):\n${snapshots}`,
    `ALERTAS RECENTES:\n${alertasTxt}`,
  ].filter(Boolean).join("\n\n");

  let raw: string;
  try {
    raw = await ia.gerar({
      sistema: SISTEMA,
      mensagens: [{ role: "user", content: mensagem }],
      maxTokens: 8000,
      jsonMode: true,
    });
  } catch (err) {
    return respostaErroIA(err);
  }

  const resultado = parseJsonSeguro(raw) as { resumo?: string; temas?: unknown[] } | null;
  if (!resultado) {
    return NextResponse.json({ error: "IA retornou formato inválido", raw: raw.slice(0, 500) }, { status: 502 });
  }

  const { error } = await supabase.from("narrativas_analises").insert({
    campanha_id: eu.campanha_id,
    analise: resultado.temas ?? [],
    resumo: resultado.resumo ?? null,
    provedor_ia: ia.provedor,
    criado_por: user.id,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, resumo: resultado.resumo, temas: resultado.temas?.length ?? 0 });
}
