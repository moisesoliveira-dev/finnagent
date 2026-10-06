import {
  centavosNoMes,
  colunasDoAno,
  encerraNoMes,
  indiceDaParcela,
  somaDosCentavos,
  textoDaLinha,
  totaisDoMes,
} from "@finnagent/contracts";
import { EXEMPLO, WORKFLOW_INICIAL } from "./exemplo.js";

const salario = EXEMPLO[0]!;
const freelance = EXEMPLO[1]!;
const aluguel = EXEMPLO[2]!;
const notebook = EXEMPLO[6]!;
const emprestimo = EXEMPLO[7]!;

describe("regras de finanças", () => {
  it("começa as colunas no mês do workflow e mostra o ano seguinte inteiro", () => {
    expect(colunasDoAno(WORKFLOW_INICIAL, 2025)).toEqual([]);
    expect(colunasDoAno(WORKFLOW_INICIAL, 2026)).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(colunasDoAno(WORKFLOW_INICIAL, 2027)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  });

  it("esconde o lançamento do primeiro mês quando o dia é anterior ao workflow", () => {
    const workflow = { year: 2026, month: 3, day: 2 };
    expect(centavosNoMes(aluguel, workflow, 2026, 2)).toBeUndefined();
    expect(centavosNoMes(salario, workflow, 2026, 2)).toBe(620_000);
  });

  it("soma outubro de 2026 em 2703,70", () => {
    expect(totaisDoMes(EXEMPLO, WORKFLOW_INICIAL, 2026, 9)).toEqual({
      entradas: 620_000,
      saidas: -349_630,
      sobra: 270_370,
    });
  });

  it("soma o grupo a partir dos lançamentos do mês", () => {
    const moradia = EXEMPLO.filter((entry) => entry.groupName === "Moradia");
    const valores = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((month) =>
      somaDosCentavos(
        moradia.map((entry) => centavosNoMes(entry, WORKFLOW_INICIAL, 2026, month)),
      ),
    );
    expect(valores[7]).toBe(-240_730);
  });

  it("mantém o fixo nos anos seguintes e encerra parcela e empréstimo", () => {
    expect(centavosNoMes(salario, WORKFLOW_INICIAL, 2027, 0)).toBe(620_000);
    expect(centavosNoMes(freelance, WORKFLOW_INICIAL, 2026, 4)).toBe(250_000);
    expect(centavosNoMes(freelance, WORKFLOW_INICIAL, 2026, 2)).toBeUndefined();
    expect(centavosNoMes(emprestimo, WORKFLOW_INICIAL, 2026, 8)).toBe(-52_000);
    expect(centavosNoMes(emprestimo, WORKFLOW_INICIAL, 2026, 9)).toBeUndefined();
    expect(encerraNoMes(notebook, 2026, 11)).toBe(true);
    expect(encerraNoMes(notebook, 2026, 10)).toBe(false);
    expect(encerraNoMes(emprestimo, 2026, 8)).toBe(true);
    expect(encerraNoMes(salario, 2026, 11)).toBe(false);
  });

  it("descreve prazo, avulso e variação", () => {
    expect(textoDaLinha(notebook)).toBe("10 parcelas · termina em dez");
    expect(textoDaLinha(emprestimo)).toBe("7 parcelas · termina em set");
    expect(textoDaLinha(salario)).toBe("Sem fim definido");
    expect(textoDaLinha(freelance)).toBe("Avulso");
    expect(textoDaLinha(EXEMPLO[4]!)).toBe("Varia a cada mês");
  });

  it("numera a parcela a partir do primeiro mês visível", () => {
    const colunas = colunasDoAno(WORKFLOW_INICIAL, 2026);
    expect(indiceDaParcela(notebook, WORKFLOW_INICIAL, 2026, 9, colunas)).toBe(8);
    expect(indiceDaParcela(salario, WORKFLOW_INICIAL, 2026, 9, colunas)).toBeUndefined();
  });
});
