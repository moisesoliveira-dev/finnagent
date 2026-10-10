import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import {
  AGENDAS,
  CATEGORIAS_COMPROMISSO,
  FUSO_PADRAO,
  FUSOS_AGENDA,
  STATUS_COMPROMISSO,
  type CategoriaCompromisso,
  type Compromisso,
  type FusoAgenda,
  type NomeAgenda,
  type StatusCompromisso,
} from "@finnagent/contracts";
import { gravarOutbox, marcaDe } from "../../persistencia/gravar-outbox.js";
import { PrismaService } from "../../persistencia/prisma.service.js";
import { BancoIndisponivel } from "../../grupos/dominio/erros.js";
import { partesNoFuso } from "../dominio/fuso.js";
import type { EventoGoogle } from "../dominio/sincronizar.js";
import type { AgendaRepositorio, NovoCompromisso } from "../portas/agenda-repositorio.js";
import type { Prisma } from "@prisma/client";

@Injectable()
export class PrismaAgendaRepositorio implements AgendaRepositorio {
  constructor(private readonly prisma: PrismaService) {}

  async listarCalendarios(tenantId: string) {
    const db = this.banco();
    const rows = await db.calendar.findMany({ where: { tenantId } });
    return AGENDAS.map((name) => ({
      name,
      timezone: fusoDe(rows.find((row) => row.name === name)?.timezone ?? FUSO_PADRAO),
    }));
  }

  async listarQueAlcancam(tenantId: string, year: number, month: number) {
    const db = this.banco();
    const fusos = await this.mapaDeFusos(db, tenantId);
    const rows = await db.appointment.findMany({
      where: {
        tenantId,
        OR: [
          { category: "fixed", year, month },
          {
            category: "periodical",
            OR: [{ year: { lt: year } }, { year, month: { lte: month } }],
          },
          {
            category: "time",
            AND: [
              { OR: [{ year: { lt: year } }, { year, month: { lte: month } }] },
              { OR: [{ endYear: { gt: year } }, { endYear: year, endMonth: { gte: month } }] },
            ],
          },
        ],
      },
      orderBy: [{ day: "asc" }, { hour: "asc" }, { minute: "asc" }],
    });
    return rows.map((row) => compromissoDe(row, fusos.get(row.calendar) ?? FUSO_PADRAO));
  }

  async criar(tenantId: string, pedido: NovoCompromisso) {
    const db = this.banco();
    return db.$transaction(async (tx) => {
      const atual = await tx.appointment.findFirst({ where: { id: pedido.id, tenantId } });
      if (atual) {
        if (!mesmoCompromisso(atual, pedido)) return "identificador" as const;
        const fuso = await tx.calendar.findFirst({ where: { tenantId, name: pedido.calendar } });
        if (fuso?.timezone !== pedido.timezone) {
          await this.gravarFuso(tx, tenantId, pedido.calendar, pedido.timezone);
          const payload = { name: pedido.calendar, timezone: pedido.timezone };
          await gravarOutbox(
            tx,
            tenantId,
            "atualizar-fuso-calendario",
            pedido.calendar,
            payload,
            marcaDe(payload),
          );
        }
        return compromissoDe(atual, pedido.timezone);
      }
      if (pedido.entryId) {
        const lancamento = await tx.entry.findFirst({ where: { id: pedido.entryId, tenantId } });
        if (!lancamento) return "lancamento-ausente" as const;
      }
      const fuso = await tx.calendar.findFirst({ where: { tenantId, name: pedido.calendar } });
      const mudouFuso = fuso?.timezone !== pedido.timezone;
      await this.gravarFuso(tx, tenantId, pedido.calendar, pedido.timezone);
      const criado = await tx.appointment.create({ data: dadosDe(tenantId, pedido) });
      const serial = pedidoSerial(pedido);
      await gravarOutbox(tx, tenantId, "criar-compromisso", pedido.id, serial, marcaDe(serial));
      if (mudouFuso) {
        const payload = { name: pedido.calendar, timezone: pedido.timezone };
        await gravarOutbox(tx, tenantId, "atualizar-fuso-calendario", pedido.calendar, payload, marcaDe(payload));
      }
      return compromissoDe(criado, pedido.timezone);
    });
  }

