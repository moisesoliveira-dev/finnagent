import { Inject, Injectable } from "@nestjs/common";
import {
  CONFIGURACOES_REPOSITORIO,
  type ConfiguracoesRepositorio,
} from "../../configuracoes/portas/configuracoes-repositorio.js";
import { FeriadosService } from "../../feriados/aplicacao/feriados.service.js";
import { FinancasService } from "../../financas/aplicacao/financas.service.js";
import type { RealidadeDaConta } from "../portas/realidade-da-conta.js";

@Injectable()
export class RealidadeDoSistema implements RealidadeDaConta {
  constructor(
    private readonly financas: FinancasService,
    private readonly feriados: FeriadosService,
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
}
