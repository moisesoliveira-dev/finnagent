import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const focusRing =
  "outline-none focus-visible:ring-3 focus-visible:ring-brand/40";

export const campo = `min-h-10 min-w-0 rounded-sm border border-line bg-surface px-3 text-base text-ink disabled:cursor-default disabled:opacity-50 ${focusRing}`;
