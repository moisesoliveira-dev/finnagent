import { defineConfig, devices } from "@playwright/test";

/**
 * Os E2E rodam contra o ambiente local já no ar (`docker compose up`, em http://localhost:3000, modo sem login).
 * Não há `webServer`: o Playwright não sobe nada. Os testes compartilham o banco local, então rodam em série.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: "list",
  outputDir: "./test-results",
  use: {
    baseURL: "http://localhost:3000",
    locale: "pt-BR",
    viewport: { width: 1280, height: 900 },
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } },
    },
  ],
});
