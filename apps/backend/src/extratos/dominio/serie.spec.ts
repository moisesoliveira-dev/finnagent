import type { Lancamento } from "@finnagent/contracts";
import { describe, expect, it } from "vitest";
import { erroDaEscolha, linhasDaNovaSerie, linhasDaSerieExistente, mesesEntre, tipoNoInicio, type LinhaLivre } from "./serie.js";

const EXTRATO = "00000000-0000-4000-8000-0000000000e1";
const linha = (line: number, date: string, cents: number, description = "Compra no débito via NuPay — Academia"): LinhaLivre => ({
  statementId: EXTRATO,
  line,
  date,
  cents,
  description,
});

describe("meses entre", () => {
  it("conta virando o ano", () => {
    expect(mesesEntre("2026-11", "2027-02")).toBe(3);
    expect(mesesEntre("2026-08", "2026-06")).toBe(-2);
  });
});

describe("a série nova a partir de uma linha", () => {
  const origem = linha(1, "2026-10-05", -9_900);
  const livres = [
    origem,
    linha(2, "2026-08-05", -9_900, "Compra no débito via NuPay - Academia"),
    linha(3, "2026-09-05", -9_900),
    linha(4, "2026-09-20", -4_000),
    linha(5, "2026-11-05", -9_900),
    linha(6, "2026-11-06", 9_900),
    linha(7, "2026-07-05", -9_900, "Mercado"),
  ];

  it("a recorrente acha a mesma compra em todos os meses, com hífen ou travessão, e só saída com saída", () => {
    const meses = linhasDaNovaSerie(origem, { category: "fixed", recurrence: "monthly", recurrenceInterval: 1 }, livres);
    expect(meses.map((mes) => mes.month)).toEqual(["2026-08", "2026-09", "2026-10", "2026-11"]);
    expect(meses.find((mes) => mes.month === "2026-09")?.lines.map((item) => item.line)).toEqual([3, 4]);
    expect(meses.find((mes) => mes.month === "2026-11")?.lines.map((item) => item.line)).toEqual([5]);
    expect(meses.every((mes) => mes.numero === null)).toBe(true);
  });

  it("a parcela só vale de 1 até o total, contando a partir da parcela da linha", () => {
    // Outubro é a 2ª de 3: agosto seria a 0ª (fora), setembro a 1ª, novembro a 3ª.
    const meses = linhasDaNovaSerie(origem, { category: "installment", installments: 3, installmentNumber: 2 }, livres);
    expect(meses.map((mes) => [mes.month, mes.numero])).toEqual([
      ["2026-09", 1],
      ["2026-10", 2],
      ["2026-11", 3],
    ]);
  });

  it("única e recorrência que não é mensal ficam só com a linha", () => {
    expect(linhasDaNovaSerie(origem, { category: "unique" }, livres)).toHaveLength(1);
    expect(linhasDaNovaSerie(origem, { category: "fixed", recurrence: "weekly", recurrenceInterval: 1 }, livres)).toHaveLength(1);
  });

  it("a oferta por Pix acha os outros meses, com e sem CNPJ e conta na descrição", () => {
    const longa = linha(88, "2026-10-04", -10_000, "Transferência enviada pelo Pix — NOVA IGREJA BATISTA - 63.691.281/0001-96 - BCO BRADESCO S.A. (0237) Agência: 2396 Conta: 22920-2");
    const outras = [linha(45, "2026-09-06", -10_000, "Transferência enviada pelo Pix - NOVA IGREJA BATISTA"), linha(46, "2026-11-01", -10_000, "Transferência enviada pelo Pix — NOVA IGREJA BATISTA"), linha(47, "2026-11-02", -10_000, "Transferência enviada pelo Pix — João Silva")];
    const meses = linhasDaNovaSerie(longa, { category: "fixed", recurrence: "monthly" }, [longa, ...outras]);
    expect(meses.map((mes) => [mes.month, mes.lines.map((item) => item.line)])).toEqual([
      ["2026-09", [45]],
      ["2026-10", [88]],
      ["2026-11", [46]],
    ]);
  });

  it("a série nasce no mês mais antigo escolhido, com a parcela daquele mês", () => {
    const tipo = { category: "installment" as const, installments: 3, installmentNumber: 2 };
    const meses = linhasDaNovaSerie(origem, tipo, livres);
    expect(tipoNoInicio(tipo, meses, "2026-09")).toEqual({ ...tipo, installmentNumber: 1 });
  });
});

