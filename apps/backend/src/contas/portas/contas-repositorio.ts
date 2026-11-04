import type { Conta, PedidoDeConta } from "@finnagent/contracts";

export const CONTAS_REPOSITORIO = Symbol("CONTAS_REPOSITORIO");

export interface ContasRepositorio {
  listar(tenantId: string): Promise<Conta[]>;
  criar(tenantId: string, id: string, pedido: PedidoDeConta): Promise<Conta | "nome-ocupado" | "identificador">;
  atualizar(tenantId: string, id: string, pedido: PedidoDeConta): Promise<Conta | "ausente" | "nome-ocupado">;
}
