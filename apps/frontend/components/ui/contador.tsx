"use client";

import { animate, useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";
import { cn } from "./cn";
import { textoDoValor, tomDoValor } from "./money";
import { curvaCheia } from "./movimento";

// Valor em reais que conta do número anterior até o novo. É o `Money` com movimento: mesmo sinal e mesma cor.
// Quem pede menos movimento vê o valor final de uma vez. O leitor de tela sempre lê só o valor final.
export function Contador({ cents, className }: { cents: number; className?: string }) {
  const reduzir = useReducedMotion();
  const alvo = useRef<HTMLSpanElement>(null);
  const atual = useRef(0);

  useEffect(() => {
    const no = alvo.current;
    if (!no) return;
    if (reduzir) {
      atual.current = cents;
      no.textContent = textoDoValor(cents);
      return;
    }
    const controle = animate(atual.current, cents, {
      duration: 0.9,
      ease: curvaCheia.ease,
      onUpdate: (valor) => {
        atual.current = valor;
        no.textContent = textoDoValor(Math.round(valor));
      },
    });
    return () => controle.stop();
  }, [cents, reduzir]);

  return (
    <span className={cn("text-right tabular-nums", tomDoValor(cents), className)}>
      <span ref={alvo} aria-hidden="true">
        {textoDoValor(0)}
      </span>
      <span className="sr-only">{textoDoValor(cents)}</span>
    </span>
  );
}
