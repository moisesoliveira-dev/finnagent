import { Inject, Injectable } from "@nestjs/common";
import {
  dataContabil,
  ehMulta,
  ehSerie,
  ocorrenciasDoLancamento,
  situacaoDaOcorrencia,
  usoDosLimites,
  type CompromissoDoDia,
  type HojeResposta,
  type PedidoDeMovimento,
  type PedidoDeTarefa,
  type PendenciaDoDia,
  type SobraLivre,
  type UsoDoLimite,
  type VencimentoDoDia,
} from "@finnagent/contracts";
import { AgendaService } from "../../agenda/aplicacao/agenda.service.js";
import { ExtratosService } from "../../extratos/aplicacao/extratos.service.js";
import { FinancasService } from "../../financas/aplicacao/financas.service.js";
import { GruposService } from "../../grupos/aplicacao/grupos.service.js";
import { Conflito, NaoEncontrado } from "../../grupos/dominio/erros.js";
import { MetasService } from "../../metas/aplicacao/metas.service.js";
import { TAREFAS_REPOSITORIO, type TarefasRepositorio } from "../portas/tarefas-repositorio.js";

const reais = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/** O livre até o fim do mês, pelo que as metas enxergam: a sobra do mês, o que veio de antes e o que já foi separado. */
export function sobraLivre(
  metas: { year: number; month: number; surplusCents: number; monthSurplusCents: number; carriedCents: number; separatedCents: number } | null,
  year: number,
  month: number,
  day: number,
): SobraLivre | null {
  if (!metas || metas.year !== year || metas.month !== month) return null;
  const diasDoMes = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const daysLeft = Math.max(diasDoMes - day + 1, 1);
  return {
    cents: metas.surplusCents,
    monthCents: metas.monthSurplusCents,
    carriedCents: metas.carriedCents,
    separatedCents: metas.separatedCents,
    daysLeft,
    perDayCents: Math.floor(Math.max(metas.surplusCents, 0) / daysLeft),
  };
}
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/**
 * O dia da pessoa numa lista só: as tarefas que ela escreveu, os compromissos da agenda, os vencimentos do dia e,
 * quando o dia é hoje, as pendências que o sistema enxerga (extrato por conferir, sobra por separar, atrasados).
 */
@Injectable()
export class HojeService {
  constructor(
    @Inject(TAREFAS_REPOSITORIO) private readonly tarefas: TarefasRepositorio,
    private readonly agenda: AgendaService,
    private readonly financas: FinancasService,
    private readonly extratos: ExtratosService,
    private readonly metas: MetasService,
    private readonly grupos: GruposService,
  ) {}

