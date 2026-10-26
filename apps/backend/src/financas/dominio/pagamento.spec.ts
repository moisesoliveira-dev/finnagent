import { describe, expect, it } from "vitest";
import type { Ocorrencia } from "@finnagent/contracts";
import { ocorrenciaDoPagamento, pagarOcorrencia } from "./pagamento.js";

function ocorrencia(number: number, dueDate: string, status: Ocorrencia["status"] = "pending"): Ocorrencia {
  return { number, dueDate, plannedCents: -10_000, paidCents: null, paidOn: null, status };
}

describe("pagamento pelo extrato", () => {
  it("escolhe a pendente do mês mais perto da data do banco", () => {
    const lista = [ocorrencia(1, "2026-05-01"), ocorrencia(2, "2026-05-15"), ocorrencia(3, "2026-06-01")];
    expect(ocorrenciaDoPagamento(lista, "2026-05-13")).toBe(2);
  });

  it("usa a paga do mês quando não há pendente e ignora a cancelada", () => {
    const lista = [ocorrencia(1, "2026-05-01", "completed"), ocorrencia(2, "2026-05-20", "cancelled")];
    expect(ocorrenciaDoPagamento(lista, "2026-05-21")).toBe(1);
    expect(ocorrenciaDoPagamento([ocorrencia(1, "2026-05-01", "cancelled")], "2026-05-01")).toBeNull();
    expect(ocorrenciaDoPagamento([ocorrencia(1, "2026-04-30")], "2026-05-01")).toBeNull();
  });

  it("grava o valor e o dia do banco", () => {
    expect(pagarOcorrencia(ocorrencia(1, "2026-05-01"), -9_870, "2026-05-02")).toMatchObject({
      status: "completed",
      paidCents: -9_870,
      paidOn: "2026-05-02",
    });
  });
});
