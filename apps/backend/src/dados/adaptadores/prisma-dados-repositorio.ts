import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { BancoIndisponivel } from "../../grupos/dominio/erros.js";
import { gravarOutbox } from "../../persistencia/gravar-outbox.js";
import { PrismaService } from "../../persistencia/prisma.service.js";
import type { DadosDoPacote, ResumoDaImportacao } from "../dominio/pacote.js";
import { aplicarZeramento } from "../dominio/zerar.js";
import type { DadosRepositorio } from "../portas/dados-repositorio.js";

const LOTE = 1000;

@Injectable()
export class PrismaDadosRepositorio implements DadosRepositorio {
  constructor(private readonly prisma: PrismaService) {}

  async exportar(tenantId: string) {
    const db = this.banco();
    const onde = { where: { tenantId } };
    // Leitura em uma transação para o arquivo refletir um instante só.
    return db.$transaction(
      async (tx) => {
        const [
          groups,
          sessions,
          sessionAdditions,
          yearStays,
          entries,
          entryOccurrences,
          entryAdjustments,
          entryAmounts,
          appointments,
          calendars,
          accounts,
          statements,
          statementLines,
          statementAliases,
          statementLineParts,
          statementNames,
          goals,
          accountBoxes,
          holidays,
          tasks,
          goalAllocations,
          appointmentDone,
          preferencia,
          workflow,
        ] = await Promise.all([
          tx.group.findMany({ ...onde, orderBy: { id: "asc" } }),
          tx.session.findMany({ ...onde, orderBy: { id: "asc" } }),
          tx.sessionAddition.findMany({ ...onde, orderBy: { id: "asc" } }),
          tx.yearStay.findMany(onde),
          tx.entry.findMany({ ...onde, orderBy: { id: "asc" } }),
          tx.entryOccurrence.findMany(onde),
          tx.entryAdjustment.findMany(onde),
          tx.entryAmount.findMany(onde),
          tx.appointment.findMany({ ...onde, orderBy: { id: "asc" } }),
          tx.calendar.findMany(onde),
          tx.account.findMany({ ...onde, orderBy: { id: "asc" } }),
          tx.statement.findMany({ ...onde, orderBy: { id: "asc" } }),
          tx.statementLine.findMany(onde),
          tx.statementAlias.findMany(onde),
          tx.statementLinePart.findMany(onde),
          tx.statementName.findMany(onde),
          tx.goal.findMany({ ...onde, orderBy: { id: "asc" } }),
          tx.accountBox.findMany({ ...onde, orderBy: { id: "asc" } }),
          tx.holiday.findMany({ ...onde, orderBy: { id: "asc" } }),
          tx.task.findMany({ ...onde, orderBy: { id: "asc" } }),
          tx.goalAllocation.findMany(onde),
          tx.appointmentDone.findMany(onde),
          tx.preference.findUnique({ where: { tenantId } }),
          tx.workflow.findUnique({ where: { tenantId } }),
        ]);
        return {
          groups: groups.map(({ tenantId: _, ...resto }) => resto),
          sessions: sessions.map(({ tenantId: _, ...resto }) => resto),
          sessionAdditions: sessionAdditions.map(({ tenantId: _, ...resto }) => resto),
          yearStays: yearStays.map(({ tenantId: _, ...resto }) => resto),
          entries: entries.map(({ tenantId: _, ...resto }) => resto),
          entryOccurrences: entryOccurrences.map(({ tenantId: _, ...resto }) => resto),
          entryAdjustments: entryAdjustments.map(({ tenantId: _, ...resto }) => resto),
          entryAmounts: entryAmounts.map(({ tenantId: _, ...resto }) => resto),
          // O id do evento é do Google de quem exporta; não faz sentido em outra conta.
          appointments: appointments.map(({ tenantId: _, googleEventId: __, ...resto }) => resto),
          calendars: calendars.map(({ tenantId: _, ...resto }) => resto),
          accounts: accounts.map(({ tenantId: _, ...resto }) => resto),
          statements: statements.map(({ tenantId: _, content, ...resto }) => ({
            ...resto,
            content: Buffer.from(content).toString("base64"),
          })),
          statementLines: statementLines.map(({ tenantId: _, ...resto }) => resto),
          statementAliases: statementAliases.map(({ tenantId: _, ...resto }) => resto),
          statementLineParts: statementLineParts.map(({ tenantId: _, ...resto }) => resto),
          statementNames: statementNames.map(({ tenantId: _, ...resto }) => resto),
          goals: goals.map(({ tenantId: _, ...resto }) => resto),
          accountBoxes: accountBoxes.map(({ tenantId: _, ...resto }) => resto),
          holidays: holidays.map(({ id, name, day, month }) => ({ id, name, day, month })),
          tasks: tasks.map(({ tenantId: _, ...resto }) => resto),
          goalAllocations: goalAllocations.map(({ tenantId: _, ...resto }) => resto),
          appointmentDone: appointmentDone.map(({ tenantId: _, ...resto }) => resto),
          preferences: preferencia
            ? {
                name: preferencia.name,
                timezone: preferencia.timezone,
                theme: preferencia.theme,
                personalCalendar: preferencia.personalCalendar,
                workCalendar: preferencia.workCalendar,
                showEntries: preferencia.showEntries,
                categorize: preferencia.categorize,
                pendingHours: preferencia.pendingHours,
                reminder: preferencia.reminder,
                reminders: preferencia.reminders,
                dueAlerts: preferencia.dueAlerts,
                emailAlerts: preferencia.emailAlerts,
                appAlerts: preferencia.appAlerts,
                history: preferencia.history,
                aiModels: preferencia.aiModels,
                aiModel: preferencia.aiModel,
                dueDefaults: preferencia.dueDefaults,
                showHolidays: preferencia.showHolidays,
                showOptionalHolidays: preferencia.showOptionalHolidays,
              }
            : null,
          workflow: workflow ? { year: workflow.year, month: workflow.month, day: workflow.day } : null,
        };
      },
      { isolationLevel: "RepeatableRead", timeout: 60_000, maxWait: 10_000 },
    );
  }

