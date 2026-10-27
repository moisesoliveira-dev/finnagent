"use client";

import { motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { cn } from "./cn";
import { curvaCheia } from "./movimento";

const ESPERA_NORMAL = 3000;

const pulso = { duration: 1.2, ease: "easeInOut", repeat: Infinity, repeatType: "reverse" } as const;

// Bloco reto que pulsa na opacidade. Quem pede menos movimento fica com o bloco parado.
export function Esqueleto({ className }: { className?: string }) {
  const reduzir = useReducedMotion();
  return (
    <motion.div
      aria-hidden="true"
      className={cn("border border-line bg-surface-2", className)}
      initial={{ opacity: 0.5 }}
      animate={reduzir ? { opacity: 0.8 } : { opacity: [0.5, 1] }}
      transition={reduzir ? { duration: 0 } : pulso}
    />
  );
}

// Espera de uma tela ou de uma seção: reserva o espaço do conteúdo e avisa o leitor de tela.
// `linhas` é a quantidade de linhas de lista; `titulo` desenha também uma faixa de totais.
export function Carregando({
  texto,
  linhas = 4,
  titulo = false,
  className,
}: {
  texto: string;
  linhas?: number;
  titulo?: boolean;
  className?: string;
}) {
  const [demora, setDemora] = useState(false);

  // Passada a espera normal, o serviço provavelmente estava dormindo (Railway serverless): a pessoa é avisada.
  useEffect(() => {
    const espera = setTimeout(() => setDemora(true), ESPERA_NORMAL);
    return () => clearTimeout(espera);
  }, []);

  return (
    <div role="status" aria-live="polite" className={cn("grid min-w-0 gap-4", className)}>
      <span className="sr-only">{texto}</span>
      {demora ? (
        <motion.p
          className="etiqueta text-ink-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={curvaCheia}
        >
          Acordando o servidor. A primeira abertura demora um pouco mais.
        </motion.p>
      ) : null}
      {titulo ? <Esqueleto className="h-12 w-full" /> : null}
      <div className="grid gap-2">
        {Array.from({ length: linhas }, (_, indice) => (
          <Esqueleto key={indice} className="h-12 w-full" />
        ))}
      </div>
    </div>
  );
}

// Ponto que pulsa dentro do botão em ação.
export function PontoDeEspera() {
  const reduzir = useReducedMotion();
  return (
    <motion.span
      aria-hidden="true"
      className="size-2 shrink-0 rounded-full bg-current"
      animate={reduzir ? { opacity: 1 } : { opacity: [0.3, 1] }}
      transition={reduzir ? { duration: 0 } : { duration: 0.6, ease: "easeInOut", repeat: Infinity, repeatType: "reverse" }}
    />
  );
}
