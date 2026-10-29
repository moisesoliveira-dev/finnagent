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
    const linhas = await this.linhasDoExtrato(tenantId, [{ statementId, line }]);
    return linhas.get(chaveDaLinha(statementId, line)) ?? null;
  }

  async linhasDoExtrato(tenantId: string, chaves: { statementId: string; line: number }[]) {
    const mapa = new Map<string, { date: string; cents: number; description: string; entryId: string | null }>();
    if (!chaves.length) return mapa;
    const rows = await this.prisma.statementLine.findMany({
      where: {
        tenantId,
        error: "",
        cents: { not: null },
        OR: chaves.map((chave) => ({ statementId: chave.statementId, line: chave.line })),
      },
    });
    for (const row of rows) {
      if (!row.postedOn || row.cents === null) continue;
      mapa.set(chaveDaLinha(row.statementId, row.line), {
        date: row.postedOn.toISOString().slice(0, 10),
        cents: row.cents,
        description: row.description,
        entryId: row.entryId,
      });
    }
    return mapa;
  }
}

function chaveDaLinha(statementId: string, line: number) {
  return `${statementId}:${line}`;
}
