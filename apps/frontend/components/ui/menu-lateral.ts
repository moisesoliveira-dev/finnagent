"use client";

import { createContext, useContext, useSyncExternalStore } from "react";

/**
 * O menu lateral recolhido (só ícones) ou aberto. É conveniência de cada navegador: fica no localStorage, e sem
 * ele a tela abre aberta. No servidor e na hidratação vale "aberto", para o HTML não divergir.
 */
const CHAVE = "prumo-menu-recolhido";
const EVENTO = "prumo-menu-recolhido";

function ler() {
  try {
    return window.localStorage.getItem(CHAVE) === "1";
  } catch {
    return false;
  }
}

function assinar(aoMudar: () => void) {
  window.addEventListener(EVENTO, aoMudar);
  window.addEventListener("storage", aoMudar);
  return () => {
    window.removeEventListener(EVENTO, aoMudar);
    window.removeEventListener("storage", aoMudar);
  };
}

export function useMenuRecolhido() {
  return useSyncExternalStore(assinar, ler, () => false);
}

export function definirMenuRecolhido(recolhido: boolean) {
  try {
    window.localStorage.setItem(CHAVE, recolhido ? "1" : "0");
  } catch {
    // Sem armazenamento (janela privada, por exemplo) o menu só não lembra a escolha.
  }
  window.dispatchEvent(new Event(EVENTO));
}

/** Quem está dentro do menu lê daqui se ele está recolhido, sem cada peça ter de ler o armazenamento. */
export const MenuContext = createContext(false);

export function useMenu() {
  return useContext(MenuContext);
}
