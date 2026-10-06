import { cn } from "./cn";

export function Money({ cents, strong = false }: { cents: number; strong?: boolean }) {
  const amount = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Math.abs(cents) / 100);
  const sign = cents > 0 ? "+" : cents < 0 ? "−" : "";
  const tone = cents > 0 ? "text-pos" : cents < 0 ? "text-neg" : "text-ink";

  return (
    <span className={cn("text-right tabular-nums", strong ? "font-semibold" : "font-medium", tone)}>
      {sign ? `${sign} ${amount}` : amount}
    </span>
  );
}
