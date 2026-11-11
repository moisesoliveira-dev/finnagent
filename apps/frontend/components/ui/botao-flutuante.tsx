"use client";

import { cn, focusRing } from "./cn";
import { Icone } from "./icone";

/**
 * A ação principal da tela no celular, ao alcance do polegar: um quadrado amarelo no canto, acima da barra de baixo.
 * É o botão `primary` da tela, então o do cabeçalho some no celular (`hidden tab:inline-flex`): um amarelo por área.
 */
export function BotaoFlutuante({
  rotulo,
  onClick,
  disabled = false,
}: {
  /** O que a ação faz, como "Novo lançamento". Vai no `aria-label` e na dica. */
  rotulo: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={rotulo}
      title={rotulo}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "acima-da-barra fixed right-4 z-20 mb-4 inline-flex size-12 items-center justify-center bg-cta text-cta-ink transition-opacity hover:opacity-90 disabled:opacity-50 tab:hidden",
        focusRing,
      )}
    >
      <Icone name="add" />
    </button>
  );
}
