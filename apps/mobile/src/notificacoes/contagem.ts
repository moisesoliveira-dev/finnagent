import { useSyncExternalStore } from "react";
import { ler } from "../api/cliente";

/** Quantas notificações faltam ler. Um valor só para o app inteiro: o sino de cada tela lê daqui. */
let naoLidas = 0;
const ouvintes = new Set<() => void>();

function publicar(total: number) {
  if (total === naoLidas) return;
  naoLidas = total;
  for (const ouvinte of ouvintes) ouvinte();
}

export function definirNaoLidas(total: number) {
  publicar(Math.max(total, 0));
}

export async function recontar() {
  try {
    const { naoLidas: total } = await ler<{ naoLidas: number }>("/api/notificacoes/contagem");
    publicar(total);
  } catch {
    // Sem rede: o sino fica com o último número até a próxima contagem.
  }
}

export function useNaoLidas() {
  return useSyncExternalStore(
    (ouvinte) => {
      ouvintes.add(ouvinte);
      return () => void ouvintes.delete(ouvinte);
    },
    () => naoLidas,
  );
}
