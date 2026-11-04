import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { valorDaSessaoFixa } from "./cruzar.js";
import { erroDaDivisao, nomeDaLinha, PARTES_MAXIMAS, PARTES_MINIMAS } from "./divisao.js";
import { chaveDoNome } from "./nome-extrato.js";

// Partes positivas em centavos; o sinal da linha é aplicado depois.
const partesPositivas = fc.array(fc.integer({ min: 1, max: 10_000_000 }), { minLength: PARTES_MINIMAS, maxLength: PARTES_MAXIMAS });
const sinal = fc.constantFrom(1, -1);

describe("divisão da linha (propriedades)", () => {
  it("aceita qualquer divisão no sentido da linha que soma o valor dela", () => {
    fc.assert(
      fc.property(partesPositivas, sinal, (partes, s) => {
        const total = s * partes.reduce((soma, parte) => soma + parte, 0);
        expect(erroDaDivisao(total, partes.map((parte) => parte * s))).toBeNull();
      }),
    );
  });

  it("diz se faltam ou sobram centavos quando a soma não bate", () => {
    fc.assert(
      fc.property(partesPositivas, sinal, fc.integer({ min: 1, max: 1_000_000 }), fc.boolean(), (partes, s, delta, falta) => {
        const soma = partes.reduce((acumulado, parte) => acumulado + parte, 0);
        const total = s * (falta ? soma + delta : soma);
        const ajustadas = falta ? partes : [...partes.slice(0, -1), partes[partes.length - 1] + delta];
        const erro = erroDaDivisao(total, ajustadas.map((parte) => parte * s));
        expect(erro).toContain(falta ? "faltam" : "sobram");
      }),
    );
  });

  it("recusa a parte no sentido contrário ao da linha", () => {
    fc.assert(
      fc.property(partesPositivas, sinal, fc.nat(), (partes, s, posicao) => {
        const total = s * partes.reduce((soma, parte) => soma + parte, 0);
        const indice = posicao % partes.length;
        const trocadas = partes.map((parte, i) => (i === indice ? -parte * s : parte * s));
        expect(erroDaDivisao(total, trocadas)).toMatch(/^Numa (saída|entrada)/);
      }),
    );
  });

  it("recusa menos de duas ou mais de dez partes", () => {
    const fora = fc.oneof(
      fc.array(fc.integer({ min: 1, max: 1000 }), { maxLength: PARTES_MINIMAS - 1 }),
      fc.array(fc.integer({ min: 1, max: 1000 }), { minLength: PARTES_MAXIMAS + 1, maxLength: PARTES_MAXIMAS + 5 }),
    );
    fc.assert(
      fc.property(fora, (partes) => {
        const total = partes.reduce((soma, parte) => soma + parte, 0) || 1;
        expect(erroDaDivisao(total, partes)).toContain("partes");
      }),
    );
  });

  it("o nome da linha nunca fica vazio nem passa de 160 caracteres", () => {
    fc.assert(
      fc.property(fc.option(fc.string()), fc.string(), (nome, descricao) => {
        const final = nomeDaLinha(nome ?? undefined, descricao);
        expect(final.length).toBeGreaterThan(0);
        expect(final.length).toBeLessThanOrEqual(160);
        if (nome?.trim()) expect(final).toBe(nome.trim().slice(0, 160));
      }),
    );
  });
});

describe("valor da sessão fixa (propriedades)", () => {
  const centavos = fc.integer({ min: -10_000_000, max: 10_000_000 }).filter((valor) => valor !== 0);
  const escolha = fc.constantFrom(undefined, "extrato" as const, "lancamento" as const);

  it("com valores iguais vale o do extrato, qualquer que seja a escolha", () => {
    fc.assert(
      fc.property(centavos, escolha, (valor, qual) => {
        expect(valorDaSessaoFixa(valor, valor, qual)).toBe(valor);
      }),
    );
  });

  it("com valores diferentes obedece a escolha, e sem escolha pede uma", () => {
    fc.assert(
      fc.property(centavos, centavos, escolha, (planejado, extrato, qual) => {
        fc.pre(planejado !== extrato);
        const esperado = qual === "extrato" ? extrato : qual === "lancamento" ? planejado : "escolha";
        expect(valorDaSessaoFixa(planejado, extrato, qual)).toBe(esperado);
      }),
    );
  });
});

describe("chave do nome (propriedades)", () => {
  it("é estável: aplicar de novo não muda nada, e cabe em 160 caracteres", () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 400 }), (texto) => {
        const chave = chaveDoNome(texto);
        expect(chaveDoNome(chave)).toBe(chave);
        expect(chave.length).toBeLessThanOrEqual(160);
      }),
    );
  });

  it("ignora maiúsculas e os espaços repetidos", () => {
    const palavra = fc.stringMatching(/^[a-z]{1,12}$/);
    fc.assert(
      fc.property(fc.array(palavra, { minLength: 1, maxLength: 6 }), fc.integer({ min: 1, max: 4 }), (palavras, espacos) => {
        const normal = palavras.join(" ");
        const bagunçado = `  ${palavras.map((p) => p.toUpperCase()).join(" ".repeat(espacos))} `;
        expect(chaveDoNome(bagunçado)).toBe(chaveDoNome(normal));
      }),
    );
  });
});
