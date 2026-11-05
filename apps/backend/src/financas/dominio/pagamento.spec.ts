import type { Ocorrencia } from "@finnagent/contracts";
import { describe, expect, it } from "vitest";
import { aplicarPagamento, desfazerPagamento, replanejarEmprestimo, saldoDaLista, type ContratoDoPagamento } from "./pagamento.js";

const datar = (year: number, month: number) => `${year}-${String(month).padStart(2, "0")}-10`;

function parcelas(total: number, cents: number, inicio = "2026-10"): Ocorrencia[] {
  const [ano, mes] = inicio.split("-").map(Number);
  return Array.from({ length: total }, (_, indice) => {
    const absoluto = (ano as number) * 12 + (mes as number) - 1 + indice;
    return {
      number: indice + 1,
      dueDate: datar(Math.floor(absoluto / 12), (absoluto % 12) + 1),
      plannedCents: -cents,
      paidCents: null,
      paidOn: null,
      status: "pending" as const,
      kind: "parcela" as const,
      parcel: indice + 1,
      paymentId: null,
    };
  });
}

const PARCELA: ContratoDoPagamento = { category: "installment", mode: "outflows", cents: -10_000, installments: 4, principalCents: null };
const pagamento = (cents: number, date = "2026-10-12", extra: Partial<{ diferenca: "multa" | "proxima" }> = {}) => ({ cents, date, paymentId: "p1", ...extra });

function lista(resultado: ReturnType<typeof aplicarPagamento>) {
  if (typeof resultado === "string") throw new Error(resultado);
  return resultado.lista;
}

describe("pagamento de parcelas", () => {
  it("paga a primeira parcela pendente, em qualquer mês, na data e no valor reais", () => {
    const depois = lista(aplicarPagamento(PARCELA, parcelas(4, 10_000), pagamento(10_000, "2026-11-20")));
    expect(depois[0]).toMatchObject({ status: "completed", paidCents: -10_000, paidOn: "2026-11-20", paymentId: "p1", dueDate: "2026-10-10" });
    expect(depois.slice(1).every((item) => item.status === "pending")).toBe(true);
  });

  it("duas parcelas no mesmo mês: o valor de duas paga as duas", () => {
    const depois = lista(aplicarPagamento(PARCELA, parcelas(4, 10_000), pagamento(20_000)));
    expect(depois.map((item) => item.status)).toEqual(["completed", "completed", "pending", "pending"]);
    expect(depois[1]).toMatchObject({ paidOn: "2026-10-12", parcel: 2 });
  });

  it("dois pagamentos no mesmo mês adiantam a parcela seguinte", () => {
    const primeiro = lista(aplicarPagamento(PARCELA, parcelas(4, 10_000), pagamento(10_000)));
    const segundo = lista(aplicarPagamento(PARCELA, primeiro, { ...pagamento(10_000, "2026-10-25"), paymentId: "p2" }));
    expect(segundo.map((item) => item.status)).toEqual(["completed", "completed", "pending", "pending"]);
    expect(segundo[1]?.paymentId).toBe("p2");
  });

  it("menos que a parcela paga parte dela: o restante continua pendente, com o mesmo vencimento e número", () => {
    const depois = lista(aplicarPagamento(PARCELA, parcelas(2, 10_000), pagamento(4_000)));
    expect(depois).toHaveLength(3);
    expect(depois[0]).toMatchObject({ status: "completed", plannedCents: -4_000, paidCents: -4_000, parcel: 1 });
    expect(depois[1]).toMatchObject({ status: "pending", plannedCents: -6_000, dueDate: "2026-10-10", parcel: 1, number: 2 });
    expect(depois[2]).toMatchObject({ status: "pending", parcel: 2, number: 3 });
  });

  it("mais que a parcela e menos que duas pede a escolha: multa e juros ou parte da próxima", () => {
    expect(aplicarPagamento(PARCELA, parcelas(4, 10_000), pagamento(12_500))).toBe("escolha-diferenca");
    const comMulta = lista(aplicarPagamento(PARCELA, parcelas(4, 10_000), pagamento(12_500, "2026-10-12", { diferenca: "multa" })));
    expect(comMulta).toHaveLength(5);
    expect(comMulta[0]).toMatchObject({ status: "completed", paidCents: -10_000 });
    expect(comMulta[1]).toMatchObject({ kind: "multa", status: "completed", paidCents: -2_500, parcel: 1, dueDate: "2026-10-12" });
    const comProxima = lista(aplicarPagamento(PARCELA, parcelas(4, 10_000), pagamento(12_500, "2026-10-12", { diferenca: "proxima" })));
    expect(comProxima).toHaveLength(5);
    expect(comProxima[1]).toMatchObject({ status: "completed", paidCents: -2_500, parcel: 2 });
    expect(comProxima[2]).toMatchObject({ status: "pending", plannedCents: -7_500, parcel: 2 });
  });

  it("quitou tudo e ainda sobrou: a sobra é multa da última, sem perguntar", () => {
    const depois = lista(aplicarPagamento(PARCELA, parcelas(2, 10_000), pagamento(21_000)));
    expect(depois.map((item) => item.kind)).toEqual(["parcela", "parcela", "multa"]);
    expect(depois[2]).toMatchObject({ paidCents: -1_000, parcel: 2 });
  });

  it("desfazer o pagamento volta a parcela, apaga a multa e junta a parte com o restante", () => {
    const comMulta = lista(aplicarPagamento(PARCELA, parcelas(4, 10_000), pagamento(12_500, "2026-10-12", { diferenca: "multa" })));
    const voltou = desfazerPagamento(PARCELA, comMulta, "p1", datar);
    expect(voltou).toEqual({ lista: parcelas(4, 10_000) });
    const emParte = lista(aplicarPagamento(PARCELA, parcelas(2, 10_000), pagamento(4_000)));
    expect(desfazerPagamento(PARCELA, emParte, "p1", datar)).toEqual({ lista: parcelas(2, 10_000) });
    expect(desfazerPagamento(PARCELA, emParte, "nao-existe", datar)).toBe("ausente");
  });

  it("não desfaz a parte quando o restante dela já foi pago por outro pagamento", () => {
    const emParte = lista(aplicarPagamento(PARCELA, parcelas(2, 10_000), pagamento(4_000)));
    const resto = lista(aplicarPagamento(PARCELA, emParte, { ...pagamento(6_000, "2026-10-20"), paymentId: "p2" }));
    expect(desfazerPagamento(PARCELA, resto, "p1", datar)).toBe("bloqueada");
    expect(desfazerPagamento(PARCELA, resto, "p2", datar)).toEqual({ lista: emParte });
  });

  it("única e recorrente continuam pagando a ocorrência do mês", () => {
    const unica: ContratoDoPagamento = { category: "unique", mode: "outflows", cents: -5_000, installments: null, principalCents: null };
    const depois = lista(aplicarPagamento(unica, parcelas(1, 5_000), pagamento(4_900, "2026-10-30")));
    expect(depois[0]).toMatchObject({ status: "completed", paidCents: -4_900, paidOn: "2026-10-30" });
    expect(aplicarPagamento(unica, parcelas(1, 5_000), pagamento(4_900, "2026-11-02"))).toBe("bloqueada");
  });
});