  async atualizarFuso(tenantId: string, name: NomeAgenda, timezone: FusoAgenda) {
    const db = this.banco();
    return db.$transaction(async (tx) => {
      const atual = await tx.calendar.findFirst({ where: { tenantId, name } });
      if (atual?.timezone === timezone) return { name, timezone };
      await this.gravarFuso(tx, tenantId, name, timezone);
      await gravarOutbox(
        tx,
        tenantId,
        "atualizar-fuso-calendario",
        name,
        { name, timezone },
        marcaDe({ name, timezone }),
      );
      return { name, timezone };
    });
  }

  async atualizarStatus(tenantId: string, id: string, status: StatusCompromisso) {
    const db = this.banco();
    return db.$transaction(async (tx) => {
      const atual = await tx.appointment.findFirst({ where: { id, tenantId } });
      if (!atual) return "ausente" as const;
      const fusos = await this.mapaDeFusos(tx, tenantId);
      const timezone = fusos.get(atual.calendar) ?? FUSO_PADRAO;
      if (atual.status === status) return compromissoDe(atual, timezone);
      await tx.appointment.updateMany({ where: { id, tenantId }, data: { status } });
      const salvo = await tx.appointment.findFirst({ where: { id, tenantId } });
      if (!salvo) throw new Error("Compromisso ausente depois de gravar o status.");
      const payload = { id, status };
      await gravarOutbox(tx, tenantId, "atualizar-status-compromisso", id, payload, marcaDe(payload));
      return compromissoDe(salvo, timezone);
    });
  }

  async aplicarGoogle(tenantId: string, eventos: EventoGoogle[]) {
    const db = this.banco();
    return db.$transaction(async (tx) => {
      const fusos = await this.mapaDeFusos(tx, tenantId);
      const prontos = eventos.map((evento) => ({ evento, timezone: fusos.get(evento.calendar) ?? FUSO_PADRAO }));
      const alterados: string[] = [];
      for (const { evento, timezone } of prontos) {
        const atual = await tx.appointment.findFirst({
          where: { tenantId, googleEventId: evento.id },
        });
        const dados = dadosDoGoogle(tenantId, evento, timezone);
        if (!atual) {
          await tx.appointment.create({ data: { ...dados, id: randomUUID(), tenantId } });
          alterados.push(evento.id);
          continue;
        }
        if (mesmoGoogle(atual, dados)) continue;
        await tx.appointment.updateMany({
          where: { id: atual.id, tenantId },
          data: dados,
        });
        alterados.push(evento.id);
      }
      if (alterados.length === 0) return { atualizados: 0 };
      await gravarOutbox(
        tx,
        tenantId,
        "sincronizar-google-agenda",
        tenantId,
        { eventos: alterados },
        marcaDe(eventos),
      );
      return { atualizados: alterados.length };
    });
  }

  private async mapaDeFusos(db: Prisma.TransactionClient | PrismaService, tenantId: string) {
    const rows = await db.calendar.findMany({ where: { tenantId } });
    return new Map(rows.map((row) => [row.name, fusoDe(row.timezone)]));
  }

