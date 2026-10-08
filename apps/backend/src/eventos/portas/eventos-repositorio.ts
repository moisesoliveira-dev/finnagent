import type { EventosResposta } from "@finnagent/contracts";

export const EVENTOS_REPOSITORIO = Symbol("EVENTOS_REPOSITORIO");

export interface EventosRepositorio {
  listar(tenantId: string): Promise<EventosResposta>;
}