  async importar(tenantId: string, dados: DadosDoPacote, resumo: ResumoDaImportacao) {
    const db = this.banco();
    await db.$transaction(
      async (tx) => {
        await apagar(tx, tenantId);
        const com = <T extends object>(itens: T[]) => itens.map((item) => ({ ...item, tenantId }));
        await gravar(dados.groups.length, (data) => tx.group.createMany({ data }), com(dados.groups));
        await gravar(dados.sessions.length, (data) => tx.session.createMany({ data }), com(dados.sessions));
        await gravar(
          dados.sessionAdditions.length,
          (data) => tx.sessionAddition.createMany({ data }),
          com(dados.sessionAdditions),
        );
        await gravar(dados.yearStays.length, (data) => tx.yearStay.createMany({ data }), com(dados.yearStays));
        // O vínculo com o compromisso é texto solto (sem chave estrangeira), então a ordem é livre.
        // As contas antes dos lançamentos: o lançamento aponta para a conta dele.
        await gravar(dados.accounts.length, (data) => tx.account.createMany({ data }), com(dados.accounts));
        // A cobertura aponta para outro lançamento do mesmo arquivo: entra depois que todos existem.
        await gravar(
          dados.entries.length,
          (data) => tx.entry.createMany({ data }),
          com(dados.entries.map((item) => ({ ...item, coveredById: null }))),
        );
        for (const item of dados.entries.filter((entrada) => entrada.coveredById)) {
          await tx.entry.updateMany({ where: { id: item.id, tenantId }, data: { coveredById: item.coveredById } });
        }
        await gravar(
          dados.entryOccurrences.length,
          (data) => tx.entryOccurrence.createMany({ data }),
          com(dados.entryOccurrences),
        );
        await gravar(
          dados.entryAdjustments.length,
          (data) => tx.entryAdjustment.createMany({ data }),
          com(dados.entryAdjustments),
        );
        await gravar(
          dados.entryAmounts.length,
          (data) => tx.entryAmount.createMany({ data }),
          com(dados.entryAmounts),
        );
        await gravar(
          dados.appointments.length,
          (data) => tx.appointment.createMany({ data }),
          com(dados.appointments),
        );
        await gravar(dados.appointmentDone.length, (data) => tx.appointmentDone.createMany({ data }), com(dados.appointmentDone));
        await gravar(dados.calendars.length, (data) => tx.calendar.createMany({ data }), com(dados.calendars));
        await gravar(
          dados.statements.length,
          (data) => tx.statement.createMany({ data }),
          com(dados.statements.map((item) => ({ ...item, content: Buffer.from(item.content, "base64") }))),
        );
        await gravar(
          dados.statementLines.length,
          (data) => tx.statementLine.createMany({ data }),
          com(dados.statementLines),
        );
        await gravar(
          dados.statementAliases.length,
          (data) => tx.statementAlias.createMany({ data }),
          com(dados.statementAliases),
        );
        await gravar(
          dados.statementLineParts.length,
          (data) => tx.statementLinePart.createMany({ data }),
          com(dados.statementLineParts),
        );
        await gravar(dados.statementNames.length, (data) => tx.statementName.createMany({ data }), com(dados.statementNames));
        await gravar(dados.goals.length, (data) => tx.goal.createMany({ data }), com(dados.goals));
        await gravar(dados.accountBoxes.length, (data) => tx.accountBox.createMany({ data }), com(dados.accountBoxes));
        await gravar(dados.holidays.length, (data) => tx.holiday.createMany({ data }), com(dados.holidays));
        // A atividade-mãe antes da filha: a chave do pai não deixa gravar a filha primeiro.
        await gravar(dados.tasks.length, (data) => tx.task.createMany({ data }), com(paisPrimeiro(dados.tasks)));
        await gravar(dados.goalAllocations.length, (data) => tx.goalAllocation.createMany({ data }), com(dados.goalAllocations));
        // Credenciais do Google e chave da IA são de quem usa a conta; só as preferências vêm do arquivo.
        if (dados.preferences) {
          await tx.preference.upsert({
            where: { tenantId },
            create: { tenantId, ...dados.preferences },
            update: dados.preferences,
          });
        }
        if (dados.workflow) {
          await tx.workflow.upsert({
            where: { tenantId },
            create: { tenantId, ...dados.workflow },
            update: dados.workflow,
          });
        }
        await gravarOutbox(tx, tenantId, "importar-dados", tenantId, resumo, randomUUID());
      },
      { timeout: 120_000, maxWait: 10_000 },
    );
  }

