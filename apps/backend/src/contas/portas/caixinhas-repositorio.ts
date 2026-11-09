import type { Caixinha, PedidoDeCaixinha } from "@finnagent/contracts";

export const CAIXINHAS_REPOSITORIO = Symbol("CAIXINHAS_REPOSITORIO");

export type FalhaDaCaixinha = "nome-ocupado" | "meta-ausente" | "meta-ocupada";

export interface CaixinhasRepositorio {
  listar(tenantId: string): Promise<Caixinha[]>;
  obter(tenantId: string, id: string): Promise<Caixinha | null>;
  /** Grava a caixinha com a sessão que o serviço já criou. O mesmo pedido de novo devolve a mesma caixinha. */
  criar(tenantId: string, caixinha: Caixinha): Promise<Caixinha | "identificador" | "conta-ausente" | "cartao" | FalhaDaCaixinha>;
  atualizar(tenantId: string, id: string, pedido: PedidoDeCaixinha): Promise<Caixinha | "ausente" | FalhaDaCaixinha>;
  /** Liga a meta a esta caixinha (e tira de outra que a tinha). Sem caixinha, a meta fica sem nenhuma. */
  ligarMeta(tenantId: string, goalId: string, boxId: string | null): Promise<"ok" | "ausente" | "meta-ausente">;
  excluir(tenantId: string, id: string): Promise<Caixinha | "ausente">;
}
