import { describe, expect, it } from "vitest";
import { ExtratosService } from "./extratos.service.js";

type Linha = { date: string | null; cents: number; description: string; entryId: string | null };

const TENANT = "00000000-0000-4000-8000-000000000001";
const EXTRATO = "00000000-0000-4000-8000-0000000000e1";
const SESSAO = "00000000-0000-4000-8000-0000000000s1";

/** O repositório e as finanças de mentira: só o que o lote usa. `semLancamento` é o que a conferência ainda mostra. */
function montar(linhas: Record<number, Linha>, semLancamento: (year: number, month: number) => number) {
  const lancadas: number[] = [];
  const extratos = {
    obterLinha: async (_tenant: string, _id: string, line: number) => linhas[line] ?? ("ausente" as const),
    confirmarCruzamento: async (_tenant: string, _id: string, line: number) => {
      lancadas.push(line);
      return "ok" as const;
    },
    contarSemLancamento: async (_tenant: string, year: number, month: number | null) => semLancamento(year, month ?? 0),
  };
  const financas = {
    criar: async () => ({ id: "00000000-0000-4000-8000-0000000000f1" }),
    pagarPeloExtrato: async () => undefined,
    excluir: async () => undefined,
  };
  const servico = new ExtratosService(
    extratos as never,
    null as never,
    null as never,
    financas as never,
    null as never,
    null as never,
  );
  return { servico, lancadas };
}

const linha = (date: string | null, cents = -5000, entryId: string | null = null): Linha => ({ date, cents, description: "MERCADO", entryId });

describe("lançar linhas do extrato em lote", () => {
  it("devolve quantas linhas ainda ficaram sem lançamento em cada mês que o lote tocou", async () => {
    const { servico, lancadas } = montar(
      { 1: linha("2026-10-05"), 2: linha("2026-10-12"), 3: linha("2026-11-02") },
      (year, month) => (year === 2026 && month === 10 ? 4 : month === 11 ? 0 : 99),
    );
    const resultado = await servico.acumularVarias(TENANT, [1, 2, 3].map((line) => ({ statementId: EXTRATO, line, sessionId: SESSAO })));
    expect(lancadas).toEqual([1, 2, 3]);
    expect(resultado.launched).toBe(3);
    expect(resultado.failed).toEqual([]);
    expect(resultado.remaining).toEqual([
      { year: 2026, month: 10, lines: 4 },
      { year: 2026, month: 11, lines: 0 },
    ]);
  });

  it("a linha que falha vai para failed, e o mês dela entra na contagem do que sobrou", async () => {
    const { servico } = montar({ 1: linha("2026-10-05"), 2: linha("2026-10-12", -3000, "ja-cruzada") }, () => 7);
    const resultado = await servico.acumularVarias(TENANT, [1, 2].map((line) => ({ statementId: EXTRATO, line, sessionId: SESSAO })));
    expect(resultado.launched).toBe(1);
    expect(resultado.failed).toEqual([{ statementId: EXTRATO, line: 2, message: "Essa linha já foi cruzada." }]);
    expect(resultado.remaining).toEqual([{ year: 2026, month: 10, lines: 7 }]);
  });

  it("linha que não existe não derruba o lote nem inventa um mês", async () => {
    const { servico } = montar({ 1: linha("2026-10-05") }, () => 2);
    const resultado = await servico.acumularVarias(TENANT, [1, 9].map((line) => ({ statementId: EXTRATO, line, sessionId: SESSAO })));
    expect(resultado.launched).toBe(1);
    expect(resultado.failed).toEqual([{ statementId: EXTRATO, line: 9, message: "Linha não encontrada." }]);
    expect(resultado.remaining).toEqual([{ year: 2026, month: 10, lines: 2 }]);
  });
});
