import * as Sentry from "@sentry/nextjs";

// Erros do navegador no Sentry. O DSN entra no build (`NEXT_PUBLIC_`): sem ele, nada é enviado.
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({ dsn: process.env.NEXT_PUBLIC_SENTRY_DSN });
}
