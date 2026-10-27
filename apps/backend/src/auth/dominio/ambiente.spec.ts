import { ambienteDe, estaNoRailway, loginDispensado } from "@finnagent/contracts";
import { describe, expect, it } from "vitest";

describe("ambiente", () => {
  it("vale como produção quando a variável falta ou tem qualquer outro valor", () => {
    expect(ambienteDe({})).toBe("production");
    expect(ambienteDe({ APP_ENV: "" })).toBe("production");
    expect(ambienteDe({ APP_ENV: "production" })).toBe("production");
    expect(ambienteDe({ APP_ENV: "dev" })).toBe("production");
    expect(ambienteDe({ APP_ENV: "staging" })).toBe("production");
  });

  it("aceita development com espaço e maiúscula", () => {
    expect(ambienteDe({ APP_ENV: "development" })).toBe("development");
    expect(ambienteDe({ APP_ENV: "  Development " })).toBe("development");
  });

  it("reconhece o Railway por qualquer uma das variáveis que ele injeta", () => {
    expect(estaNoRailway({})).toBe(false);
    expect(estaNoRailway({ RAILWAY_ENVIRONMENT: "production" })).toBe(true);
    expect(estaNoRailway({ RAILWAY_PROJECT_ID: "p" })).toBe(true);
    expect(estaNoRailway({ RAILWAY_SERVICE_ID: "s" })).toBe(true);
    expect(estaNoRailway({ RAILWAY_ENVIRONMENT: "" })).toBe(false);
  });

  it("só dispensa o login em desenvolvimento e fora do Railway", () => {
    expect(loginDispensado({ APP_ENV: "development" })).toBe(true);
    expect(loginDispensado({})).toBe(false);
    expect(loginDispensado({ APP_ENV: "production" })).toBe(false);
    expect(loginDispensado({ APP_ENV: "development", RAILWAY_ENVIRONMENT: "production" })).toBe(false);
    expect(loginDispensado({ APP_ENV: "development", RAILWAY_PROJECT_ID: "p" })).toBe(false);
  });
});
