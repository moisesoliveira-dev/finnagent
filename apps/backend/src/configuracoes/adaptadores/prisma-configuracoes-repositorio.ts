import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import {
  AGENDAS,
  AJUSTES_DE_DIA_UTIL,
  PADROES_DE_VENCIMENTO,
  PADROES_DE_VENCIMENTO_INICIAIS,
  type PadroesDeVencimento,
  FUSO_PADRAO,
  FUSOS_AGENDA,
  LEMBRETES,
  MODOS_CATEGORIA,
  RETENCOES,
  TEMAS,
  type FusoAgenda,
  type Lembrete,
  type ModoCategoria,
  type Preferencias,
  type Retencao,
  type Tema,
} from "@finnagent/contracts";
import type { Preference, Prisma } from "@prisma/client";
import { WORKFLOW_INICIAL } from "../../financas/dominio/exemplo.js";
import { BancoIndisponivel } from "../../grupos/dominio/erros.js";
import { gravarOutbox, marcaDe } from "../../persistencia/gravar-outbox.js";
import { PrismaService } from "../../persistencia/prisma.service.js";
import { horasDe, isoDoWorkflow, modelosSalvos } from "../dominio/pedido.js";
import type {
  ConfiguracaoGravada,
  ConfiguracoesRepositorio,
  DataDoWorkflow,
  Segredos,
} from "../portas/configuracoes-repositorio.js";

@Injectable()
export class PrismaConfiguracoesRepositorio implements ConfiguracoesRepositorio {
  constructor(private readonly prisma: PrismaService) {}

  async obter(tenantId: string) {
    const db = this.banco();
    const [preferencia, calendarios, fluxo] = await Promise.all([
      db.preference.findUnique({ where: { tenantId } }),
      db.calendar.findMany({ where: { tenantId } }),
      db.workflow.findUnique({ where: { tenantId } }),
    ]);
    const pessoal = calendarios.find((calendario) => calendario.name === "Pessoal");
    const timezone = fusoDe(preferencia?.timezone ?? pessoal?.timezone ?? FUSO_PADRAO);
    return preferenciasDe(preferencia, timezone, fluxo ?? WORKFLOW_INICIAL);
  }

  async salvar(tenantId: string, preferencias: Preferencias, data: DataDoWorkflow) {
    const db = this.banco();
    return db.$transaction(async (tx) => {
      const [atual, calendarios, fluxo] = await Promise.all([
        tx.preference.findUnique({ where: { tenantId } }),
        tx.calendar.findMany({ where: { tenantId } }),
        tx.workflow.findUnique({ where: { tenantId } }),
      ]);
      const pessoal = calendarios.find((calendario) => calendario.name === "Pessoal");
      const exibido = fusoDe(atual?.timezone ?? pessoal?.timezone ?? FUSO_PADRAO);
      if (preferencias.timezone !== exibido) {
        for (const name of AGENDAS) {
          const calendario = calendarios.find((item) => item.name === name);
          await gravarFuso(tx, tenantId, name, preferencias.timezone);
          if (calendario?.timezone === preferencias.timezone) continue;
          const payload = { name, timezone: preferencias.timezone };
          await gravarOutbox(tx, tenantId, "atualizar-fuso-calendario", name, payload, marcaDe(payload));
        }
      }
      const mudouData =
        !fluxo || fluxo.year !== data.year || fluxo.month !== data.month || fluxo.day !== data.day;
      await tx.workflow.upsert({
        where: { tenantId },
        create: { tenantId, ...data },
        update: data,
      });
      if (mudouData) {
        await gravarOutbox(tx, tenantId, "definir-workflow", tenantId, data, marcaDe(data));
      }
      const segredoAtual = atual?.googleClientSecret ?? "";
      const chaveAtual = atual?.aiApiKey ?? "";
      const segredo = preferencias.limparSegredoGoogle
        ? ""
        : preferencias.googleClientSecret.trim() || segredoAtual;
      const chave = preferencias.limparChaveIa ? "" : preferencias.aiApiKey.trim() || chaveAtual;
      const cliente = preferencias.googleClientId.trim();
      const desligar = cliente !== (atual?.googleClientId ?? "") || segredo !== segredoAtual;
      const dados = {
        ...linhaDe(preferencias),
        googleClientId: cliente,
        googleClientSecret: segredo,
        googleRefreshToken: desligar ? "" : (atual?.googleRefreshToken ?? ""),
        googleOauthState: desligar ? "" : (atual?.googleOauthState ?? ""),
        googleAccount: desligar ? "" : (atual?.googleAccount ?? ""),
        googleCalendarPersonal: preferencias.googleCalendarPersonal.trim(),
        googleCalendarWork: preferencias.googleCalendarWork.trim(),
        aiModels: preferencias.aiModels,
        aiModel: preferencias.aiModel,
        aiApiKey: chave,
      };
      const gravada = await tx.preference.upsert({
        where: { tenantId },
        create: { tenantId, ...dados },
        update: dados,
      });
      const payload = {
        ...linhaDe(preferencias),
        googleClientId: cliente,
        googleCalendarPersonal: dados.googleCalendarPersonal,
        googleCalendarWork: dados.googleCalendarWork,
        aiModels: preferencias.aiModels,
        aiModel: preferencias.aiModel,
        googleSecretConfigured: Boolean(segredo),
        aiKeyConfigured: Boolean(chave),
        workflow: data,
      };
      await gravarOutbox(tx, tenantId, "salvar-configuracoes", tenantId, payload, marcaDe(payload));
      return preferenciasDe(gravada, preferencias.timezone, data);
    });
  }

