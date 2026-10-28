const formatos = new Map<string, Intl.DateTimeFormat>();

// Um formato por fuso e por jeito: criar Intl.DateTimeFormat a cada linha pesa numa lista de 50.
function formato(fuso: string, jeito: string, opcoes: Intl.DateTimeFormatOptions) {
  const chave = `${fuso}|${jeito}`;
  let pronto = formatos.get(chave);
  if (!pronto) {
    pronto = new Intl.DateTimeFormat(jeito === "iso" ? "en-CA" : "pt-BR", { timeZone: fuso, ...opcoes });
    formatos.set(chave, pronto);
  }
  return pronto;
}

/** 18:12, no fuso da conta. */
export function hora(iso: string, fuso: string) {
  return formato(fuso, "hora", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso));
}

/** 28/10/2026 18:12:03, no fuso da conta. */
export function dataHora(iso: string, fuso: string) {
  return formato(fuso, "dataHora", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  })
    .format(new Date(iso))
    .replace(",", "");
}

/** O dia (AAAA-MM-DD) em que o instante cai no fuso da conta. */
export function diaNoFuso(iso: string, fuso: string) {
  return formato(fuso, "iso", { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
}

function meioDia(dia: string) {
  return new Date(`${dia}T12:00:00Z`);
}

function diaAnterior(dia: string) {
  const data = meioDia(dia);
  data.setUTCDate(data.getUTCDate() - 1);
  return data.toISOString().slice(0, 10);
}

/** "Hoje", "Ontem" ou "ter, 27 de out". */
export function rotuloDoDia(dia: string, hoje: string) {
  if (dia === hoje) return "Hoje";
  if (dia === diaAnterior(hoje)) return "Ontem";
  return formato("UTC", "diaDaSemana", { weekday: "short", day: "numeric", month: "short" })
    .format(meioDia(dia))
    .replace(/\./g, "");
}

/** "28 out", para o eixo do volume. */
export function diaCurto(dia: string) {
  return formato("UTC", "diaCurto", { day: "numeric", month: "short" })
    .format(meioDia(dia))
    .replace(/\./g, "")
    .replace(" de ", " ");
}

/** "terça, 28 de outubro", para ler um dia do volume. */
export function diaPorExtenso(dia: string) {
  return formato("UTC", "diaPorExtenso", { weekday: "long", day: "numeric", month: "long" }).format(meioDia(dia));
}

/** 3 ms, 1,2 s, 4 min ou 2,5 h. */
export function intervalo(ms: number) {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1).replace(".", ",")} s`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)} min`;
  return `${(ms / 3_600_000).toFixed(1).replace(".", ",")} h`;
}

export function quantos(numero: number, um: string, varios: string) {
  return `${numero.toLocaleString("pt-BR")} ${numero === 1 ? um : varios}`;
}
