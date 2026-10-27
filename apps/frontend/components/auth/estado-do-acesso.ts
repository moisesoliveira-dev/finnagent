import { useSyncExternalStore } from "react";

/** O que o formulário está fazendo. O fio de prumo do painel reage a isso. */
export type EstadoDoAcesso = "ocioso" | "enviando" | "erro" | "ok";

let atual: EstadoDoAcesso = "ocioso";
const ouvintes = new Set<() => void>();

export function definirEstadoDoAcesso(novo: EstadoDoAcesso) {
  if (novo === atual) return;
  atual = novo;
  for (const ouvinte of ouvintes) ouvinte();
}

function assinar(ouvinte: () => void) {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

export function useEstadoDoAcesso(): EstadoDoAcesso {
  return useSyncExternalStore(assinar, () => atual, () => "ocioso");
}