  async segredos(tenantId: string): Promise<Segredos | null> {
    const db = this.banco();
    const preferencia = await db.preference.findUnique({ where: { tenantId } });
    if (!preferencia) return null;
    const modelos = modelosSalvos(preferencia.aiModels, preferencia.aiModel);
    return {
      clientId: preferencia.googleClientId,
      clientSecret: preferencia.googleClientSecret,
      refreshToken: preferencia.googleRefreshToken,
      oauthState: preferencia.googleOauthState,
      aiApiKey: preferencia.aiApiKey,
      aiModel: modelos.aiModel,
    };
  }

  async guardarEstado(tenantId: string, state: string) {
    const db = this.banco();
    const atual = await db.preference.findUnique({ where: { tenantId } });
    if (!atual?.googleClientId || !atual.googleClientSecret) return;
    const payload = { etapa: "autorizacao" };
    await db.$transaction(async (tx) => {
      await tx.preference.update({ where: { tenantId }, data: { googleOauthState: state } });
      await gravarOutbox(tx, tenantId, "iniciar-google", tenantId, payload, randomUUID());
    });
  }

  async concluirConexao(tenantId: string, refreshToken: string, account: string) {
    const db = this.banco();
    const payload = { googleConnected: true };
    await db.$transaction(async (tx) => {
      await tx.preference.update({
        where: { tenantId },
        data: { googleRefreshToken: refreshToken, googleAccount: account, googleOauthState: "" },
      });
      await gravarOutbox(tx, tenantId, "conectar-google", tenantId, payload, randomUUID());
    });
  }

  async desconectar(tenantId: string) {
    const db = this.banco();
    const payload = { googleConnected: false };
    await db.$transaction(async (tx) => {
      await tx.preference.updateMany({
        where: { tenantId },
        data: { googleRefreshToken: "", googleAccount: "", googleOauthState: "" },
      });
      await gravarOutbox(tx, tenantId, "desconectar-google", tenantId, payload, randomUUID());
    });
  }

  private banco() {
    if (!this.prisma.ativo) throw new BancoIndisponivel();
    return this.prisma;
  }
}

function linhaDe(preferencias: Preferencias) {
  return {
    name: preferencias.name,
    timezone: preferencias.timezone,
    theme: preferencias.theme,
    personalCalendar: preferencias.personalCalendar,
    workCalendar: preferencias.workCalendar,
    showEntries: preferencias.showEntries,
    categorize: preferencias.categorize,
    pendingHours: preferencias.pendingHours,
    reminder: preferencias.reminder,
    reminders: preferencias.reminders,
    dueAlerts: preferencias.dueAlerts,
    emailAlerts: preferencias.emailAlerts,
    appAlerts: preferencias.appAlerts,
    history: preferencias.history,
    dueDefaults: preferencias.vencimentos,
    showHolidays: preferencias.feriadosNaAgenda,
    showOptionalHolidays: preferencias.facultativosNaAgenda,
  };
}

