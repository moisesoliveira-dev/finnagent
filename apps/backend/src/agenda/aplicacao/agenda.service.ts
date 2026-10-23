import { Inject, Injectable } from "@nestjs/common";
import {
  centavosNoMes,
  type AgendaResposta,
  type Calendario,
  type Compromisso,
  type FinancasResposta,
  type FusoAgenda,
  type LancamentoDoMes,
  type MovimentoCompromisso,
  type NomeAgenda,
  type StatusCompromisso,
  type Vinculo,
} from "@finnagent/contracts";
import { Conflito, NaoEncontrado } from "../../grupos/dominio/erros.js";
import { ConfiguracoesService } from "../../configuracoes/aplicacao/configuracoes.service.js";
import { FinancasService } from "../../financas/aplicacao/financas.service.js";
import { PedidoInvalido } from "../dominio/erros.js";
import { montarIntervalo } from "../dominio/fuso.js";
import { eventoValido } from "../dominio/sincronizar.js";
import { situacaoNoMes } from "../../financas/dominio/vista.js";
import { comValidade, mensagemDaCategoria, ocorrenciasNoMes, validadeAoMover } from "./ocorrencias.js";
import {
  AGENDA_REPOSITORIO,
  type AgendaRepositorio,
  type NovoCompromisso,
} from "../portas/agenda-repositorio.js";
import { GOOGLE_AGENDA, type GoogleAgenda } from "../portas/google-agenda.js";

@Injectable()
export class AgendaService {
  constructor(
    @Inject(AGENDA_REPOSITORIO) private readonly agenda: AgendaRepositorio,
    @Inject(GOOGLE_AGENDA) private readonly google: GoogleAgenda,
    private readonly financas: FinancasService,
    private readonly configuracoes: ConfiguracoesService,
  ) {}

  async ocorrencias(tenantId: string, year: number, month: number) {
    const definicoes = await this.agenda.listarQueAlcancam(tenantId, year, month);
    return definicoes.flatMap((item) => ocorrenciasNoMes(item, year, month));
  }

  async listar(tenantId: string, year: number, month: number): Promise<AgendaResposta> {
    const base = await this.financas.listar(tenantId);
    const entries = lancamentosDoMes(base, year, month, await this.financas.hoje(tenantId));
    const calendars = await this.agenda.listarCalendarios(tenantId);
    const definicoes = await this.agenda.listarQueAlcancam(tenantId, year, month);
    const appointments = definicoes
      .flatMap((item) => ocorrenciasNoMes(item, year, month))
      .map((item) => comVinculo(item, entries))
      .sort((a, b) => a.day - b.day || (a.time ?? "").localeCompare(b.time ?? "") || a.title.localeCompare(b.title));
    const config = await this.configuracoes.obter(tenantId);
    return {
      google: config.google,
      calendars,
      appointments,
      entries,
    };
  }

  async criar(tenantId: string, pedido: Omit<NovoCompromisso, "startAt" | "endAt" | "hour" | "minute" | "status"> & {
    time: string | null;
    endTime: string | null;
  }): Promise<Compromisso> {
    pedido = comValidade(pedido);
    const base = await this.financas.listar(tenantId);
    const entries = lancamentosDoMes(base, pedido.year, pedido.month, await this.financas.hoje(tenantId));
    if (pedido.entryId && !entries.some((item) => item.id === pedido.entryId)) {
      throw new NaoEncontrado("Lançamento não encontrado nesse mês.");
    }
    const mensagem = mensagemDaCategoria(pedido);
    if (mensagem) throw new PedidoInvalido(mensagem);
    const intervalo = montarIntervalo(pedido);
    if (intervalo === "hora") throw new PedidoInvalido("Informe a hora inicial e a final.");
    if (intervalo === "ordem") throw new PedidoInvalido("A hora final vem depois da inicial.");
    const resultado = await this.agenda.criar(tenantId, {
      ...pedido,
      ...intervalo,
      status: "undone",
      time: pedido.allDay ? null : pedido.time,
    });
    if (resultado === "identificador") {
      throw new Conflito("Esse identificador já pertence a outro compromisso.");
    }
    if (resultado === "lancamento-ausente") {
      throw new NaoEncontrado("Lançamento não encontrado nesse mês.");
    }
    if (resultado === "ausente") throw new NaoEncontrado("Compromisso não encontrado.");
    return comVinculo(resultado, entries);
  }

