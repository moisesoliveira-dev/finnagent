import type { PedidoOrganizarExtrato } from "@finnagent/contracts";
import { PedidoInvalido } from "../dominio/erros.js";
import { tipoPermitido } from "../dominio/linhas.js";
import type { OrganizadorDeExtrato } from "../portas/organizador.js";

export class OrganizarExtrato {
  constructor(private readonly organizador: OrganizadorDeExtrato) {}

  organizar(pedido: PedidoOrganizarExtrato) {
    if (!tipoPermitido(pedido.mediaType)) {
      throw new PedidoInvalido("Envie uma imagem ou um PDF do extrato.");
    }
    if (!pedido.content.trim()) throw new PedidoInvalido("Não foi possível ler o arquivo.");
    return this.organizador.organizar(pedido);
  }
}
