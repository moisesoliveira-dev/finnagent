import { cn } from "./cn";

const formatoDeReais = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

/** Valor em reais como texto, para rótulo e frase. Na tela, use `Money`. */
export function formatarReais(cents: number) {
  return formatoDeReais.format(cents / 100);
}

export function Money({
  cents,
  strong = false,
  acumulado = false,
}: {
  cents: number;
  strong?: boolean;
  acumulado?: boolean;
}) {
  const amount = formatarReais(Math.abs(cents));
  const sign = cents > 0 ? "+" : cents < 0 ? "−" : "";
  const tone = cents > 0 ? "text-pos" : cents < 0 ? "text-neg" : "text-ink";
  const marca =
    acumulado && cents > 0
      ? "rounded-sm bg-pos-soft px-2 font-bold"
      : acumulado && cents < 0
        ? "rounded-sm bg-neg-soft px-2 font-bold"
        : strong
          ? "font-semibold"
          : "font-medium";

  return (
    <span className={cn("text-right tabular-nums", marca, tone)}>
      {sign ? `${sign} ${amount}` : amount}
    </span>
  );
}
