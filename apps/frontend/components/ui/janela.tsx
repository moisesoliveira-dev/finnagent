"use client";

import { useEffect, useRef } from "react";
import { Button } from "./button";

/**
 * O fim de uma lista que se mostra aos poucos: perto do fim, a lista mostra mais; o botão serve a quem não rola
 * (teclado, leitor de tela). A lista inteira continua existindo para os totais e para as ações em lote: só o que é
 * desenhado na tela é que vai por janelas.
 */
export function FimDaJanela({
  mostradas,
  total,
  porVez,
  aoMostrarMais,
  aoMostrarTodas,
  nome = "linhas",
}: {
  mostradas: number;
  total: number;
  porVez: number;
  aoMostrarMais: () => void;
  aoMostrarTodas: () => void;
  nome?: string;
}) {
  const marca = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const elemento = marca.current;
    if (!elemento || mostradas >= total) return;
    const observador = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((entrada) => entrada.isIntersecting)) aoMostrarMais();
      },
      { rootMargin: "600px 0px" },
    );
    observador.observe(elemento);
    return () => observador.disconnect();
  }, [mostradas, total, aoMostrarMais]);

  if (total <= 0) return null;
  const faltam = Math.max(total - mostradas, 0);
  return (
    <div ref={marca} className="flex min-w-0 flex-wrap items-center justify-between gap-3 border border-line bg-surface p-4">
      <p className="text-sm text-ink-2" aria-live="polite">
        Mostrando {Math.min(mostradas, total)} de {total} {nome}
      </p>
      {faltam > 0 ? (
        <div className="flex flex-wrap gap-2">
          <Button onClick={aoMostrarMais}>Mostrar mais {Math.min(porVez, faltam)}</Button>
          <Button variant="quiet" onClick={aoMostrarTodas}>
            Mostrar todas
          </Button>
        </div>
      ) : null}
    </div>
  );
}
