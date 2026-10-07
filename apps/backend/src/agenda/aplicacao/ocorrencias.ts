import type { CategoriaCompromisso, Compromisso } from "@finnagent/contracts";

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
  anoAtual: number,
) {
  if (!diaExiste(pedido.year, pedido.month, pedido.day)) return "Esse dia não existe nesse mês.";
  if (pedido.category === "recorrente") {
    if (pedido.year !== anoAtual) return "O recorrente fica só no ano atual.";
    if (pedido.endYear != null || pedido.endMonth != null || pedido.endDay != null) {
      return "O recorrente termina em dezembro deste ano.";
    }
    return null;
  }
  if (pedido.category === "unico") {
    if (pedido.endYear != null || pedido.endMonth != null || pedido.endDay != null) {
      return "O único não tem período.";
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

export function ocorrenciasNoMes(definicao: Compromisso, year: number, month: number) {
  const ultimo = new Date(year, month, 0).getDate();
  if (definicao.category === "unico") {
    if (definicao.year !== year || definicao.month !== month) return [];
    return [noDia(definicao, year, month, definicao.day)];
  }
  if (definicao.category === "recorrente") {
    if (definicao.year !== year || month < definicao.month) return [];
    const day = month === definicao.month ? definicao.day : Math.min(definicao.day, ultimo);
    return [noDia(definicao, year, month, day)];
  }
  if (definicao.endYear == null || definicao.endMonth == null || definicao.endDay == null) return [];
  const inicio = Math.max(numero(definicao.year, definicao.month, definicao.day), numero(year, month, 1));
  const fim = Math.min(
    numero(definicao.endYear, definicao.endMonth, definicao.endDay),
    numero(year, month, ultimo),
  );
  const ocorrencias: Compromisso[] = [];
  for (let cursor = inicio; cursor <= fim; cursor += 1) {
    const data = deNumero(cursor);
    if (data.year === year && data.month === month) ocorrencias.push(noDia(definicao, year, month, data.day));
  }
  return ocorrencias;
}

function diaExiste(year: number, month: number, day: number) {
  return day >= 1 && day <= new Date(year, month, 0).getDate();
}

function numero(year: number, month: number, day: number) {
  return year * 10000 + month * 100 + day;
}

function deNumero(valor: number) {
  return {
    year: Math.floor(valor / 10000),
    month: Math.floor((valor % 10000) / 100),
    day: valor % 100,
  };
}

function noDia(definicao: Compromisso, year: number, month: number, day: number): Compromisso {
  return { ...definicao, year, month, day, link: null };
}
