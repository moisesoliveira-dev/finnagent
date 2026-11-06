import { Inject, Injectable } from "@nestjs/common";
import {
  dataContabil,
  ehMulta,
  ehSerie,
  ocorrenciasDoLancamento,
  situacaoDaOcorrencia,
  type CompromissoDoDia,
  type HojeResposta,
  type PedidoDeTarefa,
  type PendenciaDoDia,
  type VencimentoDoDia,
} from "@finnagent/contracts";
import { AgendaService } from "../../agenda/aplicacao/agenda.service.js";
import { ExtratosService } from "../../extratos/aplicacao/extratos.service.js";
import { FinancasService } from "../../financas/aplicacao/financas.service.js";
import { Conflito, NaoEncontrado } from "../../grupos/dominio/erros.js";
import { MetasService } from "../../metas/aplicacao/metas.service.js";
import { TAREFAS_REPOSITORIO, type TarefasRepositorio } from "../portas/tarefas-repositorio.js";

const reais = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
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
  ) {}

  async dia(tenantId: string, date?: string): Promise<HojeResposta> {
    const today = await this.financas.hoje(tenantId);
    const dia = date ?? today;
    const [year, month, day] = dia.split("-").map(Number) as [number, number, number];
    const [tarefas, agenda, financas] = await Promise.all([
      this.tarefas.listarDoDia(tenantId, dia),
      this.agenda.listar(tenantId, year, month),
      this.financas.listar(tenantId),
    ]);
    const compromissos: CompromissoDoDia[] = agenda.appointments
      .filter((item) => item.day === day)
      .map((item) => ({
        id: item.id,
        title: item.title,
        time: item.time,
        endTime: item.endTime ?? null,
        allDay: item.allDay,
        location: item.location,
        calendar: item.calendar,
        status: item.status,
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
    const pendencias = dia === today ? await this.pendencias(tenantId, year, month) : [];
    return { date: dia, today, tarefas, compromissos, vencimentos, pendencias };
  }

  private async pendencias(tenantId: string, year: number, month: number) {
    const lista: PendenciaDoDia[] = [];
    const mes = MESES[month - 1] ?? String(month);
    const [semLancamento, metas] = await Promise.all([
      this.extratos.semConferir(tenantId, year, month).catch(() => 0),
      this.metas.listar(tenantId).catch(() => null),
    ]);
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
    return lista;
  }

  async criar(tenantId: string, id: string, pedido: PedidoDeTarefa) {
    const resultado = await this.tarefas.criar(tenantId, id, pedido);
    if (resultado === "identificador") throw new Conflito("Esse identificador já pertence a outra tarefa.");
    return resultado;
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

  async excluir(tenantId: string, id: string) {
    const resultado = await this.tarefas.excluir(tenantId, id);
    if (resultado === "ausente") throw new NaoEncontrado("Tarefa não encontrada.");
  }
}
