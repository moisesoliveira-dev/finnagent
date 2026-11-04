import * as Sentry from "@sentry/nextjs";

// Erros do servidor no Sentry e traces no Grafana. Só no runtime do Node: o SDK do OpenTelemetry não roda no edge.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") await import("./instrumentacao-node");
}

// O erro de uma página ou rota do servidor chega ao Sentry com a rota e o método.
export const onRequestError = Sentry.captureRequestError;
