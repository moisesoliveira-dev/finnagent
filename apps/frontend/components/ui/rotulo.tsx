"use client";

import { useEffect, useId, useRef } from "react";
import { focusRing } from "./cn";

export function Rotulo({
  htmlFor,
  dica,
  children,
}: {
  htmlFor: string;
  dica: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-1">
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {children}
      </label>
      <Dica texto={dica} />
    </div>
  );
}

export function Dica({ texto }: { texto: string }) {
  const id = useId();
  const ancora = useRef<HTMLButtonElement>(null);
  const painel = useRef<HTMLDivElement>(null);
  const espera = useRef<number | null>(null);
  const toque = useRef(false);

  useEffect(() => {
    const botao = ancora.current;
    const dialog = botao?.closest("dialog");
    const fechar = () => painel.current?.hidePopover();
    window.addEventListener("scroll", fechar, true);
    dialog?.addEventListener("close", fechar);
    return () => {
      window.removeEventListener("scroll", fechar, true);
      dialog?.removeEventListener("close", fechar);
      if (espera.current) window.clearTimeout(espera.current);
      painel.current?.hidePopover();
    };
  }, []);

  function posicionar() {
    const botao = ancora.current;
    const el = painel.current;
    if (!botao || !el) return;
    if (espera.current) window.clearTimeout(espera.current);
    const box = botao.getBoundingClientRect();
    el.style.left = `${box.left}px`;
    el.style.top = `${box.bottom + 4}px`;
    if (!el.matches(":popover-open")) el.showPopover();
    const margem = 8;
    let left = box.left;
    let top = box.bottom + 4;
    if (left + el.offsetWidth > window.innerWidth - margem) {
      left = window.innerWidth - margem - el.offsetWidth;
    }
    if (left < margem) left = margem;
    if (top + el.offsetHeight > window.innerHeight - margem) top = box.top - el.offsetHeight - 4;
    el.style.left = `${Math.round(left)}px`;
    el.style.top = `${Math.round(top)}px`;
  }

  function fechar() {
    espera.current = window.setTimeout(() => painel.current?.hidePopover(), 120);
  }

  return (
    <>
      <button
        type="button"
        ref={ancora}
        className={`inline-flex size-4 shrink-0 items-center justify-center border-0 bg-transparent p-0 ${focusRing}`}
        aria-label="O que é este campo"
        aria-describedby={id}
        onPointerDown={(event) => {
          toque.current = event.pointerType !== "mouse";
        }}
        onMouseEnter={() => {
          if (!toque.current) posicionar();
        }}
        onMouseLeave={fechar}
        onFocus={posicionar}
        onBlur={fechar}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          if (!toque.current) return;
          const el = painel.current;
          if (!el) return;
          if (el.matches(":popover-open")) el.hidePopover();
          else posicionar();
        }}
      >
        <svg viewBox="0 0 16 16" className="size-4 text-pending" aria-hidden="true">
          <circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" strokeWidth="1.25" />
          <path d="M8 4.25v5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="8" cy="11.35" r="0.8" fill="currentColor" />
        </svg>
      </button>
      <div
        ref={painel}
        id={id}
        popover="manual"
        data-dica=""
        role="tooltip"
        onMouseEnter={posicionar}
        onMouseLeave={fechar}
      >
        {texto}
      </div>
    </>
  );
}