async function gravarFuso(
  tx: Prisma.TransactionClient,
  tenantId: string,
  name: (typeof AGENDAS)[number],
  timezone: FusoAgenda,
) {
  const atual = await tx.calendar.findFirst({ where: { tenantId, name } });
  if (!atual) {
    await tx.calendar.create({ data: { id: randomUUID(), tenantId, name, timezone } });
    return;
  }
  if (atual.timezone === timezone) return;
  await tx.calendar.updateMany({ where: { id: atual.id, tenantId }, data: { timezone } });
}

function preferenciasDe(
  preferencia: Preference | null,
  timezone: FusoAgenda,
  data: DataDoWorkflow,
): ConfiguracaoGravada {
  return {
    name: preferencia?.name ?? "",
    timezone,
    theme: temaDe(preferencia?.theme),
    workflowDate: isoDoWorkflow(data),
    personalCalendar: preferencia?.personalCalendar ?? true,
    workCalendar: preferencia?.workCalendar ?? true,
    showEntries: preferencia?.showEntries ?? true,
    categorize: modoDe(preferencia?.categorize),
    pendingHours: horasDe(preferencia?.pendingHours ?? 24),
    reminder: lembreteDe(preferencia?.reminder),
    reminders: preferencia?.reminders ?? true,
    dueAlerts: preferencia?.dueAlerts ?? true,
    emailAlerts: preferencia?.emailAlerts ?? false,
    appAlerts: preferencia?.appAlerts ?? true,
    history: retencaoDe(preferencia?.history),
    googleClientId: preferencia?.googleClientId ?? "",
    googleClientSecret: "",
    limparSegredoGoogle: false,
    googleCalendarPersonal: preferencia?.googleCalendarPersonal ?? "",
    googleCalendarWork: preferencia?.googleCalendarWork ?? "",
    ...modelosSalvos(preferencia?.aiModels, preferencia?.aiModel),
    aiApiKey: "",
    limparChaveIa: false,
    vencimentos: vencimentosDe(preferencia?.dueDefaults),
    feriadosNaAgenda: preferencia?.showHolidays ?? true,
    facultativosNaAgenda: preferencia?.showOptionalHolidays ?? true,
    googleSecretConfigured: Boolean(preferencia?.googleClientSecret),
    googleConnected: Boolean(preferencia?.googleRefreshToken),
    googleAccount: preferencia?.googleAccount ?? "",
    aiKeyConfigured: Boolean(preferencia?.aiApiKey),
  };
}

function fusoDe(valor: string | null | undefined): FusoAgenda {
  return FUSOS_AGENDA.find((fuso) => fuso === valor) ?? FUSO_PADRAO;
}

function temaDe(valor: string | undefined): Tema {
  return TEMAS.find((tema) => tema === valor) ?? "auto";
}

function modoDe(valor: string | undefined): ModoCategoria {
  return MODOS_CATEGORIA.find((modo) => modo === valor) ?? "confirmar";
}

function lembreteDe(valor: string | undefined): Lembrete {
  return LEMBRETES.find((lembrete) => lembrete === valor) ?? "1h";
}

function retencaoDe(valor: string | undefined): Retencao {
  return RETENCOES.find((retencao) => retencao === valor) ?? "1a";
}

/** Padrões gravados por cima dos iniciais: valor desconhecido volta ao inicial. */
function vencimentosDe(valor: unknown): PadroesDeVencimento {
  const gravado = valor && typeof valor === "object" ? (valor as Record<string, unknown>) : {};
  const padroes = { ...PADROES_DE_VENCIMENTO_INICIAIS };
  for (const chave of PADROES_DE_VENCIMENTO) {
    const ajuste = AJUSTES_DE_DIA_UTIL.find((item) => item === gravado[chave]);
    if (ajuste) padroes[chave] = ajuste;
  }
  return padroes;
}
