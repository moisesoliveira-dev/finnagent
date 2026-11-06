"use client";

import { useSyncExternalStore } from "react";

/** Abaixo do tablet (760 px): o celular. No servidor vale "não", para o HTML não divergir. */
const CELULAR = "(max-width: 759px)";

function assinar(aoMudar: () => void) {
  const midia = window.matchMedia(CELULAR);
  midia.addEventListener("change", aoMudar);
  return () => midia.removeEventListener("change", aoMudar);
}

export function useCelular() {
  return useSyncExternalStore(assinar, () => window.matchMedia(CELULAR).matches, () => false);
}
