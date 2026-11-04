import { describe, expect, it } from "vitest";
import { ExtratosService } from "./extratos.service.js";

type Linha = {
  date: string | null;
  cents: number;
  description: string;
  entryId: string | null;
  entryCreated?: boolean;
  ignored?: boolean;
  parts?: { entryId: string; cents: number; created: boolean }[];
};

const TENANT = "00000000-0000-4000-8000-000000000001";
const EXTRATO = "00000000-0000-4000-8000-0000000000e1";
const SESSAO = "00000000-0000-4000-8000-0000000000s1";

/** O repositório e as finanças de mentira: só o que o lote usa. `semLancamento` é o que a conferência ainda mostra. */
function montar(
  linhas: Record<number, Linha>,
  semLancamento: (year: number, month: number) => number,
  // A transação da sessão Fixo. Com `sessionId`, só essa sessão é a fixa.
  fixa: { entryId: string; sessionId?: string } | null = null,
  lancamentoDaFixa: unknown = null,
  usadas = 0,
  falharNaParte: number | null = null,
) {
  const lancadas: number[] = [];
  const ignoradas: { quantas: number; ignorar: boolean }[] = [];
  const lembrados: unknown[] = [];
  const divididas: { line: number; partes: unknown[]; lembrar: unknown[] }[] = [];
  const nomes: string[] = [];
  const excluidas: string[] = [];
  const reabertas: { entryId: string; cents: number }[] = [];
  const criadosPelaLinha: boolean[] = [];
  const extratos = {
    obterLinha: async (_tenant: string, _id: string, line: number) => linhas[line] ?? ("ausente" as const),
    confirmarCruzamento: async (
      _tenant: string,
      _id: string,
      line: number,
      _entry: string,
      _alias: unknown,
      lembrar: unknown,
      criado = false,
    ) => {
      lancadas.push(line);
      criadosPelaLinha.push(criado);
      if (lembrar) lembrados.push(lembrar);
      return "ok" as const;
    },
    contarSemLancamento: async (_tenant: string, year: number, month: number | null) => semLancamento(year, month ?? 0),
    contarLinhasDoLancamento: async () => usadas,
    dividirLinha: async (_tenant: string, _id: string, line: number, partes: unknown[], lembrar: unknown[]) => {
      divididas.push({ line, partes, lembrar });
    },
    desfazerDivisao: async (_tenant: string, _id: string, line: number) => linhas[line]?.parts ?? [],
    desfazerCruzamento: async (_tenant: string, _id: string, line: number) => {
      const gravada = linhas[line];
      return gravada?.entryId ? { entryId: gravada.entryId, created: gravada.entryCreated === true } : ("livre" as const);
    },
    listarNomes: async () => [],
    ignorarLinhas: async (_tenant: string, itens: unknown[], ignorar: boolean) => {
      ignoradas.push({ quantas: itens.length, ignorar });
      return itens.length;
    },
  };
  const criadas: { emPartes: boolean }[] = [];
  const pagas: { entryId: string; cents: number }[] = [];
  const financas = {
    lancamentoDaSessaoFixa: async (_tenant: string, sessionId: string) =>
      fixa && (!fixa.sessionId || fixa.sessionId === sessionId) ? { entryId: fixa.entryId } : null,
    criar: async (_tenant: string, pedido: { name: string; cents: number }, emPartes = false) => {
      criadas.push({ emPartes });
      nomes.push(pedido.name);
      if (falharNaParte !== null && criadas.length === falharNaParte) throw new Error("Sessão não encontrada.");
      return { id: `00000000-0000-4000-8000-0000000000f${criadas.length}` };
    },
    obterAberto: async () => lancamentoDaFixa,
    pagarPeloExtrato: async (_tenant: string, entryId: string, _date: string, cents: number) => {
      pagas.push({ entryId, cents });
    },
    excluir: async (_tenant: string, id: string) => {
      excluidas.push(id);
    },
    reabrirPeloExtrato: async (_tenant: string, entryId: string, _date: string, cents: number) => {
      reabertas.push({ entryId, cents });
    },
  };
  const servico = new ExtratosService(
    extratos as never,
    null as never,
    null as never,
    financas as never,
    null as never,
    null as never,
  );
  return { servico, lancadas, criadas, pagas, ignoradas, divididas, nomes, excluidas, reabertas, lembrados, criadosPelaLinha };
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

  describe("sessão Fixo que já tem a transação", () => {
    const FIXA = "00000000-0000-4000-8000-0000000000f9";
    const dela = (cents: number) => ({
      id: FIXA,
      name: "Aluguel",
      category: "unique",
      groupName: "Casa",
      sessionName: "Aluguel",
      sessionId: SESSAO,
      occurrences: [{ number: 1, dueDate: "2026-10-05", status: "pending", plannedCents: cents, paidCents: null }],
    });
    const pedido = (extra: Record<string, unknown> = {}) => [{ statementId: EXTRATO, line: 1, sessionId: SESSAO, ...extra }];

    it("cruza com a transação em vez de criar outra, quando os valores batem", async () => {
      const { servico, criadas, pagas } = montar({ 1: linha("2026-10-05", -5000) }, () => 0, { entryId: FIXA }, dela(-5000));
      const resultado = await servico.acumularVarias(TENANT, pedido());
      expect(resultado.launched).toBe(1);
      expect(criadas).toEqual([]);
      expect(pagas).toEqual([{ entryId: FIXA, cents: -5000 }]);
    });

    it("com valores diferentes não lança e pede a escolha", async () => {
      const { servico, criadas, pagas, lancadas } = montar({ 1: linha("2026-10-05", -5000) }, () => 1, { entryId: FIXA }, dela(-4000));
      const resultado = await servico.acumularVarias(TENANT, pedido());
      expect(resultado.launched).toBe(0);
      expect(resultado.failed[0]?.message).toContain("Escolha o valor");
      expect([criadas, pagas, lancadas]).toEqual([[], [], []]);
    });

    it("obedece a escolha do valor", async () => {
      const { servico, pagas } = montar({ 1: linha("2026-10-05", -5000) }, () => 0, { entryId: FIXA }, dela(-4000));
      await servico.acumularVarias(TENANT, pedido({ valor: "lancamento" }));
      expect(pagas).toEqual([{ entryId: FIXA, cents: -4000 }]);
    });

    it("recusa outra linha quando a transação já foi conciliada, e diz como liberar", async () => {
      const { servico, criadas } = montar({ 1: linha("2026-10-05", -5000) }, () => 1, { entryId: FIXA }, dela(-5000), 1);
      const resultado = await servico.acumularVarias(TENANT, pedido());
      expect(resultado.launched).toBe(0);
      expect(resultado.failed[0]?.message).toContain("Paga em partes");
      expect(criadas).toEqual([]);
    });

    it("'paga em partes' libera mais uma transação na sessão", async () => {
      const { servico, criadas } = montar({ 1: linha("2026-10-05", -5000) }, () => 0, { entryId: FIXA }, dela(-5000), 1);
      const resultado = await servico.acumularVarias(TENANT, pedido({ emPartes: true }));
      expect(resultado.launched).toBe(1);
      expect(criadas).toEqual([{ emPartes: true }]);
    });
  });

  describe("linhas ignoradas", () => {
    it("não deixa lançar uma linha ignorada e diz como voltar", async () => {
      const { servico, criadas } = montar({ 1: { ...linha("2026-10-05"), ignored: true } }, () => 0);
      const resultado = await servico.acumularVarias(TENANT, [{ statementId: EXTRATO, line: 1, sessionId: SESSAO }]);
      expect(resultado.launched).toBe(0);
      expect(resultado.failed[0]?.message).toContain("Reative-a");
      expect(criadas).toEqual([]);
    });

    it("ignorar e reativar passam as linhas ao repositório e devolvem quantas mudaram", async () => {
      const { servico, ignoradas } = montar({}, () => 0);
      const itens = [1, 2, 3].map((line) => ({ statementId: EXTRATO, line }));
      expect(await servico.ignorar(TENANT, itens, true)).toEqual({ changed: 3 });
      expect(await servico.ignorar(TENANT, itens.slice(0, 1), false)).toEqual({ changed: 1 });
      expect(ignoradas).toEqual([{ quantas: 3, ignorar: true }, { quantas: 1, ignorar: false }]);
    });
  });

  describe("dividir a linha e dar nome", () => {
    const SESSAO_2 = "00000000-0000-4000-8000-0000000000s2";

    it("cria um lançamento por parte, com o nome de cada uma, e lembra só o nome diferente da descrição", async () => {
      const { servico, divididas, nomes, pagas } = montar({ 1: linha("2026-10-05", -10000) }, () => 0);
      servico.conferencia = async () => ({}) as never;
      await servico.dividir(TENANT, EXTRATO, 1, [
        { cents: -6000, sessionId: SESSAO, nome: "Almoço" },
        { cents: -4000, sessionId: SESSAO_2 },
      ]);
      expect(nomes).toEqual(["Almoço", "MERCADO"]);
      expect(pagas.map((paga) => paga.cents)).toEqual([-6000, -4000]);
      expect(divididas).toEqual([
        {
          line: 1,
          partes: [
            { entryId: "00000000-0000-4000-8000-0000000000f1", cents: -6000, created: true },
            { entryId: "00000000-0000-4000-8000-0000000000f2", cents: -4000, created: true },
          ],
          lembrar: [{ key: "mercado", name: "Almoço" }],
        },
      ]);
    });

    it("recusa partes que não somam a linha, sem criar nada", async () => {
      const { servico, criadas } = montar({ 1: linha("2026-10-05", -10000) }, () => 0);
      await expect(servico.dividir(TENANT, EXTRATO, 1, [{ cents: -6000, sessionId: SESSAO }, { cents: -3000, sessionId: SESSAO }])).rejects.toThrow(
        "faltam",
      );
      expect(criadas).toEqual([]);
    });

    it("se uma parte falha, apaga as que já tinha criado", async () => {
      const { servico, excluidas, divididas } = montar({ 1: linha("2026-10-05", -10000) }, () => 0, null, null, 0, 2);
      await expect(servico.dividir(TENANT, EXTRATO, 1, [{ cents: -6000, sessionId: SESSAO }, { cents: -4000, sessionId: SESSAO }])).rejects.toThrow(
        "Sessão não encontrada.",
      );
      expect(excluidas).toEqual(["00000000-0000-4000-8000-0000000000f1"]);
      expect(divididas).toEqual([]);
    });

    it("desfazer a linha dividida apaga os lançamentos criados e reabre a fixa que uma parte pagou", async () => {
      const partes = [
        { entryId: "fixa", cents: -6000, created: false },
        { entryId: "parte-2", cents: -4000, created: true },
      ];
      const { servico, excluidas, reabertas } = montar({ 1: { ...linha("2026-10-05", -10000, "fixa"), parts: partes } }, () => 0);
      servico.conferencia = async () => ({}) as never;
      await servico.desfazer(TENANT, EXTRATO, 1);
      expect(excluidas).toEqual(["parte-2"]);
      expect(reabertas).toEqual([{ entryId: "fixa", cents: -6000 }]);
    });

    describe("parte que vai para uma sessão Fixo já lançada", () => {
      const FIXA = "00000000-0000-4000-8000-0000000000f9";
      const dela = {
        id: FIXA,
        name: "Salário",
        category: "unique",
        groupName: "Salário",
        sessionName: "Automi",
        sessionId: SESSAO,
        occurrences: [{ number: 1, dueDate: "2026-10-05", status: "pending", plannedCents: 75000, paidCents: null }],
      };

      it("paga a transação da fixa com o valor da parte, e só a outra parte vira lançamento novo", async () => {
        const { servico, criadas, pagas, divididas } = montar(
          { 1: linha("2026-10-05", 149014) },
          () => 0,
          { entryId: FIXA, sessionId: SESSAO },
          dela,
        );
        servico.conferencia = async () => ({}) as never;
        await servico.dividir(TENANT, EXTRATO, 1, [
          { cents: 75251, sessionId: SESSAO, nome: "Não vale para a fixa" },
          { cents: 73763, sessionId: SESSAO_2, nome: "TNA" },
        ]);
        expect(criadas).toEqual([{ emPartes: false }]);
        expect(pagas).toEqual([
          { entryId: FIXA, cents: 75251 },
          { entryId: "00000000-0000-4000-8000-0000000000f1", cents: 73763 },
        ]);
        expect(divididas[0]?.partes).toEqual([
          { entryId: FIXA, cents: 75251, created: false },
          { entryId: "00000000-0000-4000-8000-0000000000f1", cents: 73763, created: true },
        ]);
        expect(divididas[0]?.lembrar).toEqual([{ key: "mercado", name: "TNA" }]);
      });

      it("recusa, sem criar nada, quando a fixa já foi paga neste mês", async () => {
        const { servico, criadas, pagas } = montar(
          { 1: linha("2026-10-05", 149014) },
          () => 0,
          { entryId: FIXA, sessionId: SESSAO },
          dela,
          1,
        );
        await expect(
          servico.dividir(TENANT, EXTRATO, 1, [
            { cents: 75251, sessionId: SESSAO },
            { cents: 73763, sessionId: SESSAO_2 },
          ]),
        ).rejects.toThrow("parte 1 já foi paga");
        expect([criadas, pagas]).toEqual([[], []]);
      });

      it("se a parte seguinte falha, a fixa volta a pendente", async () => {
        const { servico, reabertas, divididas } = montar(
          { 1: linha("2026-10-05", 149014) },
          () => 0,
          { entryId: FIXA, sessionId: SESSAO },
          dela,
          0,
          1,
        );
        await expect(
          servico.dividir(TENANT, EXTRATO, 1, [
            { cents: 75251, sessionId: SESSAO },
            { cents: 73763, sessionId: SESSAO_2 },
          ]),
        ).rejects.toThrow("Sessão não encontrada.");
        expect(reabertas).toEqual([{ entryId: FIXA, cents: 75251 }]);
        expect(divididas).toEqual([]);
      });
    });

    it("acumular com outro nome usa esse nome e o lembra para a próxima linha igual", async () => {
      const { servico, nomes, lembrados } = montar({ 1: linha("2026-10-05", -5000) }, () => 0);
      await servico.acumularVarias(TENANT, [{ statementId: EXTRATO, line: 1, sessionId: SESSAO, nome: "Feira do sábado" }]);
      expect(nomes).toEqual(["Feira do sábado"]);
      expect(lembrados).toEqual([{ key: "mercado", name: "Feira do sábado" }]);
    });

    it("acumular marca que o lançamento nasceu da linha", async () => {
      const { servico, criadosPelaLinha } = montar({ 1: linha("2026-10-05", -5000) }, () => 0);
      await servico.acumularVarias(TENANT, [{ statementId: EXTRATO, line: 1, sessionId: SESSAO }]);
      expect(criadosPelaLinha).toEqual([true]);
    });

    it("desfazer o acúmulo apaga o lançamento, como se a linha nunca tivesse sido lançada", async () => {
      const { servico, excluidas, reabertas } = montar(
        { 1: { ...linha("2026-10-05", -5000, "criado"), entryCreated: true } },
        () => 0,
      );
      servico.conferencia = async () => ({}) as never;
      await servico.desfazer(TENANT, EXTRATO, 1);
      expect(excluidas).toEqual(["criado"]);
      expect(reabertas).toEqual([]);
    });

    it("desfazer o cruzamento com um lançamento que já existia só reabre ele", async () => {
      const { servico, excluidas, reabertas } = montar({ 1: linha("2026-10-05", -5000, "existente") }, () => 0);
      servico.conferencia = async () => ({}) as never;
      await servico.desfazer(TENANT, EXTRATO, 1);
      expect(excluidas).toEqual([]);
      expect(reabertas).toEqual([{ entryId: "existente", cents: -5000 }]);
    });

    it("acumular com o próprio nome da descrição não guarda nome novo", async () => {
      const { servico, lembrados } = montar({ 1: linha("2026-10-05", -5000) }, () => 0);
      await servico.acumularVarias(TENANT, [{ statementId: EXTRATO, line: 1, sessionId: SESSAO, nome: "Mercado" }]);
      expect(lembrados).toEqual([]);
    });
  });
});

