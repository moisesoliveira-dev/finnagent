import type { CategoriaCompromisso, Compromisso } from "@finnagent/contracts";
import { instanteNoFuso, partesNoFuso } from "../dominio/fuso.js";

export function mensagemDaCategoria(
  pedido: {
    category: CategoriaCompromisso;
    year: number;
    month: number;
    day: number;
    endYear: number | null;
    endMonth: number | null;
    endDay: number | null;
  },
) {
  if (!diaExiste(pedido.year, pedido.month, pedido.day)) return "Esse dia não existe nesse mês.";
  if (pedido.category === "periodical") {
    if (pedido.endYear != null || pedido.endMonth != null || pedido.endDay != null) {
      return "O periódico não tem validade.";
    }
    return null;
  }
  if (pedido.category === "fixed") {
    if (pedido.endYear != null || pedido.endMonth != null || pedido.endDay != null) {
      return "O fixo não tem validade.";
    }
    return null;
  }
  if (pedido.endYear == null || pedido.endMonth == null || pedido.endDay == null) {
    return "Informe o fim da validade.";
  }
  if (!diaExiste(pedido.endYear, pedido.endMonth, pedido.endDay)) {
    return "Esse dia não existe nesse mês.";
  }
  if (numero(pedido.endYear, pedido.endMonth, pedido.endDay) < numero(pedido.year, pedido.month, pedido.day)) {
    return "A validade termina depois do início.";
  }
  return null;
}

type Validade = { endYear: number | null; endMonth: number | null; endDay: number | null };

export function comValidade<T extends Validade & { category: CategoriaCompromisso }>(pedido: T): T {
  if (pedido.category === "time") return pedido;
  return { ...pedido, endYear: null, endMonth: null, endDay: null };
}

export function validadeAoMover(
  atual: Validade & { category: CategoriaCompromisso },
  destino: { year: number; month: number; day: number },
): Validade {
  if (atual.category !== "time" || atual.endYear == null || atual.endMonth == null || atual.endDay == null) {
    return { endYear: null, endMonth: null, endDay: null };
  }
  if (numero(atual.endYear, atual.endMonth, atual.endDay) < numero(destino.year, destino.month, destino.day)) {
    return { endYear: destino.year, endMonth: destino.month, endDay: destino.day };
  }
  return { endYear: atual.endYear, endMonth: atual.endMonth, endDay: atual.endDay };
}

export function ocorrenciasNoMes(definicao: Compromisso, year: number, month: number) {
  const ultimo = new Date(year, month, 0).getDate();
  if (definicao.category === "fixed") {
    if (definicao.year !== year || definicao.month !== month) return [];
    return [noDia(definicao, year, month, definicao.day)];
  }
  if (numero(year, month, ultimo) < numero(definicao.year, definicao.month, definicao.day)) return [];
  const day = year === definicao.year && month === definicao.month ? definicao.day : Math.min(definicao.day, ultimo);
  const data = numero(year, month, day);
  if (data < numero(definicao.year, definicao.month, definicao.day)) return [];
  if (definicao.category === "time") {
    if (definicao.endYear == null || definicao.endMonth == null || definicao.endDay == null) return [];
    if (data > numero(definicao.endYear, definicao.endMonth, definicao.endDay)) return [];
  }
  return [noDia(definicao, year, month, day)];
}

function diaExiste(year: number, month: number, day: number) {
  return day >= 1 && day <= new Date(year, month, 0).getDate();
}

function numero(year: number, month: number, day: number) {
  return year * 10000 + month * 100 + day;
}

function noDia(definicao: Compromisso, year: number, month: number, day: number): Compromisso {
  const fim = partesNoFuso(new Date(definicao.endAt), definicao.timezone);
  const hora = definicao.allDay ? 0 : (partesNoFuso(new Date(definicao.startAt), definicao.timezone).hour);
  const minuto = definicao.allDay ? 0 : (partesNoFuso(new Date(definicao.startAt), definicao.timezone).minute);
  const startAt = instanteNoFuso(year, month, day, hora, minuto, definicao.timezone);
  const endAt = instanteNoFuso(
    year,
    month,
    day,
    definicao.allDay ? 23 : fim.hour,
    definicao.allDay ? 59 : fim.minute,
    definicao.timezone,
  );
  return {
    ...definicao,
    anchorYear: definicao.anchorYear ?? definicao.year,
    anchorMonth: definicao.anchorMonth ?? definicao.month,
    anchorDay: definicao.anchorDay ?? definicao.day,
    year,
    month,
    day,
    endTime: definicao.allDay
      ? null
      : `${String(fim.hour).padStart(2, "0")}:${String(fim.minute).padStart(2, "0")}`,
    startAt: startAt.toISOString(),
    endAt: endAt.toISOString(),
    link: null,
  };
}
