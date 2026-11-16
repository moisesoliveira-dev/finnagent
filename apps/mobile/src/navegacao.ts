/** Dados externos nunca podem transformar uma rota interna em navegacao para outra origem. */
export function rotaInterna(rota: string) {
  return rota.startsWith("/") && !rota.startsWith("//") && !rota.includes("\\") ? rota : "/notificacoes";
}