  async atualizar(tenantId: string, id: string, pedido: Omit<NovoCompromisso, "id" | "startAt" | "endAt" | "hour" | "minute" | "status"> & {
    time: string | null;
    endTime: string | null;
  }): Promise<Compromisso> {
    pedido = comValidade(pedido);
    if (pedido.entryId) {
      const base = await this.financas.listar(tenantId);
      if (!base.entries.some((item) => item.id === pedido.entryId)) {
        throw new NaoEncontrado("Lançamento não encontrado.");
      }
    }
    const mensagem = mensagemDaCategoria(pedido);
    if (mensagem) throw new PedidoInvalido(mensagem);
    const intervalo = montarIntervalo(pedido);
    if (intervalo === "hora") throw new PedidoInvalido("Informe a hora inicial e a final.");
    if (intervalo === "ordem") throw new PedidoInvalido("A hora final vem depois da inicial.");
    const resultado = await this.agenda.atualizar(tenantId, {
      ...pedido,
      id,
      ...intervalo,
      status: "undone",
      time: pedido.allDay ? null : pedido.time,
    });
    if (resultado === "ausente") throw new NaoEncontrado("Compromisso não encontrado.");
    if (resultado === "lancamento-ausente") throw new NaoEncontrado("Lançamento não encontrado.");
    if (resultado === "identificador") throw new Conflito("Não foi possível salvar o compromisso.");
    const base = await this.financas.listar(tenantId);
    const hoje = await this.financas.hoje(tenantId);
    return comVinculo(resultado, lancamentosDoMes(base, pedido.year, pedido.month, hoje));
  }

  async mover(
    tenantId: string,
    id: string,
    destino: { year: number; month: number; day: number },
  ): Promise<MovimentoCompromisso> {
    const atual = await this.agenda.obter(tenantId, id);
    if (!atual) throw new NaoEncontrado("Compromisso não encontrado.");
    const appointment = await this.atualizar(tenantId, id, {
      title: atual.title,
      description: atual.description,
      location: atual.location,
      allDay: atual.allDay,
      ...destino,
      time: atual.allDay ? null : atual.time,
      endTime: atual.allDay ? null : (atual.endTime ?? null),
      calendar: atual.calendar,
      timezone: atual.timezone,
      category: atual.category,
      ...validadeAoMover(atual, destino),
      entryId: atual.entryId,
    });
    return { appointment, series: atual.category !== "fixed" };
  }

  async excluir(tenantId: string, id: string) {
    const resultado = await this.agenda.excluir(tenantId, id);
    if (resultado === "ausente") throw new NaoEncontrado("Compromisso não encontrado.");
  }

  async atualizarFuso(tenantId: string, name: NomeAgenda, timezone: FusoAgenda): Promise<Calendario> {
    return this.agenda.atualizarFuso(tenantId, name, timezone);
  }

  async atualizarStatus(tenantId: string, id: string, status: StatusCompromisso) {
    const resultado = await this.agenda.atualizarStatus(tenantId, id, status);
    if (resultado === "ausente") throw new NaoEncontrado("Compromisso não encontrado.");
    return resultado;
  }

  async sincronizarGoogleCalendar(tenantId: string) {
    const eventos = await this.google.listar(tenantId);
    if (eventos === "desconectado") {
      throw new PedidoInvalido("Conecte o Google Calendar para sincronizar.");
    }
    if (eventos.some((evento) => !eventoValido(evento))) {
      throw new PedidoInvalido("Um compromisso do Google está sem horário válido.");
    }
    return this.agenda.aplicarGoogle(tenantId, eventos);
  }
}

function lancamentosDoMes(base: FinancasResposta, year: number, month: number, hoje: string) {
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
      situation: situacaoNoMes(entry, year, month, hoje),
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
        situation: entry.situation,
      }
    : null;
  return { ...compromisso, link };
}
