import { describe, it, expect } from "vitest";
import { decodificarHtml, extrairNoticiasRss } from "./monitoramento-busca";

describe("decodificarHtml", () => {
  it("decodifica entidades HTML", () => {
    expect(decodificarHtml("&amp; &quot; &#39; &lt; &gt;")).toBe('& " \' < >');
  });

  it("remove CDATA wrappers", () => {
    expect(decodificarHtml("<![CDATA[texto]]>")).toBe("texto");
  });

  it("trim espaços", () => {
    expect(decodificarHtml("  abc  ")).toBe("abc");
  });
});

describe("extrairNoticiasRss", () => {
  it("extrai itens de RSS válido", () => {
    const xml = `<rss><channel>
      <item>
        <title>Título 1</title>
        <link>https://example.com/1</link>
        <pubDate>${new Date(Date.now() - 86400000).toUTCString()}</pubDate>
        <source>Fonte A</source>
      </item>
      <item>
        <title>Título 2</title>
        <link>https://example.com/2</link>
      </item>
    </channel></rss>`;

    const result = extrairNoticiasRss(xml);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      titulo: "Título 1",
      link: "https://example.com/1",
      fonte: "Fonte A",
    });
    expect(result[0].publicadoEm).toBeTruthy();
    expect(result[1].fonte).toBe("");
    expect(result[1].publicadoEm).toBeNull();
  });

  it("retorna array vazio para XML sem itens", () => {
    expect(extrairNoticiasRss("<rss><channel></channel></rss>")).toEqual([]);
  });

  it("ignora itens sem título ou link", () => {
    const xml = `<rss><channel>
      <item><title></title><link></link></item>
      <item><title>Ok</title><link>https://x.com</link></item>
    </channel></rss>`;
    const result = extrairNoticiasRss(xml);
    expect(result).toHaveLength(1);
    expect(result[0].titulo).toBe("Ok");
  });

  it("limita a 15 itens", () => {
    const items = Array.from({ length: 20 }, (_, i) =>
      `<item><title>T${i}</title><link>https://x.com/${i}</link></item>`
    ).join("");
    const xml = `<rss><channel>${items}</channel></rss>`;
    expect(extrairNoticiasRss(xml)).toHaveLength(15);
  });
});
