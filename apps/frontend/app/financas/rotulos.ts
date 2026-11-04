import type {
  CategoriaTransacao,
  ModoTransacao,
  PrioridadeTransacao,
  Recorrencia,
  SituacaoOcorrencia,
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
  fixed: "Recorrente",
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

export function tomDoStatus(status: StatusTransacao) {
  if (status === "completed") return "ok" as const;
  if (status === "pending") return "pending" as const;
  if (status === "refunded") return "info" as const;
  return "default" as const;
}

export function rotuloDaSituacao(situacao: SituacaoOcorrencia) {
  if (situacao === "late") return "Atrasada";
  return ROTULO_STATUS[situacao];
}

export function tomDaSituacao(situacao: SituacaoOcorrencia) {
  if (situacao === "late") return "neg" as const;
  return tomDoStatus(situacao);
}

/** A fixa se repete todo mês (azul) e o adicional é entrada a mais (verde); as outras ficam neutras. */
export function tomDaCategoria(categoria: CategoriaTransacao) {
  if (categoria === "fixed") return "info" as const;
  if (categoria === "additional") return "ok" as const;
  return "default" as const;
}

export function tomDaPrioridade(priority: PrioridadeTransacao) {
  if (priority === "high") return "neg" as const;
  if (priority === "low") return "default" as const;
  return "default" as const;
}

export function unidadeDaRecorrencia(recurrence: Recorrencia) {
  if (recurrence === "weekly") return "semanas";
  if (recurrence === "monthly") return "meses";
  if (recurrence === "quarterly") return "trimestres";
  if (recurrence === "semi_annual") return "semestres";
  if (recurrence === "annual") return "anos";
  return "dias";
}
