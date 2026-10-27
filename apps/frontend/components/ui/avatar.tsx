import type { TomDoAvatar } from "@finnagent/contracts";
import { cn } from "./cn";

// Cada cor é um par de tokens. Só o azul e o amarelo usam o fundo cheio, que tem texto próprio nos tokens.
const TONS: Record<TomDoAvatar, string> = {
  brand: "bg-brand text-brand-ink",
  event: "bg-event-soft text-event",
  pos: "bg-pos-soft text-pos",
  pending: "bg-pending-soft text-pending",
  neg: "bg-neg-soft text-neg",
  cta: "bg-cta text-cta-ink",
  ink: "bg-ink text-bg",
};

export const ROTULO_DO_TOM: Record<TomDoAvatar, string> = {
  brand: "Azul",
  event: "Índigo",
  pos: "Verde",
  pending: "Âmbar",
  neg: "Vermelho",
  cta: "Amarelo",
  ink: "Grafite",
};

export function iniciais(nome: string) {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  const primeira = partes[0].charAt(0);
  const ultima = partes.length > 1 ? (partes.at(-1) ?? "").charAt(0) : "";
  return `${primeira}${ultima}`.toLocaleUpperCase("pt-BR");
}

/** As iniciais do nome sobre a cor escolhida. O tamanho vem de quem usa (`size-8`, `w-1/3 aspect-square`...). */
export function Avatar({ nome, tom, className }: { nome: string; tom: TomDoAvatar; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid shrink-0 select-none place-items-center font-display font-bold tracking-titulo",
        TONS[tom],
        className,
      )}
    >
      {iniciais(nome)}
    </span>
  );
}
