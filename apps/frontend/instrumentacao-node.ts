import { NodeSDK } from "@opentelemetry/sdk-node";
import * as Sentry from "@sentry/nextjs";

// Os spans são os que o próprio Next cria (pedido, página, rota, fetch). Endpoint, protocolo, cabeçalho e nome do
// serviço vêm das variáveis OTEL_*. Só traces: o envio de métricas a cada minuto manteria o serviço acordado no
// Railway, e o frontend dorme sem tráfego.
if (process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
  new NodeSDK({ metricReaders: [], logRecordProcessors: [] }).start();
}

// O Sentry fica só com os erros: o provider de traces é o do OpenTelemetry acima.
if (process.env.SENTRY_DSN) {
  Sentry.init({ dsn: process.env.SENTRY_DSN, enableOpenTelemetrySetup: false });
}
