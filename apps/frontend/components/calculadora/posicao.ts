"use client";

import { useSyncExternalStore } from "react";

/**
 * Onde a pessoa deixou o botão da calculadora: o deslocamento a partir do canto de baixo à direita, em pixels.
 * Conveniência deste navegador: fica no localStorage. Sem nada, o botão está no canto.
 */
const CHAVE = "prumo-calculadora-posicao";
const EVENTO = "prumo-calculadora-posicao";
const NO_CANTO = { x: 0, y: 0 };

export type Posicao = { x: number; y: number };

let cache: Posicao = NO_CANTO;
let lido = false;

function ler(): Posicao {
  if (lido) return cache;
  lido = true;
  try {
    const bruto = window.localStorage.getItem(CHAVE);
    if (bruto) {
      const valor = JSON.parse(bruto) as Partial<Posicao>;
      if (typeof valor.x === "number" && typeof valor.y === "number") cache = { x: valor.x, y: valor.y };
    }
  } catch {
    cache = NO_CANTO;
  }
  return cache;
}

function assinar(aoMudar: () => void) {
  window.addEventListener(EVENTO, aoMudar);
  return () => window.removeEventListener(EVENTO, aoMudar);
}

export function usePosicaoDaCalculadora() {
  return useSyncExternalStore(assinar, ler, () => NO_CANTO);
}

export function guardarPosicaoDaCalculadora(posicao: Posicao) {
  cache = posicao;
  lido = true;
  try {
    window.localStorage.setItem(CHAVE, JSON.stringify(posicao));
  } catch {
    // Sem armazenamento, a posição vale até recarregar.
  }
  window.dispatchEvent(new Event(EVENTO));
}

/** O quanto o botão pode andar sem sair da tela: até a borda oposta, com a mesma folga do canto. */
export function limitesDaTela(tamanho: number, folga: number) {
  return {
    left: -Math.max(window.innerWidth - tamanho - folga * 2, 0),
    top: -Math.max(window.innerHeight - tamanho - folga * 2, 0),
    right: 0,
    bottom: 0,
  };
}
