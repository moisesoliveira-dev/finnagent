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
  "/perfil",
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

// Quem pede menos movimento fica só com opacidade: o `MotionConfig` do app tira o deslocamento. O HTML do
// servidor não pode depender dessa preferência (ela só existe no navegador), então a variante é sempre a mesma
// e o estilo inicial, que o cliente descarta nesses casos, usa `suppressHydrationWarning`.
export function ListaAnimada({ children, ...props }: HTMLMotionProps<"ul">) {
  return (
    <motion.ul suppressHydrationWarning initial="oculto" animate="visivel" variants={lista} {...props}>
      {children}
    </motion.ul>
  );
}

export function ItemAnimado({ children, ...props }: HTMLMotionProps<"li">) {
  return (
    <motion.li suppressHydrationWarning variants={item} {...props}>
      {children}
    </motion.li>
  );
}

// Blocos que entram um depois do outro: `Cascata` cuida do ritmo e cada `Passo` dentro dela é um degrau.
// Funciona por qualquer nível de elementos entre os dois. Quem pede menos movimento fica só com opacidade:
// o `MotionConfig` do app cuida disso. O estilo inicial (deslocamento) que o servidor desenha é descartado
// no cliente dessas pessoas, então a peça usa `suppressHydrationWarning` nos próprios atributos.
const passo = {
  oculto: { opacity: 0, y: 12 },
  visivel: { opacity: 1, y: 0, transition: curvaCheia },
};

export function Cascata({
  children,
  atraso = 0,
  intervalo = 0.07,
  ...props
}: HTMLMotionProps<"div"> & { atraso?: number; intervalo?: number }) {
  return (
    <motion.div
      suppressHydrationWarning
      initial="oculto"
      animate="visivel"
      variants={{ oculto: {}, visivel: { transition: { staggerChildren: intervalo, delayChildren: atraso } } }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export function Passo({ children, ...props }: HTMLMotionProps<"div">) {
  return (
    <motion.div suppressHydrationWarning variants={passo} {...props}>
      {children}
    </motion.div>
  );
}
