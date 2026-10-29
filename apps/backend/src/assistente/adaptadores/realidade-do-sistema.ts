import { Inject, Injectable } from "@nestjs/common";
import {
  CONFIGURACOES_REPOSITORIO,
  type ConfiguracoesRepositorio,
} from "../../configuracoes/portas/configuracoes-repositorio.js";
import { FeriadosService } from "../../feriados/aplicacao/feriados.service.js";
import { FinancasService } from "../../financas/aplicacao/financas.service.js";
import { PrismaService } from "../../persistencia/prisma.service.js";
import type { RealidadeDaConta } from "../portas/realidade-da-conta.js";

@Injectable()
export class RealidadeDoSistema implements RealidadeDaConta {
  constructor(
    private readonly financas: FinancasService,
    private readonly feriados: FeriadosService,
    private readonly prisma: PrismaService,
    @Inject(CONFIGURACOES_REPOSITORIO) private readonly configuracoes: ConfiguracoesRepositorio,
  ) {}

  async base(tenantId: string) {
    const [painel, hoje, preferencias, calendario] = await Promise.all([
      this.financas.listar(tenantId),
      this.financas.hoje(tenantId),
      this.configuracoes.obter(tenantId),
      this.feriados.calendario(tenantId),
    ]);
    return { entries: painel.entries, hoje, padroes: preferencias.vencimentos, calendario };
  }

  async linhaDoExtrato(tenantId: string, statementId: string, line: number) {
    const row = await this.prisma.statementLine.findFirst({
      where: { tenantId, statementId, line, error: "", cents: { not: null } },
    });
    if (!row?.postedOn || row.cents === null) return null;
    return {
      date: row.postedOn.toISOString().slice(0, 10),
      cents: row.cents,
      description: row.description,
      entryId: row.entryId,
    };
  }
}
