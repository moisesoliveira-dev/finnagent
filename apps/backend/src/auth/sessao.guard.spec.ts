import { UnauthorizedException, type ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TENANT_LEGADO, USUARIO_SEM_LOGIN, type AuthService } from "./aplicacao/auth.service.js";
import { Publico } from "./publico.js";
import { SessaoGuard, type PedidoAutenticado } from "./sessao.guard.js";

class Fechada {
  rota() {}
}

class Aberta {
  @Publico()
  rota() {}
}

function contexto(alvo: new () => { rota(): void }, headers: Record<string, string>) {
  const pedido = { headers } as unknown as PedidoAutenticado;
  const execucao = {
    getHandler: () => alvo.prototype.rota,
    getClass: () => alvo,
    switchToHttp: () => ({ getRequest: () => pedido }),
  } as unknown as ExecutionContext;
  return { pedido, execucao };
}

function guarda(tokens: Record<string, { userId: string; tenantId: string }>) {
  const auth = { resolver: async (token: string) => tokens[token] ?? null } as unknown as AuthService;
  return new SessaoGuard(new Reflector(), auth);
}

const RAILWAY = ["RAILWAY_ENVIRONMENT", "RAILWAY_PROJECT_ID", "RAILWAY_SERVICE_ID"];

// Os testes não podem depender do ambiente de quem os roda.
beforeEach(() => {
  vi.stubEnv("APP_ENV", "");
  for (const nome of RAILWAY) vi.stubEnv(nome, "");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("guarda de sessão", () => {
  it("deixa passar a rota pública sem token", async () => {
    const { execucao } = contexto(Aberta, {});
    expect(await guarda({}).canActivate(execucao)).toBe(true);
  });

  it("barra rota fechada sem token, com token inventado e com esquema errado", async () => {
    const dono = guarda({ valido: { userId: "u1", tenantId: "t1" } });
    const tentativas: Record<string, string>[] = [
      {},
      { authorization: "Bearer inventado" },
      { authorization: "valido" },
      { authorization: "Basic valido" },
    ];
    for (const headers of tentativas) {
      await expect(dono.canActivate(contexto(Fechada, headers).execucao)).rejects.toBeInstanceOf(UnauthorizedException);
    }
  });

  it("troca o x-tenant-id que o cliente mandou pelo tenant da sessão", async () => {
    const { pedido, execucao } = contexto(Fechada, { authorization: "Bearer valido", "x-tenant-id": "tenant-de-outro" });
    expect(await guarda({ valido: { userId: "u1", tenantId: "t1" } }).canActivate(execucao)).toBe(true);
    expect(pedido.headers["x-tenant-id"]).toBe("t1");
    expect(pedido.usuarioId).toBe("u1");
  });
});

describe("guarda de sessão em desenvolvimento", () => {
  it("dispensa o login e usa o tenant dos dados antigos, ignorando o x-tenant-id do cliente", async () => {
    vi.stubEnv("APP_ENV", "development");
    const { pedido, execucao } = contexto(Fechada, { "x-tenant-id": "tenant-de-outro" });
    expect(await guarda({}).canActivate(execucao)).toBe(true);
    expect(pedido.headers["x-tenant-id"]).toBe(TENANT_LEGADO);
    expect(pedido.usuarioId).toBe(USUARIO_SEM_LOGIN);
  });

  it("trata token inventado como falta de sessão", async () => {
    vi.stubEnv("APP_ENV", "development");
    const { pedido, execucao } = contexto(Fechada, { authorization: "Bearer inventado" });
    expect(await guarda({}).canActivate(execucao)).toBe(true);
    expect(pedido.usuarioId).toBe(USUARIO_SEM_LOGIN);
  });

  it("deixa a sessão válida ganhar: dá para testar o login de verdade", async () => {
    vi.stubEnv("APP_ENV", "development");
    const { pedido, execucao } = contexto(Fechada, { authorization: "Bearer valido" });
    expect(await guarda({ valido: { userId: "u1", tenantId: "t1" } }).canActivate(execucao)).toBe(true);
    expect(pedido.headers["x-tenant-id"]).toBe("t1");
    expect(pedido.usuarioId).toBe("u1");
  });

  it("não dispensa nada com a variável vazia, em production ou com outro valor", async () => {
    for (const valor of ["", "production", "prod", "dev", "true", "1"]) {
      vi.stubEnv("APP_ENV", valor);
      await expect(guarda({}).canActivate(contexto(Fechada, {}).execucao)).rejects.toBeInstanceOf(UnauthorizedException);
    }
  });

  it("não dispensa o login no Railway, mesmo com APP_ENV=development", async () => {
    vi.stubEnv("APP_ENV", "development");
    for (const nome of RAILWAY) {
      vi.stubEnv(nome, "algum-valor");
      await expect(guarda({}).canActivate(contexto(Fechada, {}).execucao)).rejects.toBeInstanceOf(UnauthorizedException);
      vi.stubEnv(nome, "");
    }
  });
});
