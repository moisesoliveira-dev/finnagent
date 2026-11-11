"use client";

import { Reorder, useDragControls } from "motion/react";
import type { ReactNode } from "react";
import { cn, focusRing } from "./cn";

type Tag = "div" | "ul" | "li" | "section";

/**
 * Uma lista que se reorganiza arrastando, com o dedo ou com o mouse. Quem arrasta é a alça de `ItemOrdenavel`, e
 * não o item inteiro: o resto do item continua rolando a página no celular.
 */
export function ListaOrdenavel<T>({
  itens,
  aoMudar,
  desligada = false,
  as = "div",
  className,
  children,
}: {
  itens: T[];
  aoMudar: (itens: T[]) => void;
  /** Desligada (na busca, por exemplo), a lista é comum e os itens não mostram a alça. */
  desligada?: boolean;
  as?: Tag;
  className?: string;
  children: ReactNode;
}) {
  if (desligada) {
    const Elemento = as;
    return <Elemento className={className}>{children}</Elemento>;
  }
  return (
    <Reorder.Group as={as} axis="y" values={itens} onReorder={aoMudar} className={className}>
      {children}
    </Reorder.Group>
  );
}

/**
 * O item da lista ordenável. `children` recebe a alça (ou null com a lista desligada) para a tela escolher onde
 * ela fica. `aoSoltar` roda quando o arraste termina, e `aoMover` com as setas do teclado na alça.
 */
export function ItemOrdenavel<T>({
  valor,
  nome,
  desligado = false,
  as = "div",
  className,
  aoSoltar,
  aoMover,
  rotuloId,
  children,
}: {
  valor: T;
  nome: string;
  desligado?: boolean;
  as?: Tag;
  className?: string;
  aoSoltar: () => void;
  aoMover: (passo: -1 | 1) => void;
  /** O id do título do item, para quem lê a tela. */
  rotuloId?: string;
  children: (alca: ReactNode) => ReactNode;
}) {
  const controles = useDragControls();

  if (desligado) {
    const Elemento = as;
    return (
      <Elemento className={className} aria-labelledby={rotuloId}>
        {children(null)}
      </Elemento>
    );
  }

  const alca = (
    <button
      type="button"
      aria-label={`Reordenar ${nome}. Arraste, ou use as setas para cima e para baixo.`}
      title="Arraste para reordenar"
      className={cn(
        "etiqueta flex size-10 shrink-0 cursor-grab touch-none items-center justify-center select-none text-ink-2 hover:text-brand active:cursor-grabbing",
        focusRing,
      )}
      onPointerDown={(evento) => controles.start(evento)}
      onKeyDown={(evento) => {
        if (evento.key !== "ArrowUp" && evento.key !== "ArrowDown") return;
        evento.preventDefault();
        aoMover(evento.key === "ArrowUp" ? -1 : 1);
      }}
    >
      <span aria-hidden="true" className="text-lg leading-none">⠿</span>
    </button>
  );

  return (
    <Reorder.Item
      as={as}
      value={valor}
      dragListener={false}
      dragControls={controles}
      whileDrag={{ scale: 1.01 }}
      onDragEnd={aoSoltar}
      className={className}
      aria-labelledby={rotuloId}
    >
      {children(alca)}
    </Reorder.Item>
  );
}
