import { CALENDARIO_NACIONAL, PADROES_DE_VENCIMENTO_INICIAIS, type Lancamento, type Ocorrencia } from "@finnagent/contracts";
import { describe, expect, it } from "vitest";
import { fatosDoPlano, type BaseDaRealidade } from "./fatos-do-plano.js";
import { validarPlano, type PassoValidado } from "./plano.js";

const base = (hoje: string): BaseDaRealidade => ({
  entries: [],
  hoje,
  padroes: PADROES_DE_VENCIMENTO_INICIAIS,
  calendario: CALENDARIO_NACIONAL,
});

function lancamento(args: Record<string, unknown>): PassoValidado {
  return { ferramenta: "criar_lancamento", descricao: "lançar", args, idGerado: "x", destrutiva: false };
}

const fixa = (extra: Record<string, unknown>) =>
  lancamento({ category: "fixed", recurrence: "monthly", recurrenceInterval: 1, ...extra });

describe("fatos do plano", () => {
  it("o salário do dia 30 que cai no sábado vem na sexta, pela regra de antecipar", () => {
    const fatos = fatosDoPlano(
      [fixa({ name: "Salário", date: "2026-05-30", mode: "inflows", cents: 300000, dueRule: { tipo: "dia", ajuste: "antecipar" } })],
      base("2026-05-04"),
    );
    expect(fatos.passos[0]?.datas[0]).toEqual({ data: "2026-05-29", base: "2026-05-30", feriado: null });
    expect(fatos.mes).toEqual({ ano: 2026, mes: 5, sobraAntesCents: 0, sobraDepoisCents: 300000 });
  });

  it("a conta que vence em feriado vai para o dia útil seguinte pelo padrão da conta (saída adia)", () => {
    // 2 de novembro de 2026 é Finados, numa segunda.
    const fatos = fatosDoPlano([fixa({ name: "Aluguel", date: "2026-11-02", mode: "outflows", cents: 150000 })], base("2026-11-01"));
    expect(fatos.passos[0]?.datas[0]).toMatchObject({ data: "2026-11-03", base: "2026-11-02" });
    expect(fatos.passos[0]?.datas[0]?.feriado).toBeTruthy();
  });

  it("aponta a conta que vence antes de o dinheiro entrar e as fixas acima de metade da renda", () => {
    const fatos = fatosDoPlano(
      [
        fixa({ name: "Salário", date: "2026-10-30", mode: "inflows", cents: 300000, dueRule: { tipo: "dia", ajuste: "antecipar" } }),
        fixa({ name: "Aluguel", date: "2026-10-05", mode: "outflows", cents: 200000 }),
      ],
      base("2026-10-01"),
    );
    expect(fatos.mes).toMatchObject({ sobraAntesCents: 0, sobraDepoisCents: 100000 });
    expect(fatos.alertas).toEqual([
      "Aluguel vence dia 5, antes da primeira entrada de outubro (dia 30).",
      "As contas fixas somam 67% das entradas de outubro.",
    ]);
  });

  it("avisa a sobra negativa e ignora passos que não lançam dinheiro", () => {
    const fatos = fatosDoPlano(
      [
        { ferramenta: "criar_grupo", descricao: "grupo", args: { name: "Casa" }, idGerado: "g", destrutiva: false },
        lancamento({ name: "Notebook", date: "2026-10-10", mode: "outflows", category: "unique", cents: 50000 }),
      ],
      base("2026-10-01"),
    );
    expect(fatos.passos).toHaveLength(1);
    expect(fatos.passos[0]).toMatchObject({ passo: 2, valorCents: -50000, recorrente: false });
    expect(fatos.alertas).toHaveLength(1);
    expect(fatos.alertas[0]?.replace(/\s/g, " ")).toBe("A sobra de outubro fica em -R$ 500,00.");
  });

  it("plano sem lançamento não tem mês nem alerta", () => {
    expect(fatosDoPlano([], base("2026-10-01"))).toEqual({ mes: null, passos: [], alertas: [] });
  });

  it("soma o lançamento novo e tira o que o plano apaga ou cancela", () => {
    const conta = base("2026-10-01");
    conta.entries = [gravado("aluguel", "Aluguel", [ocorrencia("2026-10-05", -180000)])];
    const fatos = fatosDoPlano(
      [
        lancamento({ name: "Extra", date: "2026-10-20", mode: "inflows", category: "unique", cents: 300000 }),
        passo("excluir_lancamento", { id: "aluguel", resumo: "o aluguel" }),
        passo("cancelar_fixo_no_mes", { id: "luz", year: 2026, month: 10, resumo: "a luz" }),
      ],
      { ...conta, entries: [...conta.entries, gravado("luz", "Luz", [ocorrencia("2026-10-08", -8000)])] },
    );
    expect(fatos.mes).toEqual({ ano: 2026, mes: 10, sobraAntesCents: -188000, sobraDepoisCents: 300000 });
    expect(fatos.passos.map((item) => item.valorCents)).toEqual([300000, -180000, -8000]);
  });

  it("troca o valor editado na sobra do mês", () => {
    const fatos = fatosDoPlano(
      [
        passo("editar_lancamento", {
          id: "note",
          name: "Notebook",
          category: "unique",
          date: "2026-10-10",
          mode: "outflows",
          cents: 20000,
        }),
      ],
      { ...base("2026-10-01"), entries: [gravado("note", "Notebook", [ocorrencia("2026-10-10", -50000)], "unique")] },
    );
    expect(fatos.mes).toEqual({ ano: 2026, mes: 10, sobraAntesCents: -50000, sobraDepoisCents: -20000 });
  });

  it("troca o valor planejado pelo que a pessoa escolheu no extrato", () => {
    const fatos = fatosDoPlano(
      [],
      { ...base("2026-10-01"), entries: [gravado("aluguel", "Aluguel", [ocorrencia("2026-10-05", -3434)])] },
      [
        {
          passo: 1,
          data: "2026-10-05",
          escolhido: -1178,
          planejado: -3434,
          entryId: "aluguel",
          nome: "Aluguel",
          nota: "Neste mês vale o extrato.",
        },
      ],
    );
    expect(fatos.mes).toEqual({ ano: 2026, mes: 10, sobraAntesCents: -3434, sobraDepoisCents: -1178 });
    expect(fatos.passos[0]?.nota).toBe("Neste mês vale o extrato.");
  });

  it("tira da sobra o lançamento pendente que o plano cancela", () => {
    const fatos = fatosDoPlano([passo("alterar_status_lancamento", { id: "aluguel", status: "cancelled" })], {
      ...base("2026-10-01"),
      entries: [gravado("aluguel", "Aluguel", [ocorrencia("2026-10-05", -180000)])],
    });
    expect(fatos.mes).toMatchObject({ sobraAntesCents: -180000, sobraDepoisCents: 0 });
  });
});

