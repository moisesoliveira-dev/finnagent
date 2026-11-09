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
  avisoDeConferenciaDesfeita,
  avisoDeExtratoLido,
  avisoDePlano,
  avisosDasMetas,
  avisosDeCartao,
  avisosDeLimite,
  atrasados,
  avisoDeTarefas,
  avisosDeGasto,
  vencimentosDeAmanha,
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
    askSpending: true,
    ...parcial,
  };
}

function metas(parcial: Partial<MetasResposta> = {}): MetasResposta {
  return {
    goals: [],
    surplusCents: 100_000,
    monthSurplusCents: 100_000,
    carriedCents: 0,
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

  it("a conferência desfeita pela fila avisa quem pediu, com a contagem, e a falha diz o motivo", () => {
    const [aviso] = avisoDeConferenciaDesfeita({ lines: 12, reactivated: 1, names: 0, orphans: 2, userId: "u1" }, "k1");
    expect(aviso).toMatchObject({ tipo: "extratos", titulo: "Conferência desfeita", destino: { tela: "conferencia", id: null }, chave: "desfazer-conferencia:k1", userId: "u1" });
    expect(aviso?.texto).toBe("12 linhas voltaram a pendente, 1 reativada, 0 nomes esquecidos e 2 lançamentos soltos apagados.");
    const [falha] = avisoDeConferenciaDesfeita({ lines: 0, reactivated: 0, names: 0, orphans: 0, userId: null, falhou: "Banco fora do ar." }, "k2");
    expect(falha).toMatchObject({ titulo: "Não foi possível desfazer a conferência", texto: "Banco fora do ar. Tente de novo em Configurações." });
    expect(falha).not.toHaveProperty("userId");
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

  it("avisa a sessão perto do limite uma vez por mês e, ao estourar, avisa de novo", () => {
    const usos = [
      { sessionId: "s1", sessionName: "Mercado", groupName: "Casa", limitCents: 100000, usedCents: 85000, percent: 85 },
      { sessionId: "s2", sessionName: "Uber", groupName: "Transporte", limitCents: 20000, usedCents: 26000, percent: 130 },
      { sessionId: "s3", sessionName: "Lazer", groupName: "Vida", limitCents: 30000, usedCents: 9000, percent: 30 },
    ];
    const avisos = avisosDeLimite(usos, "2026-11");
    expect(avisos.map((item) => [item.tipo, item.chave, item.titulo])).toEqual([
      ["limites", "limite:80:s1:2026-11", "Mercado perto do limite"],
      ["limites", "limite:100:s2:2026-11", "Uber passou do limite"],
    ]);
    expect(avisos[0]?.texto.replace(/ /g, " ")).toBe("R$ 850,00 de R$ 1.000,00 neste mês (85%). Faltam R$ 150,00.");
    expect(avisos[1]?.destino).toEqual({ tela: "financas", id: null });
  });

  it("avisa na véspera só a saída pendente, e no dia seguinte ao vencimento o que ficou sem marcar", () => {
    const saida = {
      id: "e1", description: "Parcela da TV", name: "", sessionName: "Casa",
      occurrences: [
        { number: 1, dueDate: "2026-11-07", plannedCents: -10000, paidCents: null, paidOn: null, status: "pending" },
        { number: 2, dueDate: "2026-11-05", plannedCents: -10000, paidCents: null, paidOn: null, status: "pending" },
        { number: 3, dueDate: "2026-10-30", plannedCents: -10000, paidCents: null, paidOn: null, status: "pending" },
      ],
    } as unknown as Lancamento;
    const entrada = {
      id: "e2", description: "Salário", name: "", sessionName: "Renda",
      occurrences: [
        { number: 1, dueDate: "2026-11-07", plannedCents: 500000, paidCents: null, paidOn: null, status: "pending" },
        { number: 2, dueDate: "2026-11-05", plannedCents: 500000, paidCents: null, paidOn: null, status: "pending" },
      ],
    } as unknown as Lancamento;
    const amanha = vencimentosDeAmanha([saida, entrada], "2026-11-06");
    expect(amanha.map((item) => item.chave)).toEqual(["vencimento:amanha:e1:1"]);
    expect(amanha[0]?.texto.replace(/\u00a0/g, " ")).toBe("Vence amanhã: R$ 100,00.");
    const atraso = atrasados([saida, entrada], "2026-11-06");
    // A parcela 2 e o salário venceram ontem (1 dia); a parcela 3 está com 7 dias, fora dos dias de aviso.
    expect(atraso.map((item) => item.chave)).toEqual(["atraso:e1:2:1", "atraso:e2:2:1"]);
    expect(atraso[0]?.texto).toContain("Venceu ontem e não foi marcado como pago");
    expect(atraso[1]?.texto).toContain("não foi marcada como recebida");
    expect(atrasados([saida], "2026-11-07").map((item) => item.chave)).toEqual(["atraso:e1:3:8"]);
    expect(atraso.every((item) => item.destino.tela === "hoje")).toBe(true);
  });

  it("pergunta do gasto só nas três horas depois do fim, uma vez por compromisso e dia", () => {
    const pergunta = {
      appointmentId: "c1", date: "2026-11-06", title: "Jantar", location: "", time: "19:00", endTime: "21:00", allDay: false,
      endedAt: "2026-11-07T00:00:00.000Z", endedAtLocal: "21:00", sessionId: "s1", sessionLabel: "Lazer / Saídas",
    };
    expect(avisosDeGasto([pergunta], new Date("2026-11-06T23:59:00.000Z"))).toEqual([]);
    const [aviso] = avisosDeGasto([pergunta], new Date("2026-11-07T00:10:00.000Z"));
    expect(aviso).toEqual({
      tipo: "gastos",
      titulo: "Teve gasto em Jantar?",
      texto: "Terminou às 21:00. Lance quanto foi, em Lazer / Saídas, ou diga que não teve.",
      destino: { tela: "hoje", id: null },
      chave: "gasto:c1:2026-11-06",
    });
    expect(avisosDeGasto([pergunta], new Date("2026-11-07T03:30:00.000Z"))).toEqual([]);
  });

  it("junta as tarefas abertas num aviso por dia", () => {
    expect(avisoDeTarefas([], "2026-11-06")).toEqual([]);
    const [aviso] = avisoDeTarefas(["Regar", "Ligar", "Pagar", "Ler"], "2026-11-06");
    expect(aviso?.titulo).toBe("4 tarefas ficaram abertas hoje");
    expect(aviso?.texto).toBe("Regar, Ligar, Pagar e mais 1. Marque o que fez; o resto passa para amanhã.");
    expect(aviso?.chave).toBe("tarefas:2026-11-06");
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

describe("avisos do cartão", () => {
  const conta = { id: "k1", name: "Nubank", kind: "cartao", openingCents: 0, openingOn: null, closingDay: 25, dueDay: 5, limitCents: 100_000 } as const;
  const fatura = (month: string, status: "aberta" | "fechada" | "vencida" | "paga", dueDate: string, closingDate: string) => ({ month, closingDate, dueDate, totalCents: 50_000, paidCents: 0, status, itens: 3 });

  it("avisa a fatura que fecha, a que vence, a vencida e o limite, uma vez cada", () => {
    const pedidos = avisosDeCartao(
      [
        {
          conta,
          faturas: [fatura("2026-09", "vencida", "2026-10-05", "2026-09-25"), fatura("2026-10", "fechada", "2026-11-11", "2026-10-25"), fatura("2026-11", "aberta", "2026-12-05", "2026-11-10")],
          limite: { usadoCents: 85_000, disponivelCents: 15_000, percent: 85 },
        },
      ],
      "2026-11-09",
    );
    expect(pedidos.map((p) => [p.chave, p.titulo])).toEqual([
      ["fatura:vencida:k1:2026-09", "Fatura do Nubank venceu"],
      ["fatura:vence:k1:2026-10", "Fatura do Nubank vence em 2 dias"],
      ["fatura:fecha:k1:2026-11", "Fatura do Nubank fecha amanhã"],
      ["cartao:limite:80:k1:2026-11", "Nubank perto do limite"],
    ]);
    expect(pedidos.every((p) => p.destino.tela === "contas" && p.destino.id === "k1")).toBe(true);
  });
});
