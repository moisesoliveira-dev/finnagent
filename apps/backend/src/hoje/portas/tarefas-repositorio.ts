import type { PedidoDeTarefa, Tarefa } from "@finnagent/contracts";

export const TAREFAS_REPOSITORIO = Symbol("TAREFAS_REPOSITORIO");

export interface TarefasRepositorio {
  /** As tarefas que aparecem num dia: as desse dia, as de dias anteriores ainda não feitas e as feitas nesse dia. */
  listarDoDia(tenantId: string, date: string): Promise<Tarefa[]>;
  criar(tenantId: string, id: string, pedido: PedidoDeTarefa): Promise<Tarefa | "identificador">;
  atualizar(tenantId: string, id: string, pedido: PedidoDeTarefa): Promise<Tarefa | "ausente">;
  /** `doneOn` é o dia em que foi feita; null reabre. */
  concluir(tenantId: string, id: string, doneOn: string | null): Promise<Tarefa | "ausente">;
  excluir(tenantId: string, id: string): Promise<void | "ausente">;
}
