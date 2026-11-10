const MOEDA = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/** Centavos em reais. Sinal e cor ficam com quem chama. */
export const reais = (cents: number) => MOEDA.format(cents / 100);

export const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
export const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
export const SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

export type Mes = { ano: number; mes: number };

export function mesDeHoje(): Mes {
  const agora = new Date();
  return { ano: agora.getFullYear(), mes: agora.getMonth() + 1 };
}

export function somarMes({ ano, mes }: Mes, passo: number): Mes {
  const indice = ano * 12 + (mes - 1) + passo;
  return { ano: Math.floor(indice / 12), mes: (indice % 12) + 1 };
}

export const rotuloDoMes = ({ ano, mes }: Mes) => `${MESES[mes - 1]} de ${ano}`;

export function diaDaSemana(ano: number, mes: number, dia: number) {
  return SEMANA[new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay()] ?? "";
}

/** "seg 30/nov" a partir de 2026-11-30. */
export function dataCurta(iso: string) {
  const [ano, mes, dia] = iso.split("-").map(Number) as [number, number, number];
  return `${diaDaSemana(ano, mes, dia)} ${String(dia).padStart(2, "0")}/${MESES_CURTOS[mes - 1]}`;
}

/** Dia e hora de um instante, como "30 de out. de 2026 14:05". */
export function dataEHora(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
}

/** "out. de 2026", para o "membro desde". */
export function desde(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", { month: "short", year: "numeric" }).format(new Date(iso)).replace(".", "");
}

/** Reais digitados ("1.234,56", "1234.56" ou "-50") em centavos, sem o sinal. null quando não é número. */
export function centavosDe(texto: string) {
  const limpo = texto.trim().replace(/^[-−]/, "").replace(/\s|R\$/g, "");
  if (!limpo) return null;
  // Com vírgula, o ponto é de milhar. Sem vírgula, "1.234" também é milhar; "12.5" é decimal.
  const milhar = limpo.includes(",") || /^\d{1,3}(\.\d{3})+$/.test(limpo);
  const normal = milhar ? limpo.replace(/\./g, "").replace(",", ".") : limpo;
  const valor = Number(normal);
  return Number.isFinite(valor) ? Math.round(valor * 100) : null;
}

/** Centavos no campo de texto, sem sinal e sem o R$: 123456 vira "1234,56". */
export function paraCampo(cents: number) {
  return (Math.abs(cents) / 100).toFixed(2).replace(".", ",");
}

export function hojeIso() {
  const agora = new Date();
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}-${String(agora.getDate()).padStart(2, "0")}`;
}

export const ehDataIso = (texto: string) => /^\d{4}-\d{2}-\d{2}$/.test(texto) && !Number.isNaN(Date.parse(texto));
