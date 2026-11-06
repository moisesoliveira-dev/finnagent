import type { PedidoDeMovimento, PedidoDeTarefa, Tarefa } from "@finnagent/contracts";

export const TAREFAS_REPOSITORIO = Symbol("TAREFAS_REPOSITORIO");

export interface TarefasRepositorio {
  /** As tarefas que aparecem num dia: as desse dia, as de dias anteriores ainda não feitas, as feitas nesse dia, e toda a árvore de subatividades delas. */
  listarDoDia(tenantId: string, date: string): Promise<Tarefa[]>;
  criar(tenantId: string, id: string, pedido: PedidoDeTarefa): Promise<Tarefa | "identificador" | "pai-ausente">;
  atualizar(tenantId: string, id: string, pedido: PedidoDeTarefa): Promise<Tarefa | "ausente">;
  /** `doneOn` é o dia em que foi feita; null reabre. A atividade leva as subatividades junto (ver `mudancasAoConcluir`). */
  concluir(tenantId: string, id: string, doneOn: string | null): Promise<Tarefa | "ausente">;
  /** Muda de lugar: outro pai (ou a raiz, com `parentId` null) e a posição entre as irmãs (antes de `beforeId`, ou no fim). */
  mover(tenantId: string, id: string, pedido: PedidoDeMovimento): Promise<Tarefa | "ausente" | "pai-ausente" | "ciclo">;
  excluir(tenantId: string, id: string): Promise<void | "ausente">;
}
