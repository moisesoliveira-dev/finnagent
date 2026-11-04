import { Inject, Injectable } from "@nestjs/common";
import type { ContasResposta, PedidoDeConta } from "@finnagent/contracts";
import { Conflito, NaoEncontrado } from "../../grupos/dominio/erros.js";
import { CONTAS_REPOSITORIO, type ContasRepositorio } from "../portas/contas-repositorio.js";

/** As contas da pessoa: banco, carteira e cartão. O extrato já criava a conta pelo nome; aqui ela ganha tipo e saldo inicial. */
@Injectable()
export class ContasService {
  constructor(@Inject(CONTAS_REPOSITORIO) private readonly contas: ContasRepositorio) {}

  async listar(tenantId: string): Promise<ContasResposta> {
    return { accounts: await this.contas.listar(tenantId) };
  }

  async criar(tenantId: string, id: string, pedido: PedidoDeConta) {
    const resultado = await this.contas.criar(tenantId, id, pedido);
    if (resultado === "identificador") throw new Conflito("Esse identificador já pertence a outra conta.");
    if (resultado === "nome-ocupado") throw new Conflito("Já existe uma conta com esse nome.");
    return resultado;
  }

  async atualizar(tenantId: string, id: string, pedido: PedidoDeConta) {
    const resultado = await this.contas.atualizar(tenantId, id, pedido);
    if (resultado === "ausente") throw new NaoEncontrado("Conta não encontrada.");
    if (resultado === "nome-ocupado") throw new Conflito("Já existe uma conta com esse nome.");
    return resultado;
  }
}
