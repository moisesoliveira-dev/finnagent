import type { LinhaExtrato, PedidoOrganizarExtrato } from "@finnagent/contracts";

export const ORGANIZADOR_DE_EXTRATO = Symbol("ORGANIZADOR_DE_EXTRATO");

export type OrganizadorDeExtrato = {
  organizar(pedido: PedidoOrganizarExtrato): Promise<LinhaExtrato[]>;
};
