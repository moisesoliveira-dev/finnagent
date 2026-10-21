"use client";

import { animate, useReducedMotion, type AnimationPlaybackControls } from "motion/react";
import { useCallback, useEffect, useRef, useState, type ComponentProps, type ReactNode } from "react";
import { cn } from "./cn";
import { curvaCheia, curvaSaida } from "./movimento";

const base = "rounded-lg border border-line bg-surface text-ink backdrop:bg-overlay/70";

// O <dialog> nativo some na hora. Aqui showModal e close passam pela animação,
// então quem chama dialog.current.close() não muda. Com `aberto`, o modal segue
// o estado e guarda o último conteúdo enquanto sai.
export function Dialogo({
  ref,
  aberto,
  largura,
  className,
  children,
  onClose,
  ...props
}: Omit<ComponentProps<"dialog">, "open"> & { aberto?: boolean; largura?: "media" | "larga" }) {
  const proprio = useRef<HTMLDialogElement | null>(null);
  const reduzir = useReducedMotion();
  const [visto, setVisto] = useState<{ children: ReactNode; largura?: string }>({ children, largura });
  if (aberto !== false && (visto.children !== children || visto.largura !== largura)) {
    setVisto({ children, largura });
  }
  const mostrado = aberto === false ? visto : { children, largura };

  const juntar = useCallback(
    (el: HTMLDialogElement | null) => {
      proprio.current = el;
      if (typeof ref === "function") ref(el);
      else if (ref) ref.current = el;
    },
    [ref],
  );

  useEffect(() => {
    const el = proprio.current;
    if (!el) return;
    const abrir = HTMLDialogElement.prototype.showModal;
    const fechar = HTMLDialogElement.prototype.close;
    let saida: AnimationPlaybackControls | null = null;

    el.showModal = () => {
      const novo = !el.open;
      if (saida) {
        saida.stop();
        saida = null;
        delete el.dataset.saindo;
      }
      if (novo) abrir.call(el);
      if (reduzir) return;
      animate(
        el,
        novo ? { opacity: [0, 1], y: [12, 0], scale: [0.98, 1] } : { opacity: 1, y: 0, scale: 1 },
        curvaCheia,
      );
    };

    el.close = (valor?: string) => {
      if (!el.open || saida) return;
      if (reduzir) return fechar.call(el, valor);
      el.dataset.saindo = "";
      const atual = animate(el, { opacity: 0, y: 8, scale: 0.98 }, curvaSaida);
      saida = atual;
      void atual.then(() => {
        if (saida !== atual) return;
        saida = null;
        delete el.dataset.saindo;
        fechar.call(el, valor);
        el.style.removeProperty("opacity");
        el.style.removeProperty("transform");
      });
    };

    const escape = (event: Event) => {
      if (event.defaultPrevented) return;
      event.preventDefault();
      el.close();
    };
    el.addEventListener("cancel", escape);

    return () => {
      saida?.stop();
      el.removeEventListener("cancel", escape);
      Reflect.deleteProperty(el, "showModal");
      Reflect.deleteProperty(el, "close");
    };
  }, [reduzir]);

  useEffect(() => {
    const el = proprio.current;
    if (!el || aberto === undefined) return;
    if (aberto && (!el.open || "saindo" in el.dataset)) el.showModal();
    if (!aberto && el.open) el.close();
  }, [aberto]);

  return (
    <dialog
      ref={juntar}
      className={cn(base, className)}
      data-largura={mostrado.largura}
      onClose={(event) => {
        setVisto({ children: null });
        onClose?.(event);
      }}
      {...props}
    >
      {mostrado.children}
    </dialog>
  );
}
