import {
  PREFERENCIAS_DE_NOTIFICACAO_PADRAO,
  categoriaDoTipo,
  emSilencio,
  modoDoValor,
  preferenciasDeNotificacaoDe,
  type Compromisso,
  type Lancamento,
  type MetasResposta,
} from "@finnagent/contracts";
import { describe, expect, it } from "vitest";
import {
  avisoDeConferencia,
  avisoDeExtratoLido,
  avisoDePlano,
  avisosDasMetas,
  canaisDePush,
  horaNoFuso,
  lembretesNaJanela,
  vencimentosDeHoje,
} from "./avisos.js";

const agora = new Date("2026-10-21T15:00:00.000Z");

function conta(parcial: Partial<Lancamento> & Pick<Lancamento, "id" | "cents" | "day">): Lancamento {
  const base = {
    groupId: "casa",
    groupName: "Casa",
    sessionId: "moradia",
    sessionName: "Moradia",
    type: "fixo" as const,
    description: "Aluguel",
    justification: "",
    startYear: 2026,
    startMonth: 1,
    installments: null,
    months: [],
    ...parcial,
  };
  return {
    ...base,
    name: base.description,
    date: "2026-01-21",
    mode: modoDoValor(base.cents),
    status: "pending",
    transactionType: "unusual",
    category: categoriaDoTipo(base.type),
    priority: "normal",
    installmentNumber: null,
    dueDate: null,
    interestRate: null,
    nextDueDate: null,
    suspendedCents: 0,
    commitmentId: null,
    adjustments: [],
    recurrence: "monthly",
    recurrenceInterval: 1,
    synced: false,
  };
}

function consulta(startAt: string, parcial: Partial<Compromisso> = {}): Compromisso {
  return {
    id: "consulta",
    title: "Consulta",
    description: "",
    location: "",
    startAt,
    endAt: startAt,
    allDay: false,
    status: "undone",
    year: 2026,
    month: 10,
    day: 21,
    time: "12:30",
    calendar: "Pessoal",
    timezone: "America/Sao_Paulo",
    category: "fixed",
    endYear: null,
    endMonth: null,
    endDay: null,
    entryId: null,
    link: null,
    sessionId: null,
    sessionLabel: null,
    spentCents: 0,
    ...parcial,
  };
}

function metas(parcial: Partial<MetasResposta> = {}): MetasResposta {
  return {
    goals: [],
    surplusCents: 100_000,
    separatedCents: 0,
    suggested: {},
    division: {},
    year: 2026,
    month: 10,
    ...parcial,
  };
}

const meta = { id: "viagem", name: "Viagem", targetCents: 500_000, savedCents: 100_000, dueYear: 2027, dueMonth: 6, sessionId: "s", position: 1 };

