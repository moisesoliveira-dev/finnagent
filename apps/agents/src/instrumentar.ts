// Erros no Sentry e traces no Grafana, pelo OpenTelemetry. É o primeiro import do main, antes de o servidor abrir.
// Sem as variáveis (como no local), nada liga. As chamadas de IA ficam no Langfuse.
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import { NodeSDK } from "@opentelemetry/sdk-node";
import * as Sentry from "@sentry/node";

// O Sentry fica só com os erros: o provider de traces é o do OpenTelemetry abaixo.
if (process.env.SENTRY_DSN) Sentry.init({ dsn: process.env.SENTRY_DSN, enableOpenTelemetrySetup: false });

if (process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
  // Endpoint, protocolo, cabeçalho e nome do serviço vêm das variáveis OTEL_*. Só traces: o envio de métricas a cada
  // minuto manteria o agents acordado no Railway, e ele dorme sem tráfego.
  new NodeSDK({ instrumentations: [new HttpInstrumentation()], metricReaders: [], logRecordProcessors: [] }).start();
}
