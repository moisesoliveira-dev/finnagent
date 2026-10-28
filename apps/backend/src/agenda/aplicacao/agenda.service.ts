import { Inject, Injectable } from "@nestjs/common";
import {
  type AgendaResposta,
  type Calendario,
  type Compromisso,
  type FusoAgenda,
  type Lancamento,
  type LancamentoDoMes,
  type MovimentoCompromisso,
  type NomeAgenda,
  type SessaoDaAgenda,
  type StatusCompromisso,
  type Vinculo,
} from "@finnagent/contracts";
import { Conflito, NaoEncontrado } from "../../grupos/dominio/erros.js";
import { ConfiguracoesService } from "../../configuracoes/aplicacao/configuracoes.service.js";
import { FeriadosService } from "../../feriados/aplicacao/feriados.service.js";
import { FinancasService } from "../../financas/aplicacao/financas.service.js";
import { GRUPOS_REPOSITORIO, type GruposRepositorio } from "../../grupos/portas/grupos-repositorio.js";
import { PedidoInvalido } from "../dominio/erros.js";
import { gastoDoCompromisso } from "../dominio/gasto.js";
import { montarIntervalo } from "../dominio/fuso.js";
import { eventoValido } from "../dominio/sincronizar.js";
import { lancamentosDoMes } from "../dominio/lancamentos-do-mes.js";
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
    @Inject(GRUPOS_REPOSITORIO) private readonly grupos: GruposRepositorio,
    private readonly financas: FinancasService,
    private readonly configuracoes: ConfiguracoesService,
    private readonly feriados: FeriadosService,
  ) {}

  // Só sessão que acumula pode receber os gastos de um compromisso; a de valor tem um único lançamento.
  private async sessoes(tenantId: string) {
    const { groups, sessions } = await this.grupos.listar(tenantId);
    const grupos = new Map(groups.map((grupo) => [grupo.id, grupo.name]));
    const rotulos = new Map(
      sessions.map((sessao) => [sessao.id, `${grupos.get(sessao.groupId) ?? "Grupo"} / ${sessao.name}`]),
    );
    const abertas: SessaoDaAgenda[] = sessions
      .filter((sessao) => !sessao.endedAt && sessao.kind === "acumulo")
      .map((sessao) => ({ id: sessao.id, label: rotulos.get(sessao.id) ?? sessao.name }));
    return { rotulos, abertas, todas: sessions };
  }

  private async conferirSessao(tenantId: string, sessionId: string | null, anterior: string | null) {
    if (!sessionId || sessionId === anterior) return;
    const { todas } = await this.sessoes(tenantId);
    const sessao = todas.find((item) => item.id === sessionId);
    if (!sessao) throw new NaoEncontrado("Sessão não encontrada.");
    if (sessao.endedAt) throw new PedidoInvalido("Essa sessão já foi encerrada.");
    if (sessao.kind !== "acumulo") throw new PedidoInvalido("Escolha uma sessão que acumula gastos.");
  }

  async ocorrencias(tenantId: string, year: number, month: number) {
    const definicoes = await this.agenda.listarQueAlcancam(tenantId, year, month);
    return definicoes.flatMap((item) => ocorrenciasNoMes(item, year, month));
  }

  async listar(tenantId: string, year: number, month: number): Promise<AgendaResposta> {
    const base = await this.financas.listar(tenantId);
    const entries = lancamentosDoMes(base, year, month, await this.financas.hoje(tenantId));
    const calendars = await this.agenda.listarCalendarios(tenantId);
    const definicoes = await this.agenda.listarQueAlcancam(tenantId, year, month);
    const { rotulos, abertas } = await this.sessoes(tenantId);
    const appointments = definicoes
      .flatMap((item) => ocorrenciasNoMes(item, year, month))
      .map((item) => comSessao(comVinculo(item, entries), base.entries, rotulos))
      .sort((a, b) => a.day - b.day || (a.time ?? "").localeCompare(b.time ?? "") || a.title.localeCompare(b.title));
    const config = await this.configuracoes.obter(tenantId);
    return {
      google: config.google,
      calendars,
      appointments,
      entries,
      sessions: abertas,
      holidays: await this.feriadosDoMes(tenantId, year, month, config),
    };
  }

  /** O que a agenda mostra: nada, só os feriados, ou também os pontos facultativos. */
  private async feriadosDoMes(
    tenantId: string,
    year: number,
    month: number,
    config: { feriadosNaAgenda: boolean; facultativosNaAgenda: boolean },
  ) {
    if (!config.feriadosNaAgenda) return [];
    const prefixo = `${year}-${String(month).padStart(2, "0")}-`;
    const { feriados } = await this.feriados.doAno(tenantId, year);
    return feriados.filter(
      (item) =>
        item.data.startsWith(prefixo) &&
        (config.facultativosNaAgenda || item.tipo === "nacional" || item.tipo === "local"),
    );
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
    await this.conferirSessao(tenantId, pedido.sessionId, null);
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
    const { rotulos } = await this.sessoes(tenantId);
    return comSessao(comVinculo(resultado, entries), base.entries, rotulos);
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
    const anterior = await this.agenda.obter(tenantId, id);
    await this.conferirSessao(tenantId, pedido.sessionId, anterior?.sessionId ?? null);
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
    const { rotulos } = await this.sessoes(tenantId);
    return comSessao(
      comVinculo(resultado, lancamentosDoMes(base, pedido.year, pedido.month, hoje)),
      base.entries,
      rotulos,
    );
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
      sessionId: atual.sessionId,
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

function comSessao(compromisso: Compromisso, entries: Lancamento[], rotulos: Map<string, string>): Compromisso {
  return {
    ...compromisso,
    sessionLabel: compromisso.sessionId ? (rotulos.get(compromisso.sessionId) ?? null) : null,
    spentCents: gastoDoCompromisso(compromisso, entries),
  };
}

function comVinculo(compromisso: Compromisso, entries: LancamentoDoMes[]): Compromisso {
  const doLancamento = entries.filter((item) => item.id === compromisso.entryId);
  const entry = doLancamento[0];
  const link: Vinculo | null = entry
    ? {
        entryId: entry.id,
        groupName: entry.groupName,
        sessionName: entry.sessionName,
        // O valor do mês inteiro, mesmo quando o lançamento vence em mais de um dia.
        cents: doLancamento.reduce((total, item) => total + item.cents, 0),
        situation: entry.situation,
      }
    : null;
  return { ...compromisso, link };
}
