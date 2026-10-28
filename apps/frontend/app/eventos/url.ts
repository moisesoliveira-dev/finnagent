"use client";

import { useSyncExternalStore } from "react";

// A tela guarda visão, filtros, página e o evento aberto na URL: recarregar ou mandar o link mantém o lugar.
const MUDOU = "prumo:url";

function assinarUrl(avisar: () => void) {
  window.addEventListener("popstate", avisar);
  window.addEventListener(MUDOU, avisar);
  return () => {
    window.removeEventListener("popstate", avisar);
    window.removeEventListener(MUDOU, avisar);
  };
}

/** A query da URL. No servidor e na hidratação é vazia; depois, a do navegador. */
export function useBuscaDaUrl() {
  return useSyncExternalStore(assinarUrl, () => window.location.search, () => "");
}

/** Muda parâmetros da URL sem recarregar a página. null ou texto vazio tira o parâmetro. */
export function mudarUrl(mudancas: Record<string, string | number | null>) {
  const url = new URL(window.location.href);
  for (const [chave, valor] of Object.entries(mudancas)) {
    if (valor === null || valor === "") url.searchParams.delete(chave);
    else url.searchParams.set(chave, String(valor));
  }
  window.history.replaceState(null, "", `${url.pathname}${url.search}`);
  window.dispatchEvent(new Event(MUDOU));
}

const DESK = "(min-width: 1100px)";

function assinarDesk(avisar: () => void) {
  const midia = window.matchMedia(DESK);
  midia.addEventListener("change", avisar);
  return () => midia.removeEventListener("change", avisar);
}

/** Se a tela tem a largura do desktop, onde o detalhe fica ao lado da lista. No servidor, não tem. */
export function useDesk() {
  return useSyncExternalStore(assinarDesk, () => window.matchMedia(DESK).matches, () => false);
}
