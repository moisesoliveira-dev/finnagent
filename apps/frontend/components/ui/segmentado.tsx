"use client";

import { motion } from "motion/react";
import { useId, type ComponentProps, type ReactNode } from "react";
import { cn, focusRing } from "./cn";
import { useCurva } from "./movimento";

// Opções lado a lado. A escolhida ganha o fundo azul, que desliza entre elas.
// `direcao` diz para que lado a escolha andou, para a Troca deslizar junto.
export function Segmentado<T extends string>({
  opcoes,
  valor,
  onEscolher,
  radio = false,
  className,
  ...props
}: Omit<ComponentProps<"div">, "children" | "role"> & {
  opcoes: readonly { id: T; label: ReactNode }[];
  valor: T;
  onEscolher: (id: T, direcao: number) => void;
  radio?: boolean;
}) {
  const marca = useId();
  const curva = useCurva();
  const atual = opcoes.findIndex((opcao) => opcao.id === valor);

  return (
    <div
      role={radio ? "radiogroup" : "group"}
      className={cn("inline-flex w-fit flex-wrap border border-line bg-surface", className)}
      {...props}
    >
      {opcoes.map((opcao, indice) => {
        const ativo = opcao.id === valor;
        return (
          <button
            key={opcao.id}
            type="button"
            role={radio ? "radio" : undefined}
            aria-checked={radio ? ativo : undefined}
            aria-pressed={radio ? undefined : ativo}
            className={cn(
              "etiqueta-botao relative min-h-10 px-4 transition-colors",
              focusRing,
              ativo ? "text-brand" : "text-ink-2 hover:text-ink",
            )}
            onClick={() => onEscolher(opcao.id, Math.sign(indice - atual))}
          >
            {ativo ? (
              <motion.span layoutId={marca} className="absolute inset-0 bg-brand-soft" transition={curva} />
            ) : null}
            <span className="relative">{opcao.label}</span>
          </button>
        );
      })}
    </div>
  );
}
