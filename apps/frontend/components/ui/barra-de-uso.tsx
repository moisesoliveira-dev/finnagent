"use client";

import { motion } from "motion/react";
import { cn } from "./cn";
import { useCurva } from "./movimento";

const COR = { brand: "bg-brand", pos: "bg-pos", pending: "bg-pending", neg: "bg-neg" } as const;

// Uma barra fina de quanto de um total já foi usado ou juntado. `percent` acima de 100 enche a barra.
export function BarraDeUso({
  percent,
  tom = "brand",
  rotulo,
  className,
}: {
  percent: number;
  tom?: keyof typeof COR;
  rotulo: string;
  className?: string;
}) {
  const curva = useCurva();
  const parte = Math.min(Math.max(percent, 0), 100);
  return (
    <span
      role="meter"
      aria-label={rotulo}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(parte)}
      className={cn("block h-1 w-full min-w-0 overflow-hidden bg-line", className)}
    >
      <motion.span
        className={cn("block h-full origin-left", COR[tom])}
        style={{ width: `${parte}%` }}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={curva}
      />
    </span>
  );
}