  async dia(tenantId: string, date?: string): Promise<HojeResposta> {
    const today = await this.financas.hoje(tenantId);
    const dia = date ?? today;
    const [year, month, day] = dia.split("-").map(Number) as [number, number, number];
    const [agenda, financas] = await Promise.all([this.agenda.listar(tenantId, year, month), this.financas.listar(tenantId)]);
    const doDia = agenda.appointments.filter((item) => item.day === day);
    const tarefas = await this.tarefas.listarDoDia(tenantId, dia, [...new Set(doDia.map((item) => item.id))]);
    const compromissos: CompromissoDoDia[] = doDia
      .map((item) => ({
        id: item.id,
        title: item.title,
        time: item.time,
        endTime: item.endTime ?? null,
        allDay: item.allDay,
        location: item.location,
        calendar: item.calendar,
        status: item.status,
        repeats: item.category !== "fixed",
      }))
      .sort((a, b) => (a.time ?? "").localeCompare(b.time ?? "") || a.title.localeCompare(b.title, "pt-BR"));
    const vencimentos: VencimentoDoDia[] = [];
    for (const entry of financas.entries) {
      for (const item of ocorrenciasDoLancamento(entry)) {
        if (ehMulta(item) || (item.status !== "pending" && item.status !== "completed")) continue;
        // O vencimento do dia, o pago nesse dia e, em hoje, o que ficou para trás: marcar paga na data de hoje.
        const atrasado = dia === today && item.status === "pending" && item.dueDate < today;
        if (dataContabil(item) === dia || atrasado) {
          vencimentos.push({
            entryId: entry.id,
            number: item.number,
            description: entry.name || entry.description,
            groupName: entry.groupName,
            sessionName: entry.sessionName,
            category: entry.category,
            cents: item.status === "completed" && item.paidCents != null ? item.paidCents : item.plannedCents,
            situation: situacaoDaOcorrencia(item, today),
            dueDate: item.dueDate,
            series: ehSerie(entry.category),
            paymentId: item.paymentId ?? null,
            counterparty: entry.counterparty ?? "",
          });
        }
      }
    }
    vencimentos.sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.description.localeCompare(b.description, "pt-BR"));
    if (dia !== today) return { date: dia, today, tarefas, compromissos, vencimentos, pendencias: [], livre: null, limites: [], gastos: [], sessoesParaGasto: [] };
    const [metas, grupos] = await Promise.all([this.metas.listar(tenantId).catch(() => null), this.grupos.listar(tenantId).catch(() => null)]);
    const nomeDoGrupo = (id: string) => grupos?.groups.find((grupo) => grupo.id === id)?.name ?? "";
    const limites: UsoDoLimite[] = grupos ? usoDosLimites(grupos.sessions, financas.entries, financas.workflow, year, month, nomeDoGrupo) : [];
    const pendencias = await this.pendencias(tenantId, year, month, metas, limites);
    const gastos = await this.agenda.perguntasDeGasto(tenantId).catch(() => []);
    const sessoesParaGasto = gastos.some((item) => !item.sessionId) ? await this.agenda.sessoesDeGasto(tenantId) : [];
    return { date: dia, today, tarefas, compromissos, vencimentos, pendencias, livre: sobraLivre(metas, year, month, day), limites, gastos, sessoesParaGasto };
  }

  private async pendencias(
    tenantId: string,
    year: number,
    month: number,
    metas: Awaited<ReturnType<MetasService["listar"]>> | null,
    limites: UsoDoLimite[],
  ) {
    const lista: PendenciaDoDia[] = [];
    const mes = MESES[month - 1] ?? String(month);
    const semLancamento = await this.extratos.semConferir(tenantId, year, month).catch(() => 0);
    if (semLancamento > 0) {
      lista.push({
        id: "conferencia",
        kind: "conferencia",
        title: `Conferir o extrato de ${mes}`,
        detail: semLancamento === 1 ? "1 linha sem lançamento" : `${semLancamento} linhas sem lançamento`,
        href: "/extratos/conferencia",
      });
    }
    if (metas && metas.goals.length > 0 && metas.year === year && metas.month === month && metas.surplusCents > 0 && metas.separatedCents === 0) {
      lista.push({
        id: "sobra",
        kind: "sobra",
        title: `Separar a sobra de ${mes} para as metas`,
        detail: `${reais.format(metas.surplusCents / 100)} livres`,
        href: "/metas",
      });
    }
    for (const uso of limites.filter((item) => item.percent >= 100)) {
      lista.push({
        id: `limite:${uso.sessionId}`,
        kind: "limite",
        title: `${uso.sessionName} passou do limite de ${mes}`,
        detail: `${reais.format(uso.usedCents / 100)} de ${reais.format(uso.limitCents / 100)}`,
        href: "/financas",
      });
    }
    return lista;
  }

  async criar(tenantId: string, id: string, pedido: PedidoDeTarefa) {
    const resultado = await this.tarefas.criar(tenantId, id, pedido);
    if (resultado === "identificador") throw new Conflito("Esse identificador já pertence a outra tarefa.");
    if (resultado === "pai-ausente") throw new NaoEncontrado("A atividade dessa subatividade não existe.");
    if (resultado === "compromisso-ausente") throw new NaoEncontrado("Compromisso não encontrado.");
    return resultado;
  }

  /** Traz para o dia o checklist da última vez do compromisso que repete. */
  async copiarChecklist(tenantId: string, appointmentId: string, date: string) {
    const resultado = await this.tarefas.copiarChecklist(tenantId, appointmentId, date);
    if (resultado === "ja-tem") throw new Conflito("Este dia já tem checklist.");
    if (resultado === "sem-anterior") throw new NaoEncontrado("Este compromisso ainda não teve checklist em outro dia.");
    return { tarefas: resultado };
  }

  async atualizar(tenantId: string, id: string, pedido: PedidoDeTarefa) {
    const resultado = await this.tarefas.atualizar(tenantId, id, pedido);
    if (resultado === "ausente") throw new NaoEncontrado("Tarefa não encontrada.");
    return resultado;
  }

  /** Conclui no dia de hoje da pessoa, ou reabre. */
  async concluir(tenantId: string, id: string, done: boolean) {
    const resultado = await this.tarefas.concluir(tenantId, id, done ? await this.financas.hoje(tenantId) : null);
    if (resultado === "ausente") throw new NaoEncontrado("Tarefa não encontrada.");
    return resultado;
  }

  async mover(tenantId: string, id: string, pedido: PedidoDeMovimento) {
    const resultado = await this.tarefas.mover(tenantId, id, pedido);
    if (resultado === "ausente") throw new NaoEncontrado("Tarefa não encontrada.");
    if (resultado === "pai-ausente") throw new NaoEncontrado("A atividade de destino não existe.");
    if (resultado === "ciclo") throw new Conflito("Uma tarefa não pode entrar dentro de si mesma nem de uma subatividade dela.");
    if (resultado === "compromisso-ausente") throw new NaoEncontrado("Compromisso não encontrado.");
    return resultado;
  }

  async excluir(tenantId: string, id: string) {
    const resultado = await this.tarefas.excluir(tenantId, id);
    if (resultado === "ausente") throw new NaoEncontrado("Tarefa não encontrada.");
  }
}
