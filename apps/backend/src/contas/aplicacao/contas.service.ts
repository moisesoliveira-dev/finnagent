import { Inject, Injectable } from "@nestjs/common";
import type { ContasResposta, PedidoDeConta } from "@finnagent/contracts";
import { Conflito, NaoEncontrado } from "../../grupos/dominio/erros.js";
import { CAIXINHAS_REPOSITORIO, type CaixinhasRepositorio } from "../portas/caixinhas-repositorio.js";
import { CONTAS_REPOSITORIO, type ContasRepositorio } from "../portas/contas-repositorio.js";

/** As contas da pessoa: banco, carteira e cartão. O extrato já criava a conta pelo nome; aqui ela ganha tipo e saldo inicial. */
@Injectable()
export class ContasService {
  constructor(
    @Inject(CONTAS_REPOSITORIO) private readonly contas: ContasRepositorio,
    @Inject(CAIXINHAS_REPOSITORIO) private readonly caixinhas: CaixinhasRepositorio,
  ) {}

  async listar(tenantId: string): Promise<ContasResposta> {
    const [accounts, boxes] = await Promise.all([this.contas.listar(tenantId), this.caixinhas.listar(tenantId)]);
    return { accounts, boxes };
  }

  async criar(tenantId: string, id: string, pedido: PedidoDeConta) {
    const resultado = await this.contas.criar(tenantId, id, pedido);
    if (resultado === "identificador") throw new Conflito("Esse identificador já pertence a outra conta.");
    if (resultado === "nome-ocupado") throw new Conflito("Já existe uma conta com esse nome.");
    return resultado;
  }

  async excluir(tenantId: string, id: string) {
    const resultado = await this.contas.excluir(tenantId, id);
    if (resultado === "ausente") throw new NaoEncontrado("Conta não encontrada.");
    if (resultado === "com-extratos") throw new Conflito("Esta conta tem extratos importados. Apague os extratos antes de excluir a conta.");
    if (resultado === "com-caixinhas") throw new Conflito("Esta conta tem caixinhas. Exclua as caixinhas antes de excluir a conta.");
  }

  async atualizar(tenantId: string, id: string, pedido: PedidoDeConta) {
    const resultado = await this.contas.atualizar(tenantId, id, pedido);
    if (resultado === "ausente") throw new NaoEncontrado("Conta não encontrada.");
    if (resultado === "nome-ocupado") throw new Conflito("Já existe uma conta com esse nome.");
    if (resultado === "com-caixinhas") throw new Conflito("Esta conta tem caixinhas: ela não pode virar cartão de crédito.");
    return resultado;
  }
}
