import type { Conta, PedidoDeConta } from "@finnagent/contracts";

export const CONTAS_REPOSITORIO = Symbol("CONTAS_REPOSITORIO");

export interface ContasRepositorio {
  listar(tenantId: string): Promise<Conta[]>;
  criar(tenantId: string, id: string, pedido: PedidoDeConta): Promise<Conta | "nome-ocupado" | "identificador">;
  atualizar(tenantId: string, id: string, pedido: PedidoDeConta): Promise<Conta | "ausente" | "nome-ocupado" | "com-caixinhas">;
  /** Apaga a conta. Os lançamentos ficam sem conta; com extratos importados ou caixinhas nela, recusa. */
  excluir(tenantId: string, id: string): Promise<void | "ausente" | "com-extratos" | "com-caixinhas">;
}
