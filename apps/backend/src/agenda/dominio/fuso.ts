export type PartesLocais = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

export function partesNoFuso(instante: Date, timeZone: string): PartesLocais {
  const formato = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const mapa = new Map(formato.formatToParts(instante).map((parte) => [parte.type, parte.value]));
  let hour = Number(mapa.get("hour"));
  let day = Number(mapa.get("day"));
  let month = Number(mapa.get("month"));
  let year = Number(mapa.get("year"));
  if (hour === 24) hour = 0;
  return { year, month, day, hour, minute: Number(mapa.get("minute")) };
}

export function instanteNoFuso(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
) {
  const chute = new Date(Date.UTC(year, month - 1, day, hour, minute));
  const visto = partesNoFuso(chute, timeZone);
  const deslocamento = Date.UTC(year, month - 1, day, hour, minute) - Date.UTC(visto.year, visto.month - 1, visto.day, visto.hour, visto.minute);
  return new Date(chute.getTime() + deslocamento);
}

export function montarIntervalo(pedido: {
  allDay: boolean;
  year: number;
  month: number;
  day: number;
  time: string | null;
  endTime: string | null;
  timezone: string;
}) {
  if (pedido.allDay) {
    return {
      startAt: instanteNoFuso(pedido.year, pedido.month, pedido.day, 0, 0, pedido.timezone),
      endAt: instanteNoFuso(pedido.year, pedido.month, pedido.day, 23, 59, pedido.timezone),
      hour: null,
      minute: null,
    };
  }
  const inicio = minutos(pedido.time);
  const fim = minutos(pedido.endTime);
  if (!inicio || !fim) return "hora" as const;
  if (fim.total <= inicio.total) return "ordem" as const;
  return {
    startAt: instanteNoFuso(pedido.year, pedido.month, pedido.day, inicio.hour, inicio.minute, pedido.timezone),
    endAt: instanteNoFuso(pedido.year, pedido.month, pedido.day, fim.hour, fim.minute, pedido.timezone),
    hour: inicio.hour,
    minute: inicio.minute,
  };
}

function minutos(valor: string | null) {
  if (!valor) return null;
  const [horaTexto, minutoTexto] = valor.split(":");
  const hour = Number(horaTexto);
  const minute = Number(minutoTexto);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null;
  return { hour, minute, total: hour * 60 + minute };
}
