import { Injectable } from "@nestjs/common";
import {
  CATEGORIAS_COMPROMISSO,
  type CategoriaCompromisso,
  type Compromisso,
  type NomeAgenda,
} from "@finnagent/contracts";
import { gravarOutbox, marcaDe } from "../../persistencia/gravar-outbox.js";
import { PrismaService } from "../../persistencia/prisma.service.js";
import { BancoIndisponivel } from "../../grupos/dominio/erros.js";
import type { AgendaRepositorio, NovoCompromisso } from "../portas/agenda-repositorio.js";

@Injectable()
export class PrismaAgendaRepositorio implements AgendaRepositorio {
  constructor(private readonly prisma: PrismaService) {}

  async listarQueAlcancam(tenantId: string, year: number, month: number) {
    const db = this.banco();
    const rows = await db.appointment.findMany({
      where: {
        tenantId,
        OR: [
          { category: "unico", year, month },
          { category: "recorrente", year, month: { lte: month } },
          { category: "validade", year: { lte: year }, endYear: { gte: year } },
        ],
      },
      orderBy: [{ day: "asc" }, { hour: "asc" }, { minute: "asc" }],
    });
    return rows.map((row) => compromissoDe(row));
  }

  async criar(tenantId: string, pedido: NovoCompromisso) {
    const db = this.banco();
    const hora = horaDe(pedido.time);
    return db.$transaction(async (tx) => {
      const atual = await tx.appointment.findFirst({ where: { id: pedido.id, tenantId } });
      if (atual) {
        if (mesmoCompromisso(atual, pedido)) return compromissoDe(atual);
        return "identificador" as const;
      }
      if (pedido.entryId) {
        const lancamento = await tx.entry.findFirst({
          where: { id: pedido.entryId, tenantId },
        });
        if (!lancamento) return "lancamento-ausente" as const;
      }
      const criado = await tx.appointment.create({
        data: {
          id: pedido.id,
          tenantId,
          title: pedido.title,
          year: pedido.year,
          month: pedido.month,
          day: pedido.day,
          hour: hora?.hour ?? null,
          minute: hora?.minute ?? null,
          calendar: pedido.calendar,
          category: pedido.category,
          endYear: pedido.endYear,
          endMonth: pedido.endMonth,
          endDay: pedido.endDay,
          entryId: pedido.entryId,
        },
      });
      await gravarOutbox(tx, tenantId, "criar-compromisso", pedido.id, pedido, marcaDe(pedido));
      return compromissoDe(criado);
    });
  }

  private banco() {
    if (!this.prisma.ativo) throw new BancoIndisponivel();
    return this.prisma;
  }
}

function horaDe(time: string | null) {
  if (!time) return null;
  const [hour, minute] = time.split(":").map(Number);
  return { hour, minute };
}

function tempoDe(hour: number | null, minute: number | null) {
  if (hour == null || minute == null) return null;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function compromissoDe(row: {
  id: string;
  title: string;
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
}): Compromisso {
  return {
    id: row.id,
    title: row.title,
    year: row.year,
    month: row.month,
    day: row.day,
    time: tempoDe(row.hour, row.minute),
    calendar: row.calendar as NomeAgenda,
    category: categoriaDe(row.category),
    endYear: row.endYear,
    endMonth: row.endMonth,
    endDay: row.endDay,
    entryId: row.entryId,
    link: null,
  };
}

function categoriaDe(valor: string): CategoriaCompromisso {
  return CATEGORIAS_COMPROMISSO.find((categoria) => categoria === valor) ?? "unico";
}

function mesmoCompromisso(
  atual: {
    title: string;
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
  },
  pedido: NovoCompromisso,
) {
  const hora = horaDe(pedido.time);
  return (
    atual.title === pedido.title &&
    atual.year === pedido.year &&
    atual.month === pedido.month &&
    atual.day === pedido.day &&
    atual.hour === (hora?.hour ?? null) &&
    atual.minute === (hora?.minute ?? null) &&
    atual.calendar === pedido.calendar &&
    atual.category === pedido.category &&
    atual.endYear === pedido.endYear &&
    atual.endMonth === pedido.endMonth &&
    atual.endDay === pedido.endDay &&
    atual.entryId === pedido.entryId
  );
}
