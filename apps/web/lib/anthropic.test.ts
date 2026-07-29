import { describe, it, expect } from "vitest";
import { montarContextoDiretrizes, montarContextoConhecimento, type DiretrizCompleta, type TemaComItens } from "./anthropic";

describe("montarContextoDiretrizes", () => {
  it("returns empty for null", () => {
    expect(montarContextoDiretrizes(null)).toBe("");
  });

  it("includes header with status", () => {
    const d: DiretrizCompleta = {
      identidade: null, valores: null, vocabulario_preferido: [], vocabulario_proibido: [],
      assuntos_sensiveis: [], limites: null, mensagens_mae: [], status: "aprovada", posicoes: [],
    };
    const r = montarContextoDiretrizes(d);
    expect(r).toContain("status: aprovada");
    expect(r).toContain("FONTE DE VERDADE");
  });

  it("includes identity and values", () => {
    const d: DiretrizCompleta = {
      identidade: "Líder comunitário", valores: "Educação e saúde",
      vocabulario_preferido: [], vocabulario_proibido: [], assuntos_sensiveis: [],
      limites: null, mensagens_mae: [], status: "rascunho", posicoes: [],
    };
    const r = montarContextoDiretrizes(d);
    expect(r).toContain("Líder comunitário");
    expect(r).toContain("Educação e saúde");
  });

  it("includes vocabulary lists", () => {
    const d: DiretrizCompleta = {
      identidade: null, valores: null,
      vocabulario_preferido: ["comunidade", "transparência"],
      vocabulario_proibido: ["inimigo"],
      assuntos_sensiveis: ["religião"],
      limites: "Nunca atacar adversário", mensagens_mae: [], status: "aprovada", posicoes: [],
    };
    const r = montarContextoDiretrizes(d);
    expect(r).toContain("comunidade, transparência");
    expect(r).toContain("NUNCA USAR");
    expect(r).toContain("inimigo");
    expect(r).toContain("religião");
    expect(r).toContain("Nunca atacar adversário");
  });

  it("includes mensagens-mãe", () => {
    const d: DiretrizCompleta = {
      identidade: null, valores: null, vocabulario_preferido: [], vocabulario_proibido: [],
      assuntos_sensiveis: [], limites: null, status: "aprovada", posicoes: [],
      mensagens_mae: [{ tema: "Saúde", mensagem: "Saúde para todos", adaptacoes: "jovens: linguagem informal" }],
    };
    const r = montarContextoDiretrizes(d);
    expect(r).toContain('Saúde: "Saúde para todos"');
    expect(r).toContain("jovens: linguagem informal");
  });

  it("includes positions and warns about undefined topics", () => {
    const d: DiretrizCompleta = {
      identidade: null, valores: null, vocabulario_preferido: [], vocabulario_proibido: [],
      assuntos_sensiveis: [], limites: null, mensagens_mae: [], status: "aprovada",
      posicoes: [
        { tema_nome: "Transporte", tema_livre: null, posicao: "Mais ônibus", evidencias: "pesquisa X", status: "definida" },
        { tema_nome: null, tema_livre: "Aborto", posicao: "", evidencias: null, status: "sem_definicao" },
      ],
    };
    const r = montarContextoDiretrizes(d);
    expect(r).toContain("Transporte: Mais ônibus");
    expect(r).toContain("pesquisa X");
    expect(r).toContain("[SEM DEFINIÇÃO]");
    expect(r).toContain("TEMAS SEM DEFINIÇÃO: Aborto");
  });
});

describe("montarContextoConhecimento", () => {
  it("returns empty for no temas", () => {
    expect(montarContextoConhecimento([])).toBe("");
  });

  it("formats tema with publicos and regioes", () => {
    const temas: TemaComItens[] = [{
      nome: "Educação",
      publicos_alvo: ["pais", "professores"],
      regioes_prioritarias: ["zona norte"],
      itens: [{ titulo: "Creches", descricao: "200 novas vagas" }],
    }];
    const r = montarContextoConhecimento(temas);
    expect(r).toContain("## Educação");
    expect(r).toContain("pais, professores");
    expect(r).toContain("zona norte");
    expect(r).toContain("Creches: 200 novas vagas");
  });

  it("shows placeholder for tema without items", () => {
    const temas: TemaComItens[] = [{
      nome: "Segurança",
      publicos_alvo: [],
      regioes_prioritarias: [],
      itens: [],
    }];
    const r = montarContextoConhecimento(temas);
    expect(r).toContain("(sem itens cadastrados)");
  });

  it("skips items without descricao", () => {
    const temas: TemaComItens[] = [{
      nome: "Saúde",
      publicos_alvo: [],
      regioes_prioritarias: [],
      itens: [
        { titulo: "UBS", descricao: "reformar 5 unidades" },
        { titulo: "Vazio", descricao: null },
      ],
    }];
    const r = montarContextoConhecimento(temas);
    expect(r).toContain("UBS: reformar 5 unidades");
    expect(r).not.toContain("Vazio");
  });
});
