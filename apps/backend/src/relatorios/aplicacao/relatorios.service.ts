import { Injectable } from "@nestjs/common";
import { montarRelatorio, type RelatorioResposta } from "@finnagent/contracts";
import { FinancasService } from "../../financas/aplicacao/financas.service.js";
import { PedidoInvalido } from "../dominio/erros.js";

@Injectable()
export class RelatoriosService {
  constructor(private readonly financas: FinancasService) {}

  async listar(tenantId: string, year?: number): Promise<RelatorioResposta> {
    const painel = await this.financas.listar(tenantId);
    const ano = year ?? painel.workflow.year;
    const relatorio = montarRelatorio(painel.entries, painel.workflow, ano);
    if (!relatorio) throw new PedidoInvalido("Esse ano é anterior ao início do workflow.");
    return relatorio;
  }
}
