import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type FonteSeed = { dominio: string; nome: string; tier: string; regiao: string | null };

const FONTES_PR: FonteSeed[] = [
  // Tier 1: Megafones Estaduais
  { dominio: "g1.globo.com/parana", nome: "G1 Paraná", tier: "tier1_megafone", regiao: "Estadual" },
  { dominio: "gazetadopovo.com.br", nome: "Gazeta do Povo", tier: "tier1_megafone", regiao: "Estadual" },
  { dominio: "bemparana.com.br", nome: "Bem Paraná", tier: "tier1_megafone", regiao: "Curitiba / RMC" },
  { dominio: "tribunapr.com.br", nome: "Tribuna do Paraná", tier: "tier1_megafone", regiao: "Estadual" },
  { dominio: "cgn.inf.br", nome: "CGN", tier: "tier1_megafone", regiao: "Oeste / Cascavel" },
  { dominio: "catve.com", nome: "CatVe", tier: "tier1_megafone", regiao: "Oeste / Cascavel" },
  { dominio: "taroba.com.br", nome: "Tarobá News", tier: "tier1_megafone", regiao: "Londrina / Foz" },
  { dominio: "folhadelondrina.com.br", nome: "Folha de Londrina", tier: "tier1_megafone", regiao: "Norte / Londrina" },

  // Tier 1 (Política): Blogs de Bastidores
  { dominio: "blogpoliticamente.com.br", nome: "Blog Politicamente (Kohlbach)", tier: "tier1_politica", regiao: "Estadual" },
  { dominio: "esmaelmorais.com.br", nome: "Esmael Morais", tier: "tier1_politica", regiao: "Estadual" },
  { dominio: "blogdotupan.com.br", nome: "Blog do Tupan", tier: "tier1_politica", regiao: "Curitiba / ALEP" },
  { dominio: "plural.jor.br", nome: "Plural", tier: "tier1_politica", regiao: "Curitiba / RMC" },
  { dominio: "contraponto.jor.br", nome: "Contraponto", tier: "tier1_politica", regiao: "Estadual" },
  { dominio: "pacocacomcebola.com.br", nome: "Paçoca com Cebola", tier: "tier1_politica", regiao: "Estadual" },
  { dominio: "hojepr.com", nome: "Hoje PR", tier: "tier1_politica", regiao: "Estadual" },

  // CBN
  { dominio: "cbncuritiba.com.br", nome: "CBN Curitiba", tier: "tier1_cbn", regiao: "Curitiba / RMC" },
  { dominio: "cbnlondrina.com.br", nome: "CBN Londrina", tier: "tier1_cbn", regiao: "Norte / Londrina" },
  { dominio: "cbnmaringa.com.br", nome: "CBN Maringá", tier: "tier1_cbn", regiao: "Norte / Maringá" },
  { dominio: "cbncascaveloficial.com.br", nome: "CBN Cascavel", tier: "tier1_cbn", regiao: "Oeste / Cascavel" },
  { dominio: "cbnfoz.com", nome: "CBN Foz", tier: "tier1_cbn", regiao: "Oeste / Foz do Iguaçu" },
  { dominio: "cbnpg.com.br", nome: "CBN Ponta Grossa", tier: "tier1_cbn", regiao: "Campos Gerais" },

  // Tier 2: Oeste & Foz
  { dominio: "h2foz.com.br", nome: "H2Foz", tier: "tier2_regional", regiao: "Oeste / Foz do Iguaçu" },
  { dominio: "naoviu.com.br", nome: "Não Viu", tier: "tier2_regional", regiao: "Oeste / Foz do Iguaçu" },
  { dominio: "clickfozdoiguacu.com.br", nome: "Click Foz", tier: "tier2_regional", regiao: "Oeste / Foz do Iguaçu" },
  { dominio: "gdia.com.br", nome: "GDia", tier: "tier2_regional", regiao: "Oeste / Foz do Iguaçu" },
  { dominio: "diariodefoz.com", nome: "Diário de Foz", tier: "tier2_regional", regiao: "Oeste / Foz do Iguaçu" },
  { dominio: "portal24.com.br", nome: "Portal 24h", tier: "tier2_regional", regiao: "Oeste / Cascavel" },
  { dominio: "pretonobranco.com.br", nome: "Preto no Branco", tier: "tier2_regional", regiao: "Oeste / Cascavel" },
  { dominio: "jornalavozdoparana.com.br", nome: "A Voz do Paraná", tier: "tier2_regional", regiao: "Oeste" },
  { dominio: "paranaoeste.com.br", nome: "Paraná Oeste", tier: "tier2_regional", regiao: "Oeste" },

  // Tier 2: Norte & Noroeste
  { dominio: "maringapost.com.br", nome: "Maringá Post", tier: "tier2_regional", regiao: "Norte / Maringá" },
  { dominio: "angelorigon.com.br", nome: "Angelo Rigon", tier: "tier2_regional", regiao: "Norte / Maringá" },
  { dominio: "omaringa.com.br", nome: "O Maringá", tier: "tier2_regional", regiao: "Norte / Maringá" },
  { dominio: "odiariodemaringa.com.br", nome: "O Diário de Maringá", tier: "tier2_regional", regiao: "Norte / Maringá" },
  { dominio: "obemdito.com.br", nome: "O Bemdito", tier: "tier2_regional", regiao: "Noroeste / Umuarama" },
  { dominio: "ilustrado.com.br", nome: "Ilustrado", tier: "tier2_regional", regiao: "Noroeste / Umuarama" },
  { dominio: "umuarama.portaldacidade.com", nome: "Portal da Cidade Umuarama", tier: "tier2_regional", regiao: "Noroeste / Umuarama" },
  { dominio: "portalumuaramanews.com.br", nome: "Umuarama News", tier: "tier2_regional", regiao: "Noroeste / Umuarama" },

  // Tier 2: Sudoeste
  { dominio: "jornaldebeltrao.com.br", nome: "Jornal de Beltrão", tier: "tier2_regional", regiao: "Sudoeste / Francisco Beltrão" },
  { dominio: "rbj.com.br", nome: "RBJ", tier: "tier2_regional", regiao: "Sudoeste / Pato Branco" },

  // Tier 2: Litoral
  { dominio: "agoralitoral.com.br", nome: "Agora Litoral", tier: "tier2_regional", regiao: "Litoral" },
  { dominio: "folhadolitoral.com.br", nome: "Folha do Litoral", tier: "tier2_regional", regiao: "Litoral" },
  { dominio: "correiodolitoral.com", nome: "Correio do Litoral", tier: "tier2_regional", regiao: "Litoral" },
  { dominio: "jblitoral.com.br", nome: "JB Litoral", tier: "tier2_regional", regiao: "Litoral" },

  // Tier 2: Norte Pioneiro & Campos Gerais
  { dominio: "jacarezinho.portaldacidade.com", nome: "Portal da Cidade Jacarezinho", tier: "tier2_regional", regiao: "Norte Pioneiro" },
  { dominio: "portaljnn.com", nome: "Portal JNN", tier: "tier2_regional", regiao: "Norte Pioneiro" },
  { dominio: "folhaextra.com", nome: "Folha Extra", tier: "tier2_regional", regiao: "Norte Pioneiro" },
  { dominio: "minutonoticia.com.br", nome: "Minuto Notícia", tier: "tier2_regional", regiao: "Campos Gerais" },
  { dominio: "jhoje.com.br", nome: "Jornal Hoje", tier: "tier2_regional", regiao: "Campos Gerais" },

  // Tier 2: Gerais / Outros
  { dominio: "diariodecuritiba.com", nome: "Diário de Curitiba", tier: "tier2_regional", regiao: "Curitiba" },
  { dominio: "paranaportal.com", nome: "Paraná Portal", tier: "tier2_regional", regiao: "Estadual" },
  { dominio: "miroferraznews.com.br", nome: "Miro Ferraz News", tier: "tier2_regional", regiao: "Estadual" },
  { dominio: "tribunahoje.jor.br", nome: "Tribuna Hoje", tier: "tier2_regional", regiao: "Estadual" },
  { dominio: "jornaldopovo.net", nome: "Jornal do Povo", tier: "tier2_regional", regiao: "Estadual" },
];

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const { data: eu } = await supabase
    .from("usuarios_internos")
    .select("campanha_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!eu) return NextResponse.json({ error: "sem vínculo de campanha" }, { status: 403 });

  const { data: podeMonitorar } = await supabase.rpc("has_permission", { p: "registrar_monitoramento" });
  if (!podeMonitorar) {
    return NextResponse.json({ error: "sem permissão para gerenciar monitoramento" }, { status: 403 });
  }

  const linhas = FONTES_PR.map((f) => ({
    campanha_id: eu.campanha_id,
    dominio: f.dominio,
    nome: f.nome,
    tier: f.tier,
    regiao: f.regiao,
    criado_por: user.id,
  }));

  const { data, error } = await supabase
    .from("fontes_monitoramento")
    .upsert(linhas, { onConflict: "campanha_id,dominio", ignoreDuplicates: true })
    .select("id");

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ importados: data?.length ?? 0, total: FONTES_PR.length });
}
