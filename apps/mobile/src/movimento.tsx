import { AnimatePresence, MotionConfig, animate, motion, useReducedMotion, type Variants } from "motion/react";
import { useEffect, useRef, type ReactNode } from "react";

// As mesmas curvas do web (components/ui/movimento.tsx): entrada, saída e a mola das trocas.
export const curvaCheia = { duration: 0.32, ease: [0.22, 1, 0.36, 1] as const };
export const curvaSaida = { duration: 0.18, ease: [0.4, 0, 1, 1] as const };
export const mola = { type: "spring" as const, stiffness: 380, damping: 30 };

/** Envolve o app: quem pede menos movimento no sistema fica só com opacidade. */
export function Movimento({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user" transition={curvaCheia}>
      {children}
    </MotionConfig>
  );
}

const lista: Variants = { oculto: {}, visivel: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } } };
const item: Variants = { oculto: { opacity: 0, y: 14 }, visivel: { opacity: 1, y: 0, transition: curvaCheia } };

/** A tela: os blocos entram um depois do outro. */
export function Cascata({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <motion.div className={className} variants={lista} initial="oculto" animate="visivel">
      {children}
    </motion.div>
  );
}

/** Um bloco da cascata: sobe e aparece. */
export function Bloco({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <motion.div className={className} variants={item}>
      {children}
    </motion.div>
  );
}

/** Troca de mês: o conteúdo antigo sai para um lado e o novo entra do outro, conforme a direção. */
export function Troca({ chave, direcao, children }: { chave: string; direcao: number; children: ReactNode }) {
  return (
    <AnimatePresence mode="wait" initial={false} custom={direcao}>
      <motion.div
        key={chave}
        custom={direcao}
        variants={{
          entra: (d: number) => ({ opacity: 0, x: d * 28 }),
          centro: { opacity: 1, x: 0, transition: curvaCheia },
          sai: (d: number) => ({ opacity: 0, x: d * -28, transition: curvaSaida }),
        }}
        initial="entra"
        animate="centro"
        exit="sai"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

/** Um número que conta até o valor, em vez de aparecer pronto. */
export function Contagem({ valor, formatar, className }: { valor: number; formatar: (valor: number) => string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduzido = useReducedMotion();
  const de = useRef(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduzido) {
      el.textContent = formatar(valor);
      de.current = valor;
      return;
    }
    const controle = animate(de.current, valor, {
      duration: 0.9,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (atual) => {
        el.textContent = formatar(Math.round(atual));
      },
      onComplete: () => {
        de.current = valor;
      },
    });
    return () => controle.stop();
  }, [valor, formatar, reduzido]);

  return <span ref={ref} className={className} />;
}

/** O preenchimento de uma barra de progresso, que cresce até a porcentagem. */
export function Preenchimento({ porcento, atraso = 0, className }: { porcento: number; atraso?: number; className?: string }) {
  return (
    <motion.span
      className={className}
      initial={{ width: 0 }}
      animate={{ width: `${porcento}%` }}
      transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.15 + atraso }}
    />
  );
}

/** Quem encosta com o dedo sente: o bloco afunda um pouco. */
export const toqueDoDedo = { scale: 0.97 };
