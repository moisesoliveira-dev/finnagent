import { useSyncExternalStore } from "react";

const CHAVE = "prumo.valores-ocultos";

/** No lugar de todo valor em reais, enquanto os valores estão ocultos. */
export const MASCARA_DO_VALOR = "R$ ••••";

function guardado() {
  try {
    return localStorage.getItem(CHAVE) === "1";
  } catch {
    return false;
  }
}

let oculto = guardado();
const ouvintes = new Set<() => void>();

/** Lido por `reais`: com os valores ocultos, nenhum valor sai em texto. */
export const valoresOcultos = () => oculto;

export function definirValoresOcultos(valor: boolean) {
  if (valor === oculto) return;
  oculto = valor;
  try {
    localStorage.setItem(CHAVE, valor ? "1" : "0");
  } catch {
    // Sem armazenamento, vale até fechar o app.
  }
  for (const ouvinte of ouvintes) ouvinte();
}

function assinar(ouvinte: () => void) {
  ouvintes.add(ouvinte);
  return () => void ouvintes.delete(ouvinte);
}

export const useValoresOcultos = () => useSyncExternalStore(assinar, valoresOcultos);
