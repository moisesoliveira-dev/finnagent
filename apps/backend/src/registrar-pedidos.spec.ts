import { EventEmitter } from "node:events";
import type { Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

const log = vi.hoisted(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }));
vi.mock("./log.js", () => ({ log }));

import { registrarPedidos } from "./registrar-pedidos.js";

function pedido(status: number, opcoes: { terminou?: boolean; url?: string } = {}) {
  const res = Object.assign(new EventEmitter(), { statusCode: status, writableFinished: opcoes.terminou ?? true }) as unknown as Response;
  const req = { method: "POST", originalUrl: opcoes.url ?? "/assistente/mensagens?token=segredo" } as Request;
  const proximo = vi.fn();
  registrarPedidos(req, res, proximo);
  expect(proximo).toHaveBeenCalledOnce();
  res.emit("close");
  return res;
}

describe("registro dos pedidos", () => {
  beforeEach(() => vi.clearAllMocks());

  it("pedido que deu certo sai como info, com método, rota, status e tempo, sem a query", () => {
    pedido(200);
    expect(log.info).toHaveBeenCalledWith(
      expect.objectContaining({ metodo: "POST", rota: "/assistente/mensagens", status: 200, ms: expect.any(Number) }),
      "pedido",
    );
    expect(JSON.stringify(log.info.mock.calls)).not.toContain("segredo");
  });

  it("4xx sai como aviso e 5xx como erro", () => {
    pedido(404);
    pedido(500);
    expect(log.warn).toHaveBeenCalledWith(expect.objectContaining({ status: 404 }), "pedido recusado");
    expect(log.error).toHaveBeenCalledWith(expect.objectContaining({ status: 500 }), "pedido falhou");
  });

  it("conexão que cai antes do fim é registrada como abandonada", () => {
    pedido(200, { terminou: false });
    expect(log.warn).toHaveBeenCalledWith(expect.objectContaining({ abandonado: true }), "pedido abandonado antes do fim");
    expect(log.info).not.toHaveBeenCalled();
  });
});
