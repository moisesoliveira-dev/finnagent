"use client";

import { motion, useAnimationControls, useReducedMotion } from "motion/react";
import { useEffect } from "react";
import { useEstadoDoAcesso } from "./estado-do-acesso";

/**
 * O fio de prumo, que dá nome ao produto. Pende do alto do painel, balança até assentar na
 * vertical e reage ao formulário: oscila enquanto confere a senha, treme se ela estiver errada
 * e fica reto quando a pessoa entra.
 */
export function FioDePrumo({ className }: { className?: string }) {
  const estado = useEstadoDoAcesso();
  const reduzir = useReducedMotion();
  const controles = useAnimationControls();

  useEffect(() => {
    if (reduzir) {
      controles.set({ rotate: 0 });
      return;
    }
    if (estado === "enviando") {
      controles.start({
        rotate: [-9, 9],
        transition: { duration: 0.85, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" },
      });
    } else if (estado === "erro") {
      controles.start({ rotate: [0, 16, -12, 8, -4, 0], transition: { duration: 0.9, ease: "easeOut" } });
    } else {
      // Mola frouxa de propósito: o peso balança algumas vezes antes de parar, como um prumo de verdade.
      controles.start({ rotate: 0, transition: { type: "spring", stiffness: 36, damping: 3.2, mass: 1.4 } });
    }
  }, [estado, reduzir, controles]);

  return (
    <motion.div
      aria-hidden
      suppressHydrationWarning
      className={className}
      style={{ originX: 0.5, originY: 0 }}
      initial={{ rotate: 26 }}
      animate={controles}
    >
      <span className="w-px flex-1 bg-ink-2" />
      <span className="size-3 shrink-0 bg-cta" />
    </motion.div>
  );
}
