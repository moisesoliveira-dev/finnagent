"use client";

import { useEffect, useSyncExternalStore } from "react";
import { cn, focusRing } from "./cn";
import { Icone } from "./icone";

const CHAVE = "prumo.valores-ocultos";

/** No lugar de todo valor em reais, enquanto os valores estão ocultos. */
export const MASCARA_DO_VALOR = "R$ ••••";

let oculto = false;
const ouvintes = new Set<() => void>();

/** Lido por `formatarReais`: com os valores ocultos, nenhum valor sai em texto. */
export function valoresOcultos() {
  return oculto;
}

export function definirValoresOcultos(valor: boolean) {
  if (valor === oculto) return;
  oculto = valor;
  try {
    localStorage.setItem(CHAVE, valor ? "1" : "0");
  } catch {
    // Sem armazenamento, vale até recarregar.
  }
  for (const ouvinte of ouvintes) ouvinte();
}

function assinar(ouvinte: () => void) {
  ouvintes.add(ouvinte);
  return () => void ouvintes.delete(ouvinte);
}

/** O servidor e a primeira pintura do navegador mostram os valores; a escolha guardada vale logo depois. */
export function useValoresOcultos() {
  useEffect(() => {
    try {
      if (localStorage.getItem(CHAVE) === "1") definirValoresOcultos(true);
    } catch {
      // Sem armazenamento, os valores ficam à vista.
    }
  }, []);
  return useSyncExternalStore(assinar, valoresOcultos, () => false);
}

/** O olho no canto da tela: esconde ou mostra todos os valores em reais. A escolha fica neste aparelho. */
export function BotaoDosValores() {
  const escondidos = useValoresOcultos();
  return (
    <button
      type="button"
      aria-label={escondidos ? "Mostrar os valores" : "Ocultar os valores"}
      aria-pressed={escondidos}
      title={escondidos ? "Mostrar os valores" : "Ocultar os valores"}
      onClick={() => definirValoresOcultos(!escondidos)}
      className={cn("inline-flex size-10 shrink-0 items-center justify-center text-ink-2 transition-colors hover:text-ink", escondidos && "text-brand", focusRing)}
    >
      <Icone name={escondidos ? "olho-cortado" : "olho"} />
    </button>
  );
}
