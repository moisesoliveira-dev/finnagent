import { Inject, Injectable } from "@nestjs/common";
import { totaisDoMes, type MetasResposta } from "@finnagent/contracts";
import { Conflito, NaoEncontrado } from "../../grupos/dominio/erros.js";
import { FinancasService } from "../../financas/aplicacao/financas.service.js";
import {
  METAS_REPOSITORIO,
  type MetasRepositorio,
  type NovaMeta,
} from "../portas/metas-repositorio.js";

@Injectable()
export class MetasService {
  constructor(
    @Inject(METAS_REPOSITORIO) private readonly metas: MetasRepositorio,
    private readonly financas: FinancasService,
  ) {}

  async listar(tenantId: string): Promise<MetasResposta> {
    const painel = await this.financas.listar(tenantId);
    const { year, month } = painel.workflow;
    const totais = totaisDoMes(painel.entries, painel.workflow, year, month - 1);
    const goals = await this.metas.listar(tenantId);
    return { goals, surplusCents: totais.sobra, year, month };
  }

  async criar(tenantId: string, pedido: NovaMeta) {
    const criada = await this.metas.criar(tenantId, pedido);
    if (criada === "identificador") {
      throw new Conflito("Este identificador já pertence a outra meta.");
    }
    return criada;
  }

  async excluir(tenantId: string, id: string) {
    const apagou = await this.metas.excluir(tenantId, id);
    if (!apagou) throw new NaoEncontrado("Meta não encontrada.");
  }
}
