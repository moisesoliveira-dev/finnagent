"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { cn, focusRing } from "./cn";

type Tom = "sucesso" | "erro" | "alerta";

type Aviso = {
  id: number;
  tom: Tom;
  texto: string;
};

type ToastApi = {
  sucesso: (texto: string) => void;
  erro: (texto: string) => void;
  alerta: (texto: string) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

const rotulo: Record<Tom, string> = {
  sucesso: "Sucesso",
  erro: "Erro",
  alerta: "Alerta",
};

const duracao = 5000;

export function useToast() {
  const api = useContext(ToastContext);
  if (!api) throw new Error("O toast precisa estar dentro do provedor.");
  return api;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const sequencia = useRef(0);
  const caixa = useRef<HTMLDivElement>(null);
  const temporizadores = useRef(new Map<number, number>());

  const fechar = useCallback((id: number) => {
    const temporizador = temporizadores.current.get(id);
    if (temporizador) window.clearTimeout(temporizador);
    temporizadores.current.delete(id);
    setAvisos((atual) => atual.filter((aviso) => aviso.id !== id));
  }, []);

  const publicar = useCallback(
    (tom: Tom, texto: string) => {
      const mensagem = texto.trim();
      if (!mensagem) return;
      const id = ++sequencia.current;
      setAvisos((atual) => [...atual, { id, tom, texto: mensagem }].slice(-4));
      temporizadores.current.set(
        id,
        window.setTimeout(() => fechar(id), duracao),
      );
    },
    [fechar],
  );

  const api = useMemo<ToastApi>(
    () => ({
      sucesso: (texto) => publicar("sucesso", texto),
      erro: (texto) => publicar("erro", texto),
      alerta: (texto) => publicar("alerta", texto),
    }),
    [publicar],
  );

  useEffect(() => {
    const elemento = caixa.current;
    if (!elemento) return;
    if (avisos.length === 0) {
      if (elemento.matches(":popover-open")) elemento.hidePopover();
      return;
    }
    const dialogAberto = document.querySelector("dialog[open]");
    if (elemento.matches(":popover-open")) {
      if (!dialogAberto) return;
      elemento.hidePopover();
    }
    elemento.showPopover();
  }, [avisos]);

  useEffect(
    () => () => {
      for (const temporizador of temporizadores.current.values()) window.clearTimeout(temporizador);
    },
    [],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div ref={caixa} popover="manual" data-toaster="">
        {avisos.map((aviso) => (
          <article
            key={aviso.id}
            role={aviso.tom === "sucesso" ? "status" : "alert"}
            className={cn(
              "grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 rounded-md border bg-surface p-3 text-sm text-ink",
              aviso.tom === "sucesso" && "border-brand bg-brand-soft",
              aviso.tom === "erro" && "border-neg",
              aviso.tom === "alerta" && "border-pending-line bg-pending-soft",
            )}
          >
            <p className="min-w-0">
              <span
                className={cn(
                  "font-semibold",
                  aviso.tom === "sucesso" && "text-brand",
                  aviso.tom === "erro" && "text-neg",
                  aviso.tom === "alerta" && "text-pending",
                )}
              >
                {rotulo[aviso.tom]}
              </span>
              <span className="mt-1 block">{aviso.texto}</span>
            </p>
            <button
              type="button"
              aria-label="Fechar"
              className={cn(
                "inline-flex size-10 shrink-0 items-center justify-center text-ink-2",
                focusRing,
              )}
              onClick={() => fechar(aviso.id)}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                <path
                  d="M4 4l8 8M12 4l-8 8"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </article>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
