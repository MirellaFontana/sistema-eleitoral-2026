import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import React from "react";

const TEMPLATES: Record<string, { width: number; height: number; label: string }> = {
  post_instagram: { width: 1080, height: 1080, label: "Post Instagram" },
  stories: { width: 1080, height: 1920, label: "Stories" },
  whatsapp: { width: 800, height: 800, label: "WhatsApp" },
  facebook: { width: 1200, height: 630, label: "Facebook" },
  twitter: { width: 1200, height: 675, label: "X / Twitter" },
};

const PAPEIS_QUE_GERAM = new Set(["coord_campanha", "coord_marketing", "redator_marketing"]);

async function carregarFonte(): Promise<ArrayBuffer> {
  const res = await fetch(
    "https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-700-normal.woff"
  );
  return res.arrayBuffer();
}

async function carregarFonteRegular(): Promise<ArrayBuffer> {
  const res = await fetch(
    "https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-400-normal.woff"
  );
  return res.arrayBuffer();
}

export async function POST(request: Request) {
  const body = await request.json();
  const { template, texto, cor_primaria, peca_id } = body as {
    template: string;
    texto: string;
    cor_primaria?: string;
    peca_id?: string;
  };

  if (!template || !TEMPLATES[template]) {
    return NextResponse.json(
      { error: "template inválido", templates: Object.keys(TEMPLATES) },
      { status: 400 }
    );
  }

  if (!texto?.trim()) {
    return NextResponse.json({ error: "texto é obrigatório" }, { status: 400 });
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
      "papel, campanha_id, campanhas(nome_candidato, numero_candidato, nome_urna, partido, cnpj_campanha, coligacao)"
    )
    .eq("id", user.id)
    .maybeSingle();

  if (!eu || !PAPEIS_QUE_GERAM.has(eu.papel)) {
    return NextResponse.json({ error: "sem permissão" }, { status: 403 });
  }

  const campanha = Array.isArray(eu.campanhas) ? eu.campanhas[0] : eu.campanhas;
  if (!campanha) {
    return NextResponse.json({ error: "campanha não encontrada" }, { status: 400 });
  }

  // Buscar foto oficial do candidato
  const { data: fotoRow } = await supabase
    .from("fotos_campanha")
    .select("path")
    .eq("tipo", "foto_oficial")
    .maybeSingle();

  let fotoBase64: string | null = null;
  if (fotoRow?.path) {
    const { data: signedData } = await supabase.storage
      .from("fotos-campanha")
      .createSignedUrl(fotoRow.path, 60);
    if (signedData?.signedUrl) {
      try {
        const imgRes = await fetch(signedData.signedUrl);
        const buf = await imgRes.arrayBuffer();
        const mime = imgRes.headers.get("content-type") ?? "image/jpeg";
        fotoBase64 = `data:${mime};base64,${Buffer.from(buf).toString("base64")}`;
      } catch {}
    }
  }

  // Buscar logo da campanha
  const { data: logoRow } = await supabase
    .from("fotos_campanha")
    .select("path")
    .eq("tipo", "logo_campanha")
    .maybeSingle();

  let logoBase64: string | null = null;
  if (logoRow?.path) {
    const { data: signedData } = await supabase.storage
      .from("fotos-campanha")
      .createSignedUrl(logoRow.path, 60);
    if (signedData?.signedUrl) {
      try {
        const imgRes = await fetch(signedData.signedUrl);
        const buf = await imgRes.arrayBuffer();
        const mime = imgRes.headers.get("content-type") ?? "image/png";
        logoBase64 = `data:${mime};base64,${Buffer.from(buf).toString("base64")}`;
      } catch {}
    }
  }

  const tmpl = TEMPLATES[template];
  const cor = cor_primaria ?? "#4f46e5";
  const isVertical = tmpl.height > tmpl.width;

  // Quebrar o texto em linhas curtas para a peça
  const linhas = texto.trim().split("\n").filter(Boolean);
  const textoResumido =
    linhas.length > 6 ? linhas.slice(0, 6).join("\n") + "…" : linhas.join("\n");

  const nomeUrna = campanha.nome_urna ?? campanha.nome_candidato;
  const numero = campanha.numero_candidato ?? "";
  const rodape = [campanha.partido, campanha.coligacao, campanha.cnpj_campanha]
    .filter(Boolean)
    .join(" · ");

  const [fontBold, fontRegular] = await Promise.all([
    carregarFonte(),
    carregarFonteRegular(),
  ]);

  const element = React.createElement(
    "div",
    {
      style: {
        width: tmpl.width,
        height: tmpl.height,
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#ffffff",
        fontFamily: "Inter",
        position: "relative",
        overflow: "hidden",
      },
    },
    // Faixa de cor no topo
    React.createElement("div", {
      style: {
        width: "100%",
        height: isVertical ? 200 : 120,
        backgroundColor: cor,
        flexShrink: 0,
      },
    }),
    // Corpo
    React.createElement(
      "div",
      {
        style: {
          display: "flex",
          flexDirection: isVertical ? "column" : "row",
          flex: 1,
          padding: isVertical ? 60 : 40,
          gap: 40,
          alignItems: isVertical ? "center" : "flex-start",
        },
      },
      // Foto do candidato (se tiver)
      fotoBase64
        ? React.createElement("img", {
            src: fotoBase64,
            width: isVertical ? 300 : 280,
            height: isVertical ? 300 : 280,
            style: {
              borderRadius: "50%",
              objectFit: "cover",
              border: `6px solid ${cor}`,
              flexShrink: 0,
            },
          })
        : React.createElement(
            "div",
            {
              style: {
                width: isVertical ? 300 : 280,
                height: isVertical ? 300 : 280,
                borderRadius: "50%",
                backgroundColor: "#e5e5e5",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 80,
                color: "#a3a3a3",
                border: `6px solid ${cor}`,
                flexShrink: 0,
              },
            },
            nomeUrna.charAt(0)
          ),
      // Texto
      React.createElement(
        "div",
        {
          style: {
            display: "flex",
            flexDirection: "column",
            flex: 1,
            gap: 16,
            justifyContent: "center",
          },
        },
        React.createElement(
          "div",
          {
            style: {
              fontSize: isVertical ? 48 : 36,
              fontWeight: 700,
              color: "#171717",
              lineHeight: 1.3,
              display: "flex",
            },
          },
          textoResumido.length > 200 ? textoResumido.slice(0, 200) + "…" : textoResumido
        )
      )
    ),
    // Rodapé com identidade legal
    React.createElement(
      "div",
      {
        style: {
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          backgroundColor: cor,
          padding: "20px 40px",
          gap: 20,
          flexShrink: 0,
        },
      },
      // Logo (se tiver)
      logoBase64
        ? React.createElement("img", {
            src: logoBase64,
            height: 50,
            style: { objectFit: "contain", flexShrink: 0 },
          })
        : null,
      // Número e nome
      React.createElement(
        "div",
        {
          style: {
            display: "flex",
            alignItems: "center",
            gap: 16,
            flex: 1,
          },
        },
        numero
          ? React.createElement(
              "span",
              {
                style: {
                  fontSize: 48,
                  fontWeight: 700,
                  color: "#ffffff",
                },
              },
              numero
            )
          : null,
        React.createElement(
          "span",
          {
            style: {
              fontSize: 24,
              fontWeight: 700,
              color: "#ffffff",
            },
          },
          nomeUrna
        )
      ),
      // CNPJ / coligação
      rodape
        ? React.createElement(
            "span",
            {
              style: {
                fontSize: 11,
                color: "rgba(255,255,255,0.8)",
                textAlign: "right" as const,
                maxWidth: 300,
              },
            },
            rodape
          )
        : null
    )
  );

  let png: Uint8Array;
  try {
    const svg = await satori(element, {
      width: tmpl.width,
      height: tmpl.height,
      fonts: [
        { name: "Inter", data: fontBold, weight: 700, style: "normal" },
        { name: "Inter", data: fontRegular, weight: 400, style: "normal" },
      ],
    });
    const resvg = new Resvg(svg, {
      fitTo: { mode: "width", value: tmpl.width },
    });
    png = resvg.render().asPng();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "erro ao renderizar";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  return new NextResponse(Buffer.from(png), {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `inline; filename="peca-${template}.png"`,
    },
  });
}
