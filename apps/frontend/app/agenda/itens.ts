import type {
  CategoriaCompromisso,
  Compromisso,
  LancamentoDoMes,
  NomeAgenda,
  SituacaoOcorrencia,
  StatusCompromisso,
} from "@finnagent/contracts";

export type ItemDia = {
  id: string;
  kind: "compromisso" | "lancamento";
  day: number;
  time: string | null;
  title: string;
  description: string;
  location: string;
  status: StatusCompromisso | null;
  calendar: NomeAgenda | null;
  category: CategoriaCompromisso | null;
  link: { groupName: string; sessionName: string; cents: number; situation: SituacaoOcorrencia } | null;
  // Compromisso que acumula os gastos de uma sessão: `cents` é o que já foi pago nela no dia.
  acumula: { label: string; cents: number } | null;
};

export function rotuloDaCategoria(categoria: CategoriaCompromisso) {
  if (categoria === "periodical") return "Periódico";
  if (categoria === "time") return "Com validade";
  return "Fixo";
}

export function rotuloDoStatus(status: StatusCompromisso) {
  return status === "done" ? "Cumprido" : "Descumprido";
}

export function rotuloDoFuso(fuso: string) {
  if (fuso === "America/Sao_Paulo") return "Brasília";
  if (fuso === "America/Manaus") return "Manaus";
  if (fuso === "America/Rio_Branco") return "Rio Branco";
  if (fuso === "America/Noronha") return "Fernando de Noronha";
  if (fuso === "UTC") return "UTC";
  return fuso;
}

export function montarItens(
  appointments: Compromisso[],
  entries: LancamentoDoMes[],
  camadas: { compromisso: boolean; lancamento: boolean },
  calendarios: Record<NomeAgenda, boolean> = { Pessoal: true, Trabalho: true },
) {
  const itens: ItemDia[] = [];
  if (camadas.compromisso) {
    for (const item of appointments) {
      if (!calendarios[item.calendar]) continue;
      itens.push({
        id: item.id,
        kind: "compromisso",
        day: item.day,
        time: item.time,
        title: item.title,
        description: item.description,
        location: item.location,
        status: item.status,
        calendar: item.calendar,
        category: item.category,
        link: item.link,
        acumula: item.sessionLabel ? { label: item.sessionLabel, cents: item.spentCents } : null,
      });
    }
  }
  if (camadas.lancamento) {
    for (const item of entries) {
      itens.push({
        id: `lancamento-${item.id}-${item.number}`,
        kind: "lancamento",
        day: item.day,
        time: null,
        title: item.description,
        description: "",
        location: "",
        status: null,
        calendar: null,
        category: null,
        link: {
          groupName: item.groupName,
          sessionName: item.sessionName,
          cents: item.cents,
          situation: item.situation,
        },
        acumula: null,
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

export function diasDoMes(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}
