import { cn } from "./cn";

const formatoDeReais = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

/** Valor em reais como texto, para rótulo e frase. Na tela, use `Money`. */
export function formatarReais(cents: number) {
  return formatoDeReais.format(cents / 100);
}

/** Valor com sinal ("+ R$ 10,00", "− R$ 10,00"). É o texto do `Money`, para quem anima o número. */
export function textoDoValor(cents: number) {
  const sign = cents > 0 ? "+" : cents < 0 ? "−" : "";
  const amount = formatarReais(Math.abs(cents));
  return sign ? `${sign} ${amount}` : amount;
}

export function tomDoValor(cents: number) {
  return cents > 0 ? "text-pos" : cents < 0 ? "text-neg" : "text-ink";
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
  const tone = tomDoValor(cents);
  const marca =
    acumulado && cents > 0
      ? "rounded-sm bg-pos-soft px-2 font-bold"
      : acumulado && cents < 0
        ? "rounded-sm bg-neg-soft px-2 font-bold"
        : strong
          ? "font-semibold"
          : "font-medium";

  return (
    <span className={cn("text-right tabular-nums", marca, tone)}>{textoDoValor(cents)}</span>
  );
}
