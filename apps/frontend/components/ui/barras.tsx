"use client";

import { motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { cn, focusRing } from "./cn";
import { formatarReais, Money } from "./money";
import { useCurva } from "./movimento";

export type Barra = {
  id: string;
  // Texto curto sob a barra (vazio quando não cabe). `rotulo` é o nome inteiro, lido ao apontar e por leitor de tela.
  curto: string;
  rotulo: string;
  cents: number;
};

// Barras de saldo ao redor de uma linha de zero: o que sobra sobe (`pos`), o que falta desce (`neg`).
// Cada barra é um botão. Apontar, focar ou tocar mostra o valor na linha abaixo do gráfico.
export function Barras({
  barras,
  ativo,
  onEscolher,
  ariaLabel,
}: {
  barras: Barra[];
  ativo?: string;
  onEscolher: (id: string) => void;
  ariaLabel: string;
}) {
  const curva = useCurva();
  const reduzir = useReducedMotion();
  const [foco, setFoco] = useState<string | null>(null);
  const maior = Math.max(1, ...barras.map((barra) => Math.abs(barra.cents)));
  const denso = barras.length > 16;
  const lido = barras.find((barra) => barra.id === (foco ?? ativo));

  return (
    <div className="grid min-w-0 gap-2">
      <div
        role="group"
        aria-label={ariaLabel}
        className="grid aspect-video min-w-0 auto-cols-fr grid-flow-col border border-line bg-surface"
      >
        {barras.map((barra, indice) => {
          const parte = barra.cents === 0 ? 0 : Math.max(2, Math.round((Math.abs(barra.cents) / maior) * 100));
          const entrada = {
            initial: { scaleY: 0 },
            animate: { scaleY: 1 },
            transition: { ...curva, delay: reduzir ? 0 : indice * 0.025 },
          };
          return (
            <button
              key={barra.id}
              type="button"
              aria-label={`${barra.rotulo}: ${formatarReais(barra.cents)}`}
              aria-pressed={ativo === barra.id}
              onClick={() => onEscolher(barra.id)}
              onMouseEnter={() => setFoco(barra.id)}
              onMouseLeave={() => setFoco(null)}
              onFocus={() => setFoco(barra.id)}
              onBlur={() => setFoco(null)}
              className={cn(
                "grid min-w-0 grid-rows-2 border-r border-line transition-colors last:border-r-0 hover:bg-brand-soft",
                ativo === barra.id && "bg-brand-soft",
                focusRing,
              )}
            >
              <span className={cn("flex items-end justify-center border-b border-line", denso ? "px-0" : "px-1")}>
                {barra.cents > 0 ? (
                  <motion.span
                    className="w-full origin-bottom bg-pos"
                    style={{ height: `${parte}%` }}
                    {...entrada}
                  />
                ) : null}
              </span>
              <span className={cn("flex items-start justify-center", denso ? "px-0" : "px-1")}>
                {barra.cents < 0 ? (
                  <motion.span className="w-full origin-top bg-neg" style={{ height: `${parte}%` }} {...entrada} />
                ) : null}
              </span>
            </button>
          );
        })}
      </div>
      <div aria-hidden="true" className="grid auto-cols-fr grid-flow-col">
        {barras.map((barra) => (
          <span
            key={barra.id}
            className={cn("etiqueta min-w-0 text-center", ativo === barra.id ? "text-brand" : "text-ink-2")}
          >
            {barra.curto}
          </span>
        ))}
      </div>
      <p aria-live="polite" className="flex min-h-10 items-center justify-between gap-3 text-sm">
        {lido ? (
          <>
            <span className="etiqueta text-ink-2">{lido.rotulo}</span>
            <Money cents={lido.cents} strong />
          </>
        ) : (
          <span className="text-ink-2">Passe o mouse ou toque em uma barra para ver o valor.</span>
        )}
      </p>
    </div>
  );
}
