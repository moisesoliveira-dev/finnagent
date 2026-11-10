import type { CategoriaTransacao, ModoTransacao, Recorrencia, SituacaoOcorrencia, StatusTransacao, TipoDeRegra } from "@finnagent/contracts";

/** Os mesmos nomes do web (apps/frontend/app/financas/rotulos.ts). */
export const ROTULO_MODO: Record<ModoTransacao, string> = { inflows: "Entrada", outflows: "Saída" };

export const ROTULO_STATUS: Record<StatusTransacao, string> = {
  pending: "Pendente",
  completed: "Paga",
  cancelled: "Cancelada",
  refunded: "Estornada",
};

export const ROTULO_CATEGORIA: Record<CategoriaTransacao, string> = {
  additional: "Extra",
  installment: "Parcela",
  loan: "Empréstimo",
  fixed: "Recorrente",
  unique: "Única",
};

export const ROTULO_RECORRENCIA: Record<Recorrencia, string> = {
  weekly: "Semanal",
  monthly: "Mensal",
  quarterly: "Trimestral",
  semi_annual: "Semestral",
  annual: "Anual",
  customize: "Personalizada (em dias)",
};

export const ROTULO_DA_REGRA: Record<TipoDeRegra, string> = {
  dia: "No dia escolhido",
  dia_util: "No Nº dia útil do mês",
  ultimo_dia_util: "No último dia útil do mês",
};

export function rotuloDaSituacao(situacao: SituacaoOcorrencia) {
  return situacao === "late" ? "Atrasada" : ROTULO_STATUS[situacao];
}

export function tomDaSituacao(situacao: SituacaoOcorrencia) {
  if (situacao === "late") return "neg";
  if (situacao === "completed") return "ok";
  if (situacao === "pending") return "ia";
  return "";
}
