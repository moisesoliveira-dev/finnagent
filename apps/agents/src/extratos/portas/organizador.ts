import type { LinhaExtrato, PedidoOrganizarExtrato } from "@finnagent/contracts";

export type OrganizadorDeExtrato = {
  organizar(pedido: PedidoOrganizarExtrato): Promise<LinhaExtrato[]>;
};