  private async gravarFuso(
    tx: Prisma.TransactionClient,
    tenantId: string,
    name: NomeAgenda,
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

  private banco() {
    if (!this.prisma.ativo) throw new BancoIndisponivel();
    return this.prisma;
  }
}

function dadosDe(tenantId: string, pedido: NovoCompromisso) {
  return {
    id: pedido.id,
    tenantId,
    title: pedido.title,
    description: pedido.description,
    location: pedido.location,
    startAt: pedido.startAt,
    endAt: pedido.endAt,
    allDay: pedido.allDay,
    status: pedido.status,
    year: pedido.year,
    month: pedido.month,
    day: pedido.day,
    hour: pedido.hour,
    minute: pedido.minute,
    calendar: pedido.calendar,
    category: pedido.category,
    endYear: pedido.endYear,
    endMonth: pedido.endMonth,
    endDay: pedido.endDay,
    entryId: pedido.entryId,
  };
}

function dadosDoGoogle(tenantId: string, evento: EventoGoogle, timezone: FusoAgenda) {
  const inicio = new Date(evento.startAt);
  const fim = new Date(evento.endAt);
  const partes = partesNoFuso(inicio, timezone);
  return {
    tenantId,
    title: evento.title.slice(0, 80),
    description: evento.description.slice(0, 160),
    location: evento.location.slice(0, 160),
    startAt: inicio,
    endAt: fim,
    allDay: evento.allDay,
    year: partes.year,
    month: partes.month,
    day: partes.day,
    hour: evento.allDay ? null : partes.hour,
    minute: evento.allDay ? null : partes.minute,
    calendar: evento.calendar,
    category: "fixed",
    endYear: null,
    endMonth: null,
    endDay: null,
    googleEventId: evento.id,
  };
}

function pedidoSerial(pedido: NovoCompromisso) {
  return {
    ...pedido,
    startAt: pedido.startAt.toISOString(),
    endAt: pedido.endAt.toISOString(),
  };
}

type Linha = {
  id: string;
  title: string;
  description: string;
  location: string;
  startAt: Date;
  endAt: Date;
  allDay: boolean;
  status: string;
  year: number;
  month: number;
  day: number;
  hour: number | null;
  minute: number | null;
  calendar: string;
  category: string;
  endYear: number | null;
  endMonth: number | null;
  endDay: number | null;
  entryId: string | null;
  googleEventId?: string | null;
};

function compromissoDe(row: Linha, timezone: FusoAgenda): Compromisso {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    location: row.location,
    startAt: row.startAt.toISOString(),
    endAt: row.endAt.toISOString(),
    allDay: row.allDay,
    status: statusDe(row.status),
    year: row.year,
    month: row.month,
    day: row.day,
    time: tempoDe(row.hour, row.minute),
    calendar: agendaDe(row.calendar),
    timezone,
    category: categoriaDe(row.category),
    endYear: row.endYear,
    endMonth: row.endMonth,
    endDay: row.endDay,
    entryId: row.entryId,
    link: null,
  };
}

function mesmoCompromisso(atual: Linha, pedido: NovoCompromisso) {
  return (
    atual.title === pedido.title &&
    atual.description === pedido.description &&
    atual.location === pedido.location &&
    atual.allDay === pedido.allDay &&
    atual.startAt.getTime() === pedido.startAt.getTime() &&
    atual.endAt.getTime() === pedido.endAt.getTime() &&
    atual.year === pedido.year &&
    atual.month === pedido.month &&
    atual.day === pedido.day &&
    atual.hour === pedido.hour &&
    atual.minute === pedido.minute &&
    atual.calendar === pedido.calendar &&
    atual.category === pedido.category &&
    atual.endYear === pedido.endYear &&
    atual.endMonth === pedido.endMonth &&
    atual.endDay === pedido.endDay &&
    atual.entryId === pedido.entryId
  );
}

function mesmoGoogle(
  atual: Linha,
  dados: ReturnType<typeof dadosDoGoogle>,
) {
  return (
    atual.title === dados.title &&
    atual.description === dados.description &&
    atual.location === dados.location &&
    atual.allDay === dados.allDay &&
    atual.startAt.getTime() === dados.startAt.getTime() &&
    atual.endAt.getTime() === dados.endAt.getTime() &&
    atual.year === dados.year &&
    atual.month === dados.month &&
    atual.day === dados.day &&
    atual.hour === dados.hour &&
    atual.minute === dados.minute &&
    atual.calendar === dados.calendar &&
    atual.category === dados.category
  );
}

function tempoDe(hour: number | null, minute: number | null) {
  if (hour == null || minute == null) return null;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function categoriaDe(valor: string): CategoriaCompromisso {
  if (valor === "unico") return "fixed";
  if (valor === "recorrente") return "periodical";
  if (valor === "validade") return "time";
  return CATEGORIAS_COMPROMISSO.find((categoria) => categoria === valor) ?? "fixed";
}

function statusDe(valor: string): StatusCompromisso {
  return STATUS_COMPROMISSO.find((status) => status === valor) ?? "undone";
}

function fusoDe(valor: string): FusoAgenda {
  return FUSOS_AGENDA.find((fuso) => fuso === valor) ?? FUSO_PADRAO;
}

function agendaDe(valor: string): NomeAgenda {
  return AGENDAS.find((nome) => nome === valor) ?? "Pessoal";
}
