"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Button } from "../../components/ui/button";
import { cn, focusRing } from "../../components/ui/cn";
import { Icone } from "../../components/ui/icone";
import { curvaSaida, useCurva } from "../../components/ui/movimento";

export type OpcaoDaLinha = { rotulo: string; onClick: () => void; perigo?: boolean };

/** O menu de três pontos de uma linha: abre com as opções, fecha ao escolher, ao clicar fora ou no Escape. */
export function MenuDaLinha({ rotulo, opcoes, disabled = false }: { rotulo: string; opcoes: OpcaoDaLinha[]; disabled?: boolean }) {
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLSpanElement>(null);
  const curva = useCurva();

  useEffect(() => {
    if (!aberto) return;
    const fora = (evento: PointerEvent) => {
      if (!caixa.current?.contains(evento.target as Node)) setAberto(false);
    };
    const tecla = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") setAberto(false);
    };
    document.addEventListener("pointerdown", fora);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("pointerdown", fora);
      document.removeEventListener("keydown", tecla);
    };
  }, [aberto]);

  return (
    <span ref={caixa} className="relative inline-flex">
      <Button
        type="button"
        variant="quiet"
        className="size-10 px-0"
        aria-label={`Opções: ${rotulo}`}
        aria-haspopup="menu"
        aria-expanded={aberto}
        disabled={disabled}
        onClick={() => setAberto((atual) => !atual)}
      >
        <Icone name="mais" />
      </Button>
      <AnimatePresence>
        {aberto ? (
          <motion.span
            role="menu"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4, transition: curvaSaida }}
            transition={curva}
            className="absolute top-full right-0 z-30 mt-1 grid w-48 gap-1 border border-line bg-surface p-1"
          >
            {opcoes.map((opcao) => (
              <button
                key={opcao.rotulo}
                type="button"
                role="menuitem"
                className={cn(
                  "flex min-h-10 items-center px-3 text-left text-sm transition-colors hover:text-ink",
                  opcao.perigo ? "text-neg" : "text-ink-2",
                  focusRing,
                )}
                onClick={() => {
                  setAberto(false);
                  opcao.onClick();
                }}
              >
                {opcao.rotulo}
              </button>
            ))}
          </motion.span>
        ) : null}
      </AnimatePresence>
    </span>
  );
}