  async zerar(tenantId: string) {
    const db = this.banco();
    await db.$transaction(
      async (tx) => {
        await aplicarZeramento(tx, tenantId);
        await gravarOutbox(tx, tenantId, "zerar-dados", tenantId, {}, randomUUID());
      },
      { timeout: 120_000, maxWait: 10_000 },
    );
  }

  private banco() {
    if (!this.prisma.ativo) throw new BancoIndisponivel();
    return this.prisma;
  }
}

async function apagar(tx: Prisma.TransactionClient, tenantId: string) {
  const onde = { where: { tenantId } };
  // Ordem pensada nas chaves com Restrict: quem aponta vai antes de quem é apontado.
  await tx.statementAlias.deleteMany(onde);
  await tx.statementName.deleteMany(onde);
  await tx.statementLinePart.deleteMany(onde);
  await tx.statementLine.deleteMany(onde);
  await tx.statement.deleteMany(onde);
  await tx.accountBox.deleteMany(onde);
  await tx.account.deleteMany(onde);
  await tx.task.deleteMany(onde);
  await tx.appointmentDone.deleteMany(onde);
  await tx.appointment.deleteMany(onde);
  await tx.entry.deleteMany(onde);
  await tx.sessionAddition.deleteMany(onde);
  await tx.session.deleteMany(onde);
  await tx.group.deleteMany(onde);
  await tx.goalAllocation.deleteMany(onde);
  await tx.goal.deleteMany(onde);
  await tx.holiday.deleteMany(onde);
  await tx.yearStay.deleteMany(onde);
  await tx.calendar.deleteMany(onde);
}

/** Ordena as tarefas de modo que cada uma venha depois da mãe dela. */
function paisPrimeiro<T extends { id: string; parentId: string | null }>(tarefas: T[]) {
  const porId = new Map(tarefas.map((item) => [item.id, item]));
  const profundidade = (item: T): number => {
    let nivel = 0;
    for (let atual: T | undefined = item; atual?.parentId && nivel <= tarefas.length; atual = porId.get(atual.parentId)) nivel += 1;
    return nivel;
  };
  return [...tarefas].sort((a, b) => profundidade(a) - profundidade(b));
}

async function gravar<T>(total: number, escrever: (lote: T[]) => Promise<unknown>, itens: T[]) {
  for (let inicio = 0; inicio < total; inicio += LOTE) {
    await escrever(itens.slice(inicio, inicio + LOTE));
  }
}
