import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createClient } from "@/lib/supabase/server";
import {
  SISTEMA_ADAPTADOR_MENSAGEM,
  montarContextoConhecimento,
  type TemaComItens,
} from "@/lib/anthropic";
import { criarClienteIA } from "@/lib/ia-client";

type PedidoAdaptacao = { publico_alvo: string; canal: string };

const LIMITE_MENSAGEM = 4000;
const LIMITE_ADAPTACOES = 6;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "body inválido" }, { status: 400 });
  }

  const mensagem_central = typeof body.mensagem_central === "string" ? body.mensagem_central.trim() : "";
  const adaptacoesInput = Array.isArray(body.adaptacoes) ? body.adaptacoes : [];

  if (!mensagem_central) {
    return NextResponse.json({ error: "mensagem_central é obrigatória" }, { status: 400 });
  }
  if (mensagem_central.length > LIMITE_MENSAGEM) {
    return NextResponse.json(
      { error: `mensagem_central excede ${LIMITE_MENSAGEM} caracteres` },
      { status: 400 }
    );
  }
  if (adaptacoesInput.length === 0) {
    return NextResponse.json({ error: "informe ao menos uma adaptação" }, { status: 400 });
  }
  if (adaptacoesInput.length > LIMITE_ADAPTACOES) {
    return NextResponse.json(
      { error: `no máximo ${LIMITE_ADAPTACOES} adaptações por vez` },
      { status: 400 }
    );
  }

  const adaptacoes: PedidoAdaptacao[] = [];
  for (const a of adaptacoesInput) {
    const publico = typeof a?.publico_alvo === "string" ? a.publico_alvo.trim() : "";
    const canal = typeof a?.canal === "string" ? a.canal.trim() : "";
    if (!publico || !canal) {
      return NextResponse.json(
        { error: "cada adaptação precisa de público_alvo e canal" },
        { status: 400 }
      );
    }
    if (publico.length > 80 || canal.length > 80) {
      return NextResponse.json(
        { error: "público_alvo e canal são limitados a 80 caracteres" },
        { status: 400 }
      );
    }
    adaptacoes.push({ publico_alvo: publico, canal });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  }

  const { data: eu } = await supabase
    .from("usuarios_internos")
    .select(
      "campanha_id, campanhas(nome_candidato, cargo, uf, partido, numero_candidato, nome_urna, cnpj_campanha, coligacao)"
    )
    .eq("id", user.id)
    .maybeSingle();

  if (!eu) {
    return NextResponse.json({ error: "usuário sem vínculo de campanha" }, { status: 403 });
  }

  const { data: podeIa } = await supabase.rpc("has_permission", { p: "usar_ia" });
  if (!podeIa) {
    return NextResponse.json(
      { error: "sua função não tem permissão para adaptar mensagens (usar_ia)" },
      { status: 403 }
    );
  }

  const ia = await criarClienteIA(supabase);
  if (!ia) {
    return NextResponse.json(
      { error: "Nenhuma chave de IA configurada. Vá em Cadastro de Campanha > Chaves de API." },
      { status: 400 }
    );
  }

  const { data: temasDb } = await supabase
    .from("temas_campanha")
    .select("id, nome, publicos_alvo, regioes_prioritarias, base_conhecimento_itens(titulo, descricao)")
    .order("ordem")
    .limit(30);

  const temasCtx: TemaComItens[] = (temasDb ?? []).map((t) => ({
    nome: t.nome,
    publicos_alvo: t.publicos_alvo ?? [],
    regioes_prioritarias: t.regioes_prioritarias ?? [],
    itens: (Array.isArray(t.base_conhecimento_itens) ? t.base_conhecimento_itens : []) as { titulo: string; descricao: string | null }[],
  }));

  const campanha = Array.isArray(eu.campanhas) ? eu.campanhas[0] : eu.campanhas;

  const identidade = [
    `Candidato: ${campanha?.nome_candidato ?? "–"}`,
    `Nome de urna: ${campanha?.nome_urna ?? "–"}`,
    `Número: ${campanha?.numero_candidato ?? "–"}`,
    `Cargo: ${campanha?.cargo ?? "–"} – ${campanha?.uf ?? "–"}`,
    `Partido: ${campanha?.partido ?? "–"}`,
    `Coligação: ${campanha?.coligacao ?? "–"}`,
  ].join("\n");

  const conhecimento = montarContextoConhecimento(temasCtx);

  const contextoBase = [
    `IDENTIDADE DA CAMPANHA:\n${identidade}`,
    conhecimento ? `BASE DE CONHECIMENTO DA CAMPANHA (público-alvo e regiões por tema):\n${conhecimento}` : "",
    `MENSAGEM CENTRAL A ADAPTAR:\n${mensagem_central}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const resultados = await Promise.all(
    adaptacoes.map(async (a): Promise<{ pedido: PedidoAdaptacao; variacao?: string; erro?: string }> => {
      const pedidoTxt = `PÚBLICO-ALVO: ${a.publico_alvo}\nCANAL: ${a.canal}\n\nProduza a variação adaptada.`;
      try {
        const texto = await ia.gerar({
          sistema: SISTEMA_ADAPTADOR_MENSAGEM,
          mensagens: [{ role: "user", content: `${contextoBase}\n\n${pedidoTxt}` }],
          maxTokens: 1200,
        });
        if (!texto) return { pedido: a, erro: "resposta vazia da IA" };
        return { pedido: a, variacao: texto };
      } catch (err) {
        const emsg = err instanceof Error ? err.message : "erro desconhecido";
        return { pedido: a, erro: emsg };
      }
    })
  );

  const lote_id = randomUUID();

  const linhasParaInserir = resultados
    .filter((r) => r.variacao)
    .map((r) => ({
      campanha_id: eu.campanha_id,
      lote_id,
      mensagem_central,
      publico_alvo: r.pedido.publico_alvo,
      canal: r.pedido.canal,
      variacao: r.variacao!,
      modelo_ia: ia.provedor,
      solicitado_por: user.id,
    }));

  let inseridas: { id: string; publico_alvo: string; canal: string; variacao: string; created_at: string }[] = [];
  if (linhasParaInserir.length > 0) {
    const { data: rows, error } = await supabase
      .from("adaptacoes_mensagem")
      .insert(linhasParaInserir)
      .select("id, publico_alvo, canal, variacao, created_at");
    if (error) {
      return NextResponse.json({ error: `Falha ao salvar variações: ${error.message}` }, { status: 400 });
    }
    inseridas = rows ?? [];
  }

  const falhas = resultados
    .filter((r) => r.erro)
    .map((r) => ({ publico_alvo: r.pedido.publico_alvo, canal: r.pedido.canal, erro: r.erro }));

  return NextResponse.json({ lote_id, variacoes: inseridas, falhas });
}
