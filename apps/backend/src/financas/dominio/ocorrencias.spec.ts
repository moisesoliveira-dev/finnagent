import {
  aplicarStatusNoConjunto,
  centavosNoMes,
  gradeDoLancamento,
  ocorrenciasDoLancamento,
  situacaoDaOcorrencia,
  situacaoDoLancamento,
  statusAgregado,
  termosTravados,
  transicaoDaOcorrencia,
} from "@finnagent/contracts";
import { describe, expect, it } from "vitest";
import { EXEMPLO, WORKFLOW_INICIAL } from "./exemplo.js";

const notebook = EXEMPLO[6]!;
const salario = EXEMPLO[0]!;

describe("ocorrências do lançamento", () => {
  it("repete o calendário atual quando nada foi gravado", () => {
    for (const entry of EXEMPLO) {
      for (let month = 0; month < 12; month += 1) {
        const comGrade = {
          ...entry,
          occurrences: gradeDoLancamento(entry),
        };
        expect(centavosNoMes(comGrade, WORKFLOW_INICIAL, 2026, month)).toBe(
          centavosNoMes(entry, WORKFLOW_INICIAL, 2026, month),
        );
      }
    }
  });

  it("tira do mês a ocorrência cancelada e mantém as outras", () => {
    const ocorrencias = gradeDoLancamento(notebook).map((item) =>
      item.number === 1 ? { ...item, status: "cancelled" as const, paidCents: null, paidOn: null } : item,
    );
    const lancamento = { ...notebook, occurrences: ocorrencias };
    expect(centavosNoMes(lancamento, WORKFLOW_INICIAL, 2026, 2)).toBeUndefined();
    expect(centavosNoMes(lancamento, WORKFLOW_INICIAL, 2026, 3)).toBe(notebook.cents);
  });

  it("marca como atrasada a pendente com vencimento anterior a hoje", () => {
    const [primeira] = ocorrenciasDoLancamento(salario);
    expect(primeira).toBeDefined();
    expect(situacaoDaOcorrencia(primeira!, "2026-10-20")).toBe("late");
    expect(situacaoDaOcorrencia({ ...primeira!, dueDate: "2026-12-05" }, "2026-10-20")).toBe("pending");
    expect(situacaoDoLancamento(salario, "2026-03-01")).toBe("pending");
    expect(situacaoDoLancamento(salario, "2026-10-20")).toBe("late");
  });

  it("paga, cancela e estorna uma ocorrência sem mexer nas outras", () => {
    const grade = gradeDoLancamento(notebook);
    const paga = transicaoDaOcorrencia(grade[0]!, "completed");
    expect(paga).toMatchObject({ status: "completed", paidCents: notebook.cents });
    expect(transicaoDaOcorrencia(grade[0]!, "refunded")).toBe("bloqueada");
    const conjunto = aplicarStatusNoConjunto(grade, "cancelled");
    expect(conjunto.every((item) => item.status === "cancelled")).toBe(true);
    expect(statusAgregado(conjunto)).toBe("cancelled");
    const misto = aplicarStatusNoConjunto(
      grade.map((item, index) => (index === 0 && paga !== "bloqueada" ? paga : item)),
      "cancelled",
    );
    expect(misto[0]?.status).toBe("completed");
    expect(misto[1]?.status).toBe("cancelled");
    expect(statusAgregado(misto)).toBe("completed");
  });

  it("trava os termos quando alguma ocorrência sai de pendente ou o extrato cruzou", () => {
    const grade = gradeDoLancamento(notebook);
    expect(termosTravados(grade, false)).toBe(false);
    expect(termosTravados(grade, true)).toBe(true);
    const paga = transicaoDaOcorrencia(grade[0]!, "completed");
    expect(paga).not.toBe("bloqueada");
    if (paga === "bloqueada") return;
    expect(termosTravados([paga, ...grade.slice(1)], false)).toBe(true);
  });
});
