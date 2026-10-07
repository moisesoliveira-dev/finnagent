import { Inject, Injectable } from "@nestjs/common";
import {
  centavosNoMes,
  type AgendaResposta,
  type Compromisso,
  type FinancasResposta,
  type LancamentoDoMes,
  type Vinculo,
} from "@finnagent/contracts";
import { Conflito, NaoEncontrado } from "../../grupos/dominio/erros.js";
import { FinancasService } from "../../financas/aplicacao/financas.service.js";
import { PedidoInvalido } from "../dominio/erros.js";
import { mensagemDaCategoria, ocorrenciasNoMes } from "./ocorrencias.js";
import {
  AGENDA_REPOSITORIO,
  type AgendaRepositorio,
  type NovoCompromisso,
} from "../portas/agenda-repositorio.js";

@Injectable()
export class AgendaService {
  constructor(
    @Inject(AGENDA_REPOSITORIO) private readonly agenda: AgendaRepositorio,
    private readonly financas: FinancasService,
  ) {}

  async ocorrencias(tenantId: string, year: number, month: number) {
    const definicoes = await this.agenda.listarQueAlcancam(tenantId, year, month);
    return definicoes.flatMap((item) => ocorrenciasNoMes(item, year, month));
  }

  async listar(tenantId: string, year: number, month: number): Promise<AgendaResposta> {
    const base = await this.financas.listar(tenantId);
    const entries = lancamentosDoMes(base, year, month);
    const definicoes = await this.agenda.listarQueAlcancam(tenantId, year, month);
    const appointments = definicoes
      .flatMap((item) => ocorrenciasNoMes(item, year, month))
      .map((item) => comVinculo(item, entries))
      .sort((a, b) => a.day - b.day || (a.time ?? "").localeCompare(b.time ?? "") || a.title.localeCompare(b.title));
    return {
      google: "desconectado",
      appointments,
      entries,
    };
  }

  async criar(tenantId: string, pedido: NovoCompromisso): Promise<Compromisso> {
    const base = await this.financas.listar(tenantId);
    const entries = lancamentosDoMes(base, pedido.year, pedido.month);
    if (pedido.entryId && !entries.some((item) => item.id === pedido.entryId)) {
      throw new NaoEncontrado("Lançamento não encontrado nesse mês.");
    }
    const mensagem = mensagemDaCategoria(pedido, new Date().getFullYear());
    if (mensagem) throw new PedidoInvalido(mensagem);
    const resultado = await this.agenda.criar(tenantId, pedido);
    if (resultado === "identificador") {
      throw new Conflito("Esse identificador já pertence a outro compromisso.");
    }
    if (resultado === "lancamento-ausente") {
      throw new NaoEncontrado("Lançamento não encontrado nesse mês.");
    }
    return comVinculo(resultado, entries);
  }
}

function lancamentosDoMes(base: FinancasResposta, year: number, month: number) {
  const monthIndex = month - 1;
  const ultimo = new Date(year, month, 0).getDate();
  const entries: LancamentoDoMes[] = [];
  for (const entry of base.entries) {
    const cents = centavosNoMes(entry, base.workflow, year, monthIndex);
    if (cents === undefined) continue;
    entries.push({
      id: entry.id,
      description: entry.description,
      day: Math.min(entry.day, ultimo),
      groupName: entry.groupName,
      sessionName: entry.sessionName,
      cents,
    });
  }
  return entries;
}

function comVinculo(compromisso: Compromisso, entries: LancamentoDoMes[]): Compromisso {
  const entry = entries.find((item) => item.id === compromisso.entryId);
  const link: Vinculo | null = entry
    ? {
        entryId: entry.id,
        groupName: entry.groupName,
        sessionName: entry.sessionName,
        cents: entry.cents,
      }
    : null;
  return { ...compromisso, link };
}
