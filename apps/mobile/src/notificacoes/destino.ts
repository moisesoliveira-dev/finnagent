import type { DestinoDaNotificacao } from "@finnagent/contracts";

/** A rota do app para um destino. O web tem as próprias URLs; aqui a conferência é uma aba de Extratos. */
export function rotaDoApp(destino: DestinoDaNotificacao) {
  switch (destino.tela) {
    case "conferencia":
      return "/extratos?aba=conferencia";
    case "assistente":
      return destino.id ? `/assistente?c=${encodeURIComponent(destino.id)}` : "/assistente";
    default:
      return `/${destino.tela}`;
  }
}