function passo(ferramenta: string, args: Record<string, unknown>): PassoValidado {
  return { ferramenta, descricao: ferramenta, args, idGerado: "gerado", destrutiva: true };
}

function ocorrencia(dueDate: string, plannedCents: number): Ocorrencia {
  return { number: 1, dueDate, plannedCents, paidCents: null, paidOn: null, status: "pending" };
}

function gravado(id: string, name: string, occurrences: Ocorrencia[], category: "fixed" | "unique" = "fixed"): Lancamento {
  return { id, name, category, occurrences } as Lancamento;
}

describe("validação do plano", () => {
  it("troca as referências dentro de listas e objetos pelos ids dados aos passos que criam", () => {
    let n = 0;
    const gerar = () => `00000000-0000-4000-8000-00000000000${++n}`;
    const plano = validarPlano(
      {
        objetivo: "Meta com divisão",
        entendimento: "É dinheiro guardado.",
        passos: [
          { ferramenta: "criar_meta", descricao: "Criar a meta", args: { name: "Viagem", targetCents: 500000 } },
          { ferramenta: "dividir_sobra_das_metas", descricao: "Dividir", args: { percents: [{ id: "@passo:1", percent: 30 }] } },
        ],
      },
      gerar,
    );
    expect(typeof plano).toBe("object");
    if (typeof plano === "string") return;
    expect(plano.suposicoes).toEqual([]);
    expect(plano.passos[1]?.args).toEqual({ percents: [{ id: plano.passos[0]?.idGerado, percent: 30 }] });
  });

  it("recusa referência a passo que não cria nada e argumentos inválidos", () => {
    const gerar = () => crypto.randomUUID();
    expect(
      validarPlano(
        {
          objetivo: "Apagar e criar",
          entendimento: "Troca a meta.",
          passos: [
            { ferramenta: "excluir_meta", descricao: "Apagar", args: { id: crypto.randomUUID(), resumo: "a meta" } },
            { ferramenta: "criar_sessao", descricao: "Sessão", args: { groupId: "@passo:1", name: "S", kind: "acumulo" } },
          ],
        },
        gerar,
      ),
    ).toContain("aponta para um passo que não cria nada");
    expect(
      validarPlano({ objetivo: "Criar meta", entendimento: "Meta nova.", passos: [{ ferramenta: "criar_meta", descricao: "Meta", args: { name: "" } }] }, gerar),
    ).toContain("Passo 1 (criar_meta)");
  });
});
