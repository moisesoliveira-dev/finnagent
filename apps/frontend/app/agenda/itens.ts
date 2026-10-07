import type { CategoriaCompromisso, Compromisso, LancamentoDoMes, NomeAgenda } from "@finnagent/contracts";

export type ItemDia = {
  id: string;
  kind: "compromisso" | "lancamento";
  day: number;
  time: string | null;
  title: string;
  calendar: NomeAgenda | null;
  category: CategoriaCompromisso | null;
  link: { groupName: string; sessionName: string; cents: number } | null;
};

export function rotuloDaCategoria(categoria: CategoriaCompromisso) {
  if (categoria === "recorrente") return "Recorrente";
  if (categoria === "validade") return "Validade";
  return "Único";
}

export function montarItens(
  appointments: Compromisso[],
  entries: LancamentoDoMes[],
  camadas: { compromisso: boolean; lancamento: boolean },
) {
  const itens: ItemDia[] = [];
  if (camadas.compromisso) {
    for (const item of appointments) {
      itens.push({
        id: item.id,
        kind: "compromisso",
        day: item.day,
        time: item.time,
        title: item.title,
        calendar: item.calendar,
        category: item.category,
        link: item.link,
      });
    }
  }
  if (camadas.lancamento) {
    for (const item of entries) {
      itens.push({
        id: `lancamento-${item.id}`,
        kind: "lancamento",
        day: item.day,
        time: null,
        title: item.description,
        calendar: null,
        category: null,
        link: {
          groupName: item.groupName,
          sessionName: item.sessionName,
          cents: item.cents,
        },
      });
    }
  }
  return itens.sort((a, b) => (a.time ?? "").localeCompare(b.time ?? "") || a.title.localeCompare(b.title));
}

export function itensNoDia(itens: ItemDia[], day: number) {
  return itens.filter((item) => item.day === day);
}

export function rotuloDoDia(year: number, month: number, day: number) {
  const texto = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(year, month - 1, day));
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export function ehHoje(year: number, month: number, day: number) {
  const hoje = new Date();
  return hoje.getFullYear() === year && hoje.getMonth() === month - 1 && hoje.getDate() === day;
}

export function statusDoDia(year: number, month: number, day: number) {
  const hoje = new Date();
  const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const data = new Date(year, month - 1, day);
  return data < inicio ? "pago" : "previsto";
}

export function diasDoMes(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}
