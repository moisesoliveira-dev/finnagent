import {
  ajustarTransacao,
  categoriaDoTipo,
  categoriaSempreSaida,
  modoDoValor,
  type Lancamento,
} from "@finnagent/contracts";
import { dataDaTransacao } from "./transacao.js";

export const WORKFLOW_INICIAL = { year: 2026, month: 3, day: 1 };

const renda = "11111111-1111-4111-8111-000000000001";
const moradia = "11111111-1111-4111-8111-000000000002";
const alimentacao = "11111111-1111-4111-8111-000000000003";
const compras = "11111111-1111-4111-8111-000000000004";
const financeiro = "11111111-1111-4111-8111-000000000005";
const comunicacao = "11111111-1111-4111-8111-000000000006";

function meses(valores: Record<number, number>) {
  return Object.entries(valores).map(([month, cents]) => ({
    year: 2026,
    month: Number(month),
    cents,
  }));
}

type CampoGerado =
  | "name"
  | "date"
  | "mode"
  | "status"
  | "transactionType"
  | "category"
  | "priority"
  | "installmentNumber"
  | "dueDate"
  | "interestRate"
  | "nextDueDate"
  | "suspendedCents"
  | "commitmentId"
  | "adjustments"
  | "recurrence"
  | "recurrenceInterval"
  | "months"
  | "cents"
  | "startYear"
  | "startMonth"
  | "installments";

function linha(
  parcial: Omit<Lancamento, CampoGerado> &
    Partial<Pick<Lancamento, "cents" | "startYear" | "startMonth" | "installments" | "months">>,
): Lancamento {
  const base = {
    cents: 0,
    startYear: 2026,
    startMonth: 3,
    installments: null,
    months: [],
    ...parcial,
  };
  const date = dataDaTransacao(base.startYear, base.startMonth, base.day);
  const parcelado = base.type === "parcela" || base.type === "empréstimo";
  const category = categoriaDoTipo(base.type);
  const ajustada = ajustarTransacao({
    category,
    mode: modoDoValor(base.cents),
    priority: "normal",
    transactionType: "unusual",
  });
  const months = categoriaSempreSaida(category)
    ? base.months.map((mes) => ({ ...mes, cents: mes.cents === 0 ? 0 : -Math.abs(mes.cents) }))
    : base.months;
  return {
    ...base,
    cents: base.cents === 0 ? 0 : ajustada.mode === "outflows" ? -Math.abs(base.cents) : Math.abs(base.cents),
    months,
    name: base.description,
    date,
    mode: ajustada.mode,
    status: "pending",
    transactionType: ajustada.transactionType,
    category,
    priority: ajustada.priority,
    installmentNumber: parcelado ? 1 : null,
    dueDate: null,
    interestRate: null,
    nextDueDate: base.type === "fixo" ? date : null,
    suspendedCents: 0,
    commitmentId: null,
    adjustments: [],
    recurrence: base.type === "fixo" ? "monthly" : null,
    recurrenceInterval: base.type === "fixo" ? 1 : null,
  };
}

export const EXEMPLO: Lancamento[] = [
  linha({
    id: "33333333-3333-4333-8333-000000000001",
    groupId: renda,
    groupName: "Renda",
    sessionId: "22222222-2222-4222-8222-000000000001",
    sessionName: "Salário",
    type: "fixo",
    description: "Salário mensal",
    justification: "Contrato de trabalho",
    day: 5,
    cents: 620_000,
  }),
  linha({
    id: "33333333-3333-4333-8333-000000000002",
    groupId: renda,
    groupName: "Renda",
    sessionId: "22222222-2222-4222-8222-000000000002",
    sessionName: "Freelance",
    type: "adicional",
    description: "Projeto para cliente PJ",
    justification: "Entrega fora do salário",
    day: 18,
    months: meses({ 5: 250_000, 9: 180_000 }),
  }),
  linha({
    id: "33333333-3333-4333-8333-000000000003",
    groupId: moradia,
    groupName: "Moradia",
    sessionId: "22222222-2222-4222-8222-000000000003",
    sessionName: "Aluguel",
    type: "fixo",
    description: "Aluguel do apartamento",
    justification: "Contrato de locação",
    day: 1,
    cents: -180_000,
  }),
  linha({
    id: "33333333-3333-4333-8333-000000000004",
    groupId: moradia,
    groupName: "Moradia",
    sessionId: "22222222-2222-4222-8222-000000000004",
    sessionName: "Condomínio",
    type: "fixo",
    description: "Taxa de condomínio",
    justification: "Cobrança mensal do prédio",
    day: 5,
    cents: -42_000,
  }),
  linha({
    id: "33333333-3333-4333-8333-000000000005",
    groupId: moradia,
    groupName: "Moradia",
    sessionId: "22222222-2222-4222-8222-000000000005",
    sessionName: "Energia",
    type: "variável",
    description: "Conta de luz",
    justification: "Consumo do mês",
    day: 2,
    months: meses({
      3: -16_240,
      4: -17_190,
      5: -15_820,
      6: -19_060,
      7: -17_630,
      8: -16_890,
      9: -18_150,
      10: -18_730,
    }),
  }),
  linha({
    id: "33333333-3333-4333-8333-000000000006",
    groupId: alimentacao,
    groupName: "Alimentação",
    sessionId: "22222222-2222-4222-8222-000000000006",
    sessionName: "Mercado",
    type: "variável",
    description: "Compras de supermercado",
    justification: "Abastecimento da casa",
    day: 8,
    months: meses({
      3: -61_000,
      4: -65_540,
      5: -59_890,
      6: -70_210,
      7: -63_300,
      8: -67_180,
      9: -64_520,
      10: -64_000,
    }),
  }),
  linha({
    id: "33333333-3333-4333-8333-000000000007",
    groupId: compras,
    groupName: "Compras",
    sessionId: "22222222-2222-4222-8222-000000000007",
    sessionName: "Notebook",
    type: "parcela",
    description: "Notebook",
    justification: "Compra parcelada no cartão",
    day: 10,
    cents: -35_000,
    installments: 10,
  }),
  linha({
    id: "33333333-3333-4333-8333-000000000008",
    groupId: financeiro,
    groupName: "Financeiro",
    sessionId: "22222222-2222-4222-8222-000000000008",
    sessionName: "Empréstimo pessoal",
    type: "empréstimo",
    description: "Empréstimo pessoal",
    justification: "Quitar dívida do cartão",
    day: 12,
    cents: -52_000,
    installments: 7,
  }),
  linha({
    id: "33333333-3333-4333-8333-000000000009",
    groupId: comunicacao,
    groupName: "Comunicação",
    sessionId: "22222222-2222-4222-8222-000000000009",
    sessionName: "Celular",
    type: "fixo",
    description: "Plano de celular",
    justification: "Plano mensal",
    day: 3,
    cents: -9_900,
  }),
];
