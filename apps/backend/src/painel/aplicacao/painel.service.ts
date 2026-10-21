import { Inject, Injectable } from "@nestjs/common";
import {
  avisosDe,
  centavosNoMes,
  montarPainel,
  type Compromisso,
  type EscopoPainel,
  type Lancamento,
  type PainelResposta,
  type Workflow,
} from "@finnagent/contracts";
import { AgendaService } from "../../agenda/aplicacao/agenda.service.js";
import {
  CONFIGURACOES_REPOSITORIO,
  type ConfiguracoesRepositorio,
} from "../../configuracoes/portas/configuracoes-repositorio.js";
import { FinancasService } from "../../financas/aplicacao/financas.service.js";
import { PedidoInvalido } from "../dominio/erros.js";

@Injectable()
export class PainelService {
  constructor(
    private readonly financas: FinancasService,
    private readonly agenda: AgendaService,
    @Inject(CONFIGURACOES_REPOSITORIO) private readonly configuracoes: ConfiguracoesRepositorio,
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
      const ocorrencias = await this.agenda.ocorrencias(tenantId, year, mes);
      compromissos.push(...ocorrencias.map((item) => comValor(item, base.entries, base.workflow)));
    }
    const painel = montarPainel(scope, year, month, day, base.workflow, base.entries, compromissos);
    const preferencias = await this.configuracoes.obter(tenantId);
    return {
      ...painel,
      avisos: avisosDe(preferencias, compromissos, base.entries),
    };
  }
}

function comValor(compromisso: Compromisso, entries: Lancamento[], workflow: Workflow) {
  const entry = entries.find((item) => item.id === compromisso.entryId);
  if (!entry) return compromisso;
  const cents = centavosNoMes(entry, workflow, compromisso.year, compromisso.month - 1);
  return {
    ...compromisso,
    link: {
      entryId: entry.id,
      groupName: entry.groupName,
      sessionName: entry.sessionName,
      cents: cents ?? entry.cents,
    },
  };
}
