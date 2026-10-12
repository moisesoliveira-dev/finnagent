import { cn } from "./cn";

export function Money({
  cents,
  strong = false,
  acumulado = false,
}: {
  cents: number;
  strong?: boolean;
  acumulado?: boolean;
}) {
  const amount = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Math.abs(cents) / 100);
  const sign = cents > 0 ? "+" : cents < 0 ? "−" : "";
  const tone = cents > 0 ? "text-pos" : cents < 0 ? "text-neg" : "text-ink";
  const marca =
    acumulado && cents > 0
      ? "rounded-sm bg-pos/20 px-2 font-bold"
      : acumulado && cents < 0
        ? "rounded-sm bg-neg/20 px-2 font-bold"
        : strong
          ? "font-semibold"
          : "font-medium";

  return (
    <span className={cn("text-right tabular-nums", marca, tone)}>
      {sign ? `${sign} ${amount}` : amount}
    </span>
  );
}
