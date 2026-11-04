// Erros no Sentry; traces e métricas no Grafana, pelo OpenTelemetry. É o primeiro import do main: a instrumentação
// do HTTP precisa entrar antes de o Nest abrir o servidor. Sem as variáveis (como no local), nada liga.
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import { NodeSDK } from "@opentelemetry/sdk-node";
import * as Sentry from "@sentry/nestjs";

if (process.env.SENTRY_DSN) {
  // O Sentry fica só com os erros: o provider de traces é o do OpenTelemetry abaixo.
  Sentry.init({ dsn: process.env.SENTRY_DSN, enableOpenTelemetrySetup: false });
}

if (process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
  // Endpoint, protocolo, cabeçalho e nome do serviço vêm das variáveis OTEL_*. O backend fica acordado pela fila,
  // então também manda as métricas (as do HTTP, a cada minuto).
  new NodeSDK({ instrumentations: [new HttpInstrumentation()], logRecordProcessors: [] }).start();
}
