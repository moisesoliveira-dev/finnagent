import { Injectable } from "@nestjs/common";
import { montarPainel, type EscopoPainel, type PainelResposta } from "@finnagent/contracts";
import { AgendaService } from "../../agenda/aplicacao/agenda.service.js";
import { FinancasService } from "../../financas/aplicacao/financas.service.js";
import { PedidoInvalido } from "../dominio/erros.js";

@Injectable()
export class PainelService {
  constructor(
    private readonly financas: FinancasService,
    private readonly agenda: AgendaService,
  ) {}

  async listar(
    tenantId: string,
    scope: EscopoPainel,
    year: number,
    month: number | null,
    day: number | null,
  ): Promise<PainelResposta> {
    if (scope !== "ano" && month === null) throw new PedidoInvalido("Informe o mês.");
    if (scope === "dia") {
      if (day === null || month === null || day > new Date(year, month, 0).getDate()) {
        throw new PedidoInvalido("Esse dia não existe nesse mês.");
      }
    }
    const base = await this.financas.listar(tenantId);
    const meses = scope === "ano" ? Array.from({ length: 12 }, (_, indice) => indice + 1) : [month ?? 1];
    const compromissos = [];
    for (const mes of meses) {
      compromissos.push(...(await this.agenda.ocorrencias(tenantId, year, mes)));
    }
    return montarPainel(scope, year, month, day, base.workflow, base.entries, compromissos);
  }
}
