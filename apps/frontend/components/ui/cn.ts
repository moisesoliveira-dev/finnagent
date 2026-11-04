import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const focusRing =
  "outline-none focus-visible:ring-3 focus-visible:ring-brand/40";

/** A caixa de marcar. O toque é o do `label` com `min-h-10` em volta; sem label, embrulhe num alvo de 40 px. */
export const caixaDeMarcar = `size-4 accent-brand ${focusRing}`;

export const campo = `min-h-10 min-w-0 rounded-sm border border-line bg-surface px-3 text-base text-ink disabled:cursor-default disabled:opacity-50 ${focusRing}`;