describe("empréstimo como contrato", () => {
  const EMPRESTIMO: ContratoDoPagamento = { category: "loan", mode: "inflows", cents: 20_000, installments: 5, principalCents: 100_000 };

  it("cada pagamento abate o saldo e o que falta é previsto de novo a partir do mês seguinte", () => {
    const inicial = replanejarEmprestimo(EMPRESTIMO, parcelas(5, 20_000).map((item) => ({ ...item, plannedCents: 20_000 })), datar);
    expect(inicial).toHaveLength(5);
    const depois = lista(aplicarPagamento(EMPRESTIMO, inicial, pagamento(20_000, "2026-10-15"), datar));
    expect(depois[0]).toMatchObject({ status: "completed", paidCents: 20_000, paidOn: "2026-10-15", parcel: 1 });
    expect(depois.filter((item) => item.status === "pending")).toHaveLength(4);
    expect(depois[1]?.dueDate).toBe("2026-11-10");
    expect(saldoDaLista(EMPRESTIMO, depois)).toEqual({ principal: 100_000, pago: 20_000, saldo: 80_000 });
  });

  it("pagaram duas de uma vez, ou tudo: a previsão encolhe", () => {
    const inicial = replanejarEmprestimo(EMPRESTIMO, parcelas(5, 20_000), datar);
    const duas = lista(aplicarPagamento(EMPRESTIMO, inicial, pagamento(40_000, "2026-10-15"), datar));
    expect(duas.filter((item) => item.status === "pending")).toHaveLength(3);
    expect(duas[0]).toMatchObject({ paidCents: 40_000, parcel: 1 });
    const tudo = lista(aplicarPagamento(EMPRESTIMO, inicial, pagamento(100_000, "2026-10-15"), datar));
    expect(tudo.filter((item) => item.status === "pending")).toHaveLength(0);
    expect(saldoDaLista(EMPRESTIMO, tudo).saldo).toBe(0);
  });

  it("um mês sem pagamento: o pagamento seguinte empurra a previsão, e o saldo não muda por conta disso", () => {
    const inicial = replanejarEmprestimo(EMPRESTIMO, parcelas(5, 20_000), datar);
    // Nada em outubro; pagou em novembro.
    const depois = lista(aplicarPagamento(EMPRESTIMO, inicial, pagamento(20_000, "2026-11-18"), datar));
    const pendentes = depois.filter((item) => item.status === "pending");
    expect(pendentes.map((item) => item.dueDate)).toEqual(["2026-12-10", "2027-01-10", "2027-02-10", "2027-03-10"]);
    expect(saldoDaLista(EMPRESTIMO, depois).saldo).toBe(80_000);
  });

  it("valor menor que a parcela combinada abate o que foi pago, e o que passa do saldo é multa", () => {
    const inicial = replanejarEmprestimo(EMPRESTIMO, parcelas(5, 20_000), datar);
    const menor = lista(aplicarPagamento(EMPRESTIMO, inicial, pagamento(5_000, "2026-10-15"), datar));
    expect(saldoDaLista(EMPRESTIMO, menor).saldo).toBe(95_000);
    expect(menor.filter((item) => item.status === "pending")).toHaveLength(5);
    expect(menor.at(-1)?.plannedCents).toBe(15_000);
    const demais = lista(aplicarPagamento(EMPRESTIMO, inicial, pagamento(101_000, "2026-10-15"), datar));
    expect(demais.map((item) => item.kind)).toEqual(["parcela", "multa"]);
    expect(demais[1]?.paidCents).toBe(1_000);
  });

  it("desfazer o pagamento do empréstimo refaz a previsão", () => {
    const inicial = replanejarEmprestimo(EMPRESTIMO, parcelas(5, 20_000), datar);
    const depois = lista(aplicarPagamento(EMPRESTIMO, inicial, pagamento(20_000, "2026-10-15"), datar));
    const voltou = desfazerPagamento(EMPRESTIMO, depois, "p1", datar);
    if (typeof voltou === "string") throw new Error(voltou);
    expect(voltou.lista.filter((item) => item.status === "pending")).toHaveLength(5);
    expect(saldoDaLista(EMPRESTIMO, voltou.lista).saldo).toBe(100_000);
  });
});
