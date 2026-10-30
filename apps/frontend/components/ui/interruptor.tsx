"use client";

import { motion } from "motion/react";
import { cn, focusRing } from "./cn";
import { mola } from "./movimento";

/**
 * Chave liga e desliga. Ao lado de um `label` com `htmlFor={id}`, a dica dele descreve a chave (`${id}-dica`).
 * Sem label visível (uma célula de tabela), passe `rotulo`.
 */
export function Interruptor({
  id,
  checked,
  disabled = false,
  rotulo,
  onChange,
}: {
  id: string;
  checked: boolean;
  disabled?: boolean;
  rotulo?: string;
  onChange: (valor: boolean) => void;
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={rotulo}
      aria-describedby={rotulo ? undefined : `${id}-dica`}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn("inline-flex h-10 w-12 shrink-0 items-center", disabled && "opacity-50", focusRing)}
    >
      <span
        aria-hidden
        className={cn(
          "relative h-6 w-12 rounded-full border",
          checked ? "border-brand bg-brand" : "border-line bg-surface-2",
        )}
      >
        <motion.span
          className={cn("absolute top-1 left-1 size-4 rounded-full", checked ? "bg-brand-ink" : "bg-surface")}
          initial={false}
          animate={{ x: checked ? 24 : 0 }}
          transition={mola}
        />
      </span>
    </button>
  );
}
