import type { Meta } from "@finnagent/contracts";

export const METAS_REPOSITORIO = Symbol("METAS_REPOSITORIO");

export type NovaMeta = {
  id: string;
  name: string;
  targetCents: number;
  savedCents: number;
  dueYear: number | null;
  dueMonth: number | null;
};

export interface MetasRepositorio {
  listar(tenantId: string): Promise<Meta[]>;
  criar(tenantId: string, pedido: NovaMeta): Promise<Meta | "identificador">;
  excluir(tenantId: string, id: string): Promise<boolean>;
}
