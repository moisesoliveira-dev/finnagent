"use client";

import { AnimatePresence, MotionConfig, motion, useReducedMotion, type HTMLMotionProps } from "motion/react";
import type { ReactNode } from "react";
import { cn } from "./cn";

export const curvaCheia = { duration: 0.32, ease: [0.22, 1, 0.36, 1] as const };
export const curvaSaida = { duration: 0.18, ease: [0.4, 0, 1, 1] as const };
export const mola = { type: "spring", stiffness: 500, damping: 32 } as const;

// Quem pede menos movimento fica só com a troca de opacidade.
export function Movimento({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}

export function useCurva() {
  const reduzir = useReducedMotion();
  return reduzir ? { duration: 0 } : curvaCheia;
}

const ABAS = [
  "/",
  "/agenda",
  "/financas",
  "/grupos",
  "/metas",
  "/relatorios",
  "/eventos",
  "/extratos",
  "/extratos/conferencia",
  "/configuracoes",
];

export function indiceDaAba(pathname: string) {
  let escolhido = 0;
  let tamanho = -1;
  ABAS.forEach((rota, indice) => {
    const casa = rota === "/" ? pathname === "/" : pathname === rota || pathname.startsWith(`${rota}/`);
    if (casa && rota.length > tamanho) {
      escolhido = indice;
      tamanho = rota.length;
    }
  });
  return escolhido;
}

export function Aparecer({
  children,
  className,
  direcao = 0,
}: {
  children: ReactNode;
  className?: string;
  direcao?: number;
}) {
  const curva = useCurva();
  const entrada = direcao === 0 ? { x: 0, y: 8 } : { x: direcao * 28, y: 0 };
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, ...entrada }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      transition={curva}
    >
      {children}
    </motion.div>
  );
}

export function Troca({
  id,
  direcao,
  children,
  className,
}: {
  id: string;
  direcao: number;
  children: ReactNode;
  className?: string;
}) {
  const curva = useCurva();
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={id}
        className={className}
        initial={{ opacity: 0, x: direcao * 16 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: direcao * -16 }}
        transition={curva}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

// Seta do acordeão: aponta para baixo aberta e para a direita fechada.
export function Seta({ aberto }: { aberto: boolean }) {
  const curva = useCurva();
  return (
    <motion.span
      aria-hidden="true"
      className="size-2 shrink-0 border-r-2 border-b-2 border-ink-2"
      initial={false}
      animate={{ rotate: aberto ? 45 : -45 }}
      transition={curva}
    />
  );
}

// Fica no DOM fechado, para o aria-controls continuar apontando para ele.
export function Expandir({
  aberto,
  id,
  className,
  children,
}: {
  aberto: boolean;
  id?: string;
  className?: string;
  children: ReactNode;
}) {
  const curva = useCurva();
  return (
    <motion.div
      id={id}
      className={cn("overflow-hidden", className)}
      inert={!aberto}
      initial={false}
      animate={aberto ? { height: "auto", opacity: 1 } : { height: 0, opacity: 0 }}
      transition={curva}
    >
      {children}
    </motion.div>
  );
}

const lista = {
  oculto: {},
  visivel: { transition: { staggerChildren: 0.045 } },
};

const item = {
  oculto: { opacity: 0, y: 8 },
  visivel: { opacity: 1, y: 0, transition: curvaCheia },
};

export function ListaAnimada({ children, ...props }: HTMLMotionProps<"ul">) {
  const reduzir = useReducedMotion();
  return (
    <motion.ul
      initial={reduzir ? false : "oculto"}
      animate="visivel"
      variants={reduzir ? undefined : lista}
      {...props}
    >
      {children}
    </motion.ul>
  );
}

export function ItemAnimado({ children, ...props }: HTMLMotionProps<"li">) {
  const reduzir = useReducedMotion();
  return (
    <motion.li variants={reduzir ? undefined : item} {...props}>
      {children}
    </motion.li>
  );
}
