const fuso = "America/Sao_Paulo";

export function inicioDaSessao(agora = new Date()) {
  const { ano, mes } = calendario(agora);
  return data(ano, mes, 1);
}

export function fimDaSessao(agora = new Date()) {
  const { ano, mes, dia } = calendario(agora);
  return data(ano, mes, dia);
}

function calendario(agora: Date) {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: fuso,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(agora);
  const numero = (tipo: Intl.DateTimeFormatPartTypes) =>
    Number(partes.find((parte) => parte.type === tipo)?.value);
  return { ano: numero("year"), mes: numero("month"), dia: numero("day") };
}

function data(ano: number, mes: number, dia: number) {
  return `${String(ano).padStart(4, "0")}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}