describe("a escolha da pessoa", () => {
  const meses = linhasDaNovaSerie(linha(1, "2026-10-05", -9_900), { category: "fixed", recurrence: "monthly" }, [
    linha(1, "2026-10-05", -9_900),
    linha(3, "2026-09-05", -9_900),
    linha(4, "2026-09-20", -4_000),
  ]);

  it("aceita uma linha da série por mês e partes só no mês que tem a da série", () => {
    expect(erroDaEscolha(meses, [{ statementId: EXTRATO, line: 1, papel: "serie" }, { statementId: EXTRATO, line: 3, papel: "serie" }, { statementId: EXTRATO, line: 4, papel: "parte" }])).toBeNull();
  });

  it("recusa duas da série no mesmo mês, parte sozinha, linha de fora e escolha vazia", () => {
    expect(erroDaEscolha(meses, [{ statementId: EXTRATO, line: 3, papel: "serie" }, { statementId: EXTRATO, line: 4, papel: "serie" }])).toContain("só uma linha paga a série");
    expect(erroDaEscolha(meses, [{ statementId: EXTRATO, line: 1, papel: "serie" }, { statementId: EXTRATO, line: 4, papel: "parte" }])).toContain("precisa de uma linha que pague a série");
    expect(erroDaEscolha(meses, [{ statementId: EXTRATO, line: 99, papel: "serie" }])).toContain("não é desta série");
    expect(erroDaEscolha(meses, [])).toBe("Escolha ao menos uma linha.");
  });
});

describe("a série que já existe", () => {
  const entry = {
    id: "e1",
    category: "fixed",
    cents: -9_900,
    occurrences: [
      { number: 1, dueDate: "2026-10-05", plannedCents: -9_900, paidCents: -9_900, paidOn: "2026-10-05", status: "completed" },
      { number: 2, dueDate: "2026-11-05", plannedCents: -9_900, paidCents: null, paidOn: null, status: "pending" },
      { number: 3, dueDate: "2026-12-05", plannedCents: -9_900, paidCents: null, paidOn: null, status: "pending" },
    ],
  } as unknown as Lancamento;
  const chaves = new Set(["compra no debito via nupay academia"]);

  it("acha as linhas livres só nos meses em que ainda tem ocorrência pendente, com a ocorrência de cada um", () => {
    const meses = linhasDaSerieExistente(entry, chaves, [
      linha(1, "2026-10-05", -9_900),
      linha(2, "2026-11-04", -9_900),
      linha(3, "2026-12-06", -10_400),
      linha(4, "2027-01-05", -9_900),
    ]);
    expect(meses.map((mes) => [mes.month, mes.dueDate, mes.plannedCents, mes.lines.map((item) => item.line)])).toEqual([
      ["2026-11", "2026-11-05", -9_900, [2]],
      ["2026-12", "2026-12-05", -9_900, [3]],
    ]);
  });

  it("o mês importado antes do início da série também aparece, marcado como antes", () => {
    const meses = linhasDaSerieExistente(entry, chaves, [linha(7, "2026-08-05", -9_900), linha(2, "2026-11-04", -9_900)]);
    expect(meses.map((mes) => [mes.month, mes.antes, mes.dueDate])).toEqual([
      ["2026-08", true, null],
      ["2026-11", false, "2026-11-05"],
    ]);
  });

  it("num mês com muitas linhas da mesma loja, ficam as três de valor mais perto", () => {
    const muitas = [1, 2, 3, 4, 5].map((i) => linha(20 + i, `2026-11-0${i}`, -1_000 * i * 3));
    const [novembro] = linhasDaSerieExistente(entry, chaves, muitas);
    expect(novembro?.lines.map((item) => item.cents)).toEqual([-6_000, -9_000, -12_000]);
  });

  it("sem chave conhecida, ou única, não acha nada", () => {
    expect(linhasDaSerieExistente(entry, new Set(), [linha(2, "2026-11-04", -9_900)])).toEqual([]);
    expect(linhasDaSerieExistente({ ...entry, category: "unique" } as Lancamento, chaves, [linha(2, "2026-11-04", -9_900)])).toEqual([]);
  });
});
