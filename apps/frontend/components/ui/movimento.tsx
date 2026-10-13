"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

const curvaCheia = { duration: 0.32, ease: [0.22, 1, 0.36, 1] as const };

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

export function Presenca({
  aberto,
  onSaiu,
  children,
  className,
}: {
  aberto: boolean;
  onSaiu?: () => void;
  children: ReactNode;
  className?: string;
}) {
  const curva = useCurva();
  return (
    <AnimatePresence onExitComplete={onSaiu}>
      {aberto ? (
        <motion.div
          className={className}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={curva}
        >
          {children}
        </motion.div>
      ) : null}
    </AnimatePresence>
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

export function ListaAnimada({ children, className }: { children: ReactNode; className?: string }) {
  const reduzir = useReducedMotion();
  return (
    <motion.ul
      className={className}
      initial={reduzir ? false : "oculto"}
      animate="visivel"
      variants={reduzir ? undefined : lista}
    >
      {children}
    </motion.ul>
  );
}

export function ItemAnimado({ children, className }: { children: ReactNode; className?: string }) {
  const reduzir = useReducedMotion();
  return (
    <motion.li className={className} variants={reduzir ? undefined : item}>
      {children}
    </motion.li>
  );
}