describe("avisos que viram notificação", () => {
  it("avisa o vencimento de hoje, com o valor, uma vez por ocorrência", () => {
    const pedidos = vencimentosDeHoje([conta({ id: "aluguel", cents: -150_000, day: 21 })], "2026-10-21");
    expect(pedidos).toHaveLength(1);
    expect(pedidos[0]).toMatchObject({ tipo: "vencimentos", titulo: "Aluguel", destino: { tela: "financas" } });
    expect(pedidos[0]?.texto).toContain("Vence hoje");
    expect(pedidos[0]?.texto).toContain("1.500,00");
    expect(pedidos[0]?.chave).toMatch(/^vencimento:aluguel:\d+$/);
    expect(vencimentosDeHoje([conta({ id: "aluguel", cents: -150_000, day: 22 })], "2026-10-21")).toEqual([]);
  });

  it("chama a entrada prevista de entrada, não de vencimento", () => {
    const [pedido] = vencimentosDeHoje([conta({ id: "salario", cents: 450_000, day: 21, description: "Salário" })], "2026-10-21");
    expect(pedido?.texto).toContain("Entrada prevista");
  });

  it("lembra o compromisso dentro da antecedência e ignora o que passou, o longe e o cumprido", () => {
    const hora = 60 * 60 * 1000;
    const perto = new Date(agora.getTime() + 30 * 60 * 1000).toISOString();
    const pedidos = lembretesNaJanela(
      [
        consulta(perto),
        consulta(new Date(agora.getTime() + 2 * hora).toISOString(), { id: "longe" }),
        consulta(new Date(agora.getTime() - 60_000).toISOString(), { id: "passou" }),
        consulta(perto, { id: "feito", status: "done" }),
      ],
      agora,
      hora,
      "2026-10-21",
    );
    expect(pedidos.map((item) => item.chave)).toEqual([`lembrete:consulta:${perto}`]);
    expect(pedidos[0]?.texto).toBe("Hoje às 12:30.");
  });

  it("diz amanhã quando o compromisso é no dia seguinte", () => {
    const amanha = new Date(agora.getTime() + 20 * 60 * 60 * 1000).toISOString();
    const [pedido] = lembretesNaJanela([consulta(amanha, { day: 22, allDay: true })], agora, 24 * 60 * 60 * 1000, "2026-10-21");
    expect(pedido?.texto).toBe("Amanhã, o dia inteiro.");
  });

  it("junta as linhas sem lançamento num aviso por dia", () => {
    expect(avisoDeConferencia(0, "2026-10-21")).toEqual([]);
    const [um] = avisoDeConferencia(1, "2026-10-21");
    expect(um?.texto).toContain("1 linha");
    const [varias] = avisoDeConferencia(3, "2026-10-21");
    expect(varias).toMatchObject({ chave: "conferencia:2026-10-21", destino: { tela: "conferencia" } });
  });

  it("avisa o fim da leitura do extrato e a falha, mas não o que ainda processa", () => {
    const extrato = { id: "e1", filename: "extrato.pdf", lineCount: 12 };
    expect(avisoDeExtratoLido({ ...extrato, status: "processando" })).toEqual([]);
    expect(avisoDeExtratoLido({ ...extrato, status: "importado" })[0]).toMatchObject({ titulo: "Extrato lido", destino: { tela: "conferencia" } });
    expect(avisoDeExtratoLido({ ...extrato, status: "falhou" })[0]).toMatchObject({ destino: { tela: "extratos" } });
  });

  it("avisa a meta alcançada uma vez e não pede mais nada dela", () => {
    const pedidos = avisosDasMetas(
      metas({ goals: [{ ...meta, savedCents: 500_000 }], suggested: { viagem: 10_000 } }),
      "2026-10-25",
    );
    expect(pedidos.map((item) => item.chave)).toEqual(["meta:alcancada:viagem"]);
  });

  it("avisa o prazo no mês e a parte sem separar só a partir do dia 20", () => {
    const resposta = metas({ goals: [{ ...meta, dueYear: 2026, dueMonth: 10 }], suggested: { viagem: 40_000 } });
    expect(avisosDasMetas(resposta, "2026-10-10").map((item) => item.chave)).toEqual(["meta:prazo:viagem:2026-10"]);
    expect(avisosDasMetas(resposta, "2026-10-20").map((item) => item.chave)).toEqual([
      "meta:prazo:viagem:2026-10",
      "meta:parte:viagem:2026-10",
    ]);
    const aprovada = { ...resposta, division: { viagem: { percent: 40, cents: 40_000, approved: true } } };
    expect(avisosDasMetas(aprovada, "2026-10-25").map((item) => item.chave)).toEqual(["meta:prazo:viagem:2026-10"]);
  });

  it("manda o plano parado só para quem abriu a conversa", () => {
    const pedido = avisoDePlano({ conversaId: "c1", userId: "u1", titulo: "Mercado", mensagemId: "m1" });
    expect(pedido).toMatchObject({ userId: "u1", destino: { tela: "assistente", id: "c1" }, chave: "assistente:plano:c1:m1" });
  });
});

describe("preferências e entrega", () => {
  it("lê a hora no fuso da conta", () => {
    expect(horaNoFuso("America/Sao_Paulo", agora)).toBe("12:00");
    expect(horaNoFuso("UTC", new Date("2026-10-21T00:05:00.000Z"))).toBe("00:05");
  });

  it("silencia dentro da janela, inclusive a que atravessa a meia-noite", () => {
    const noite = { ativo: true, inicio: "22:00", fim: "07:00" };
    expect(emSilencio(noite, "23:30")).toBe(true);
    expect(emSilencio(noite, "06:59")).toBe(true);
    expect(emSilencio(noite, "07:00")).toBe(false);
    expect(emSilencio(noite, "12:00")).toBe(false);
    expect(emSilencio({ ativo: true, inicio: "13:00", fim: "14:00" }, "13:30")).toBe(true);
    expect(emSilencio({ ...noite, ativo: false }, "23:30")).toBe(false);
  });

  it("manda o push pelos canais ligados do tipo e por nenhum no silêncio", () => {
    const preferencias = {
      ...PREFERENCIAS_DE_NOTIFICACAO_PADRAO,
      canais: { ...PREFERENCIAS_DE_NOTIFICACAO_PADRAO.canais, metas: { central: true, celular: true, navegador: false } },
      silencio: { ativo: true, inicio: "22:00", fim: "07:00" },
    };
    expect(canaisDePush(preferencias, "vencimentos", "12:00")).toEqual(["celular", "navegador"]);
    expect(canaisDePush(preferencias, "metas", "12:00")).toEqual(["celular"]);
    expect(canaisDePush(preferencias, "vencimentos", "23:00")).toEqual([]);
  });

  it("completa o que veio gravado com o padrão e descarta o que não vale", () => {
    expect(preferenciasDeNotificacaoDe(null)).toEqual(PREFERENCIAS_DE_NOTIFICACAO_PADRAO);
    const lidas = preferenciasDeNotificacaoDe({
      canais: { metas: { central: false, celular: false, navegador: false }, extratos: { central: "sim" } },
      silencio: { ativo: true, inicio: "25:00", fim: "07:00" },
    });
    expect(lidas.canais.metas.central).toBe(false);
    expect(lidas.canais.extratos).toEqual(PREFERENCIAS_DE_NOTIFICACAO_PADRAO.canais.extratos);
    expect(lidas.silencio).toEqual(PREFERENCIAS_DE_NOTIFICACAO_PADRAO.silencio);
  });
});
