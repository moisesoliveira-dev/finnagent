import type {
  CategoriaTransacao,
  ModoTransacao,
  PrioridadeTransacao,
  Recorrencia,
  StatusTransacao,
  TipoTransacao,
} from "@finnagent/contracts";

export const ROTULO_MODO: Record<ModoTransacao, string> = {
  inflows: "Entrada",
  outflows: "Saída",
};

export const ROTULO_STATUS: Record<StatusTransacao, string> = {
  pending: "Pendente",
  completed: "Paga",
  cancelled: "Cancelada",
  refunded: "Estornada",
};

export const ROTULO_TIPO: Record<TipoTransacao, string> = {
  appointment: "Compromisso",
  unusual: "Incomum",
};

export const ROTULO_CATEGORIA: Record<CategoriaTransacao, string> = {
  additional: "Extra",
  installment: "Parcela",
  loan: "Empréstimo",
  fixed: "Fixa",
  unique: "Única",
};

export const ROTULO_PRIORIDADE: Record<PrioridadeTransacao, string> = {
  low: "Baixa",
  normal: "Normal",
  high: "Alta",
  nopriority: "Sem prioridade",
};

export const ROTULO_RECORRENCIA: Record<Recorrencia, string> = {
  weekly: "Semanal",
  monthly: "Mensal",
  quarterly: "Trimestral",
  semi_annual: "Semestral",
  annual: "Anual",
  customize: "Personalizada",
};

export function unidadeDaRecorrencia(recurrence: Recorrencia) {
  if (recurrence === "weekly") return "semanas";
  if (recurrence === "monthly") return "meses";
  if (recurrence === "quarterly") return "trimestres";
  if (recurrence === "semi_annual") return "semestres";
  if (recurrence === "annual") return "anos";
  return "dias";
}

export function textoDaCategoria(category: CategoriaTransacao) {
  if (category === "fixed") return "O valor se repete a partir da data, sem previsão de término.";
  if (category === "installment") return "Cada parcela repete o valor a partir da data.";
  if (category === "loan") return "O empréstimo repete o valor em cada parcela, com vencimento e juros.";
  if (category === "additional") return "Entrada extra, só na data informada.";
  return "Saída fora da rotina, só na data informada.";
}
