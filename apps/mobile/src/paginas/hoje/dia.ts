import type { CategoriaTransacao, HojeResposta, PerguntaDeGasto, Tarefa, VencimentoDoDia } from "@finnagent/contracts";

export const ROTULO_CATEGORIA: Record<CategoriaTransacao, string> = {
  additional: "Extra",
  installment: "Parcela",
  loan: "Empréstimo",
  fixed: "Recorrente",
  unique: "Única",
};

/** AAAA-MM-DD somado de dias, sem passar pelo fuso. */
export function somarDias(iso: string, dias: number) {
  const [ano, mes, dia] = iso.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(ano, mes - 1, dia + dias)).toISOString().slice(0, 10);
}

export const ehData = (valor: string) => /^\d{4}-\d{2}-\d{2}$/.test(valor);

function dataLocal(iso: string) {
  const [ano, mes, dia] = iso.split("-").map(Number) as [number, number, number];
  return new Date(ano, mes - 1, dia);
}

/** "Sexta-feira, 6 de novembro". */
export function rotuloDoDia(iso: string) {
  const texto = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long" }).format(dataLocal(iso));
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** "5 de nov", para a tarefa ou o vencimento que ficou de outro dia. */
export function rotuloCurto(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short" }).format(dataLocal(iso)).replace(".", "");
}

export function detalhesDoVencimento(item: VencimentoDoDia) {
  return [item.counterparty || `${item.groupName} › ${item.sessionName}`, ROTULO_CATEGORIA[item.category]].join(" · ");
}

/** As filhas diretas de uma tarefa (ou as da raiz, com null), na ordem em que a pessoa as deixou. */
export function filhasDe(tarefas: Tarefa[], id: string | null) {
  return tarefas.filter((item) => item.parentId === id).sort((a, b) => a.position - b.position);
}

/** Quantos itens do dia já foram feitos, de quantos: compromissos, vencimentos e tarefas (com as subatividades). */
export function andamento(dados: Pick<HojeResposta, "compromissos" | "vencimentos" | "tarefas">) {
  const abertas =
    dados.compromissos.filter((item) => item.status !== "done").length +
    dados.vencimentos.filter((item) => item.situation !== "completed").length +
    dados.tarefas.filter((item) => !item.doneOn).length;
  const total = dados.compromissos.length + dados.vencimentos.length + dados.tarefas.length;
  return { feitas: total - abertas, total };
}

/** O web tem as próprias URLs; no app a conferência é uma aba de Extratos. */
export function rotaDaPendencia(href: string) {
  if (href.startsWith("/extratos/conferencia")) return "/extratos?aba=conferencia";
  if (href.startsWith("/extratos")) return "/extratos";
  return href;
}

export type LinhaDoResumo = {
  chave: string;
  titulo: string;
  detalhe: string;
  feito: boolean;
  cents: number | null;
  evento: boolean;
};

/** As primeiras linhas do dia para o bloco da tela inicial: o atrasado primeiro, depois a agenda, os pagamentos, as tarefas e as pendências. */
export function resumoDoDia(dados: HojeResposta, limite: number): LinhaDoResumo[] {
  const linhas: LinhaDoResumo[] = [];
  for (const item of dados.vencimentos.filter((venc) => venc.situation === "late")) {
    linhas.push({ chave: `v-${item.entryId}-${item.number}`, titulo: item.description, detalhe: `Venceu em ${rotuloCurto(item.dueDate)}`, feito: false, cents: item.cents, evento: false });
  }
  for (const item of dados.compromissos) {
    linhas.push({ chave: `c-${item.id}`, titulo: item.title, detalhe: item.allDay ? "Dia todo" : (item.time ?? item.calendar), feito: item.status === "done", cents: null, evento: true });
  }
  for (const item of dados.vencimentos.filter((venc) => venc.situation !== "late")) {
    linhas.push({ chave: `v-${item.entryId}-${item.number}`, titulo: item.description, detalhe: item.situation === "completed" ? "Pago" : "Vence hoje", feito: item.situation === "completed", cents: item.cents, evento: false });
  }
  for (const item of filhasDe(dados.tarefas, null).filter((tarefa) => !tarefa.doneOn)) {
    linhas.push({ chave: `t-${item.id}`, titulo: item.title, detalhe: item.date < dados.date ? `Ficou de ${rotuloCurto(item.date)}` : "Tarefa", feito: false, cents: null, evento: false });
  }
  for (const item of dados.pendencias) {
    linhas.push({ chave: `p-${item.id}`, titulo: item.title, detalhe: item.detail, feito: false, cents: null, evento: false });
  }
  return linhas.slice(0, limite);
}

/** Os dígitos digitados no campo de valor, lidos como centavos: "1234" vale R$ 12,34. Até 11 dígitos. */
export function centavosDosDigitos(texto: string) {
  const digitos = texto.replace(/\D/g, "").replace(/^0+/, "").slice(0, 11);
  return digitos ? Number(digitos) : 0;
}

/** "terminou às 14:30", "terminou ontem às 14:30" ou "terminou em 4 de nov às 14:30". */
export function quandoTerminou(pergunta: Pick<PerguntaDeGasto, "date" | "endedAtLocal">, today: string) {
  const dia = pergunta.date >= today ? "" : pergunta.date === somarDias(today, -1) ? "ontem " : `em ${rotuloCurto(pergunta.date)} `;
  return `terminou ${dia}às ${pergunta.endedAtLocal}`;
}
