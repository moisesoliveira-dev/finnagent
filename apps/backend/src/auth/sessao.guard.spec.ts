import { UnauthorizedException, type ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { describe, expect, it } from "vitest";
import type { AuthService } from "./aplicacao/auth.service.js";
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

describe("guarda de sessão", () => {
  it("deixa passar a rota pública sem token", async () => {
    const { execucao } = contexto(Aberta, {});
    expect(await guarda({}).canActivate(execucao)).toBe(true);
  });

  it("barra rota fechada sem token, com token inventado e com esquema errado", async () => {
    const dono = guarda({ valido: { userId: "u1", tenantId: "t1" } });
    const tentativas: Record<string, string>[] = [{},{ authorization: "Bearer inventado" }, { authorization: "valido" }, { authorization: "Basic valido" }];
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
