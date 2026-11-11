import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import type { EventoDoPasso, PedidoDePasso } from "@finnagent/contracts";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MENSAGEM_DA_QUEDA, SemConexaoComOAgents } from "../dominio/erros.js";
import { MotorHttp } from "./motor-http.js";

const pedido = { mensagens: [{ role: "user", content: "oi" }] } as unknown as PedidoDePasso;
const FINAL = { tipo: "resposta", texto: "pronto", agente: "coordenador" } as unknown as EventoDoPasso;
const linha = (evento: unknown) => `${JSON.stringify(evento)}\n`;

type Resposta = (req: IncomingMessage, res: ServerResponse, numero: number) => void;

describe("MotorHttp: a conexão com o agents cai", () => {
  let servidor: Server;
  let pedidos = 0;
  let responder: Resposta = () => undefined;
  const motor = new MotorHttp();
  const eventos: EventoDoPasso[] = [];
  const sinal = new AbortController().signal;

  beforeAll(async () => {
    servidor = createServer((req, res) => {
      pedidos += 1;
      req.resume();
      req.on("end", () => responder(req, res, pedidos));
    });
    await new Promise<void>((pronto) => servidor.listen(0, "127.0.0.1", pronto));
    process.env.AGENTS_URL = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await new Promise<void>((pronto) => servidor.close(() => pronto()));
  });

  beforeEach(() => {
    pedidos = 0;
    eventos.length = 0;
    motor.esperas = [1, 1];
  });

  const comecar = (res: ServerResponse) => res.writeHead(200, { "content-type": "application/x-ndjson" });
  const passo = () => motor.passo(pedido, (evento) => eventos.push(evento), sinal);

  it("sem queda, devolve o evento final", async () => {
    responder = (_req, res) => {
      comecar(res);
      res.end(linha({ tipo: "texto", delta: "olá" }) + linha(FINAL));
    };
    await expect(passo()).resolves.toMatchObject({ tipo: "resposta", texto: "pronto" });
    expect(eventos).toEqual([{ tipo: "texto", delta: "olá" }]);
    expect(pedidos).toBe(1);
  });

  it("cai antes de qualquer resposta e na segunda vez funciona: a pessoa nem percebe", async () => {
    responder = (_req, res, numero) => {
      comecar(res);
      if (numero === 1) return void res.destroy();
      res.end(linha(FINAL));
    };
    await expect(passo()).resolves.toMatchObject({ tipo: "resposta" });
    expect(pedidos).toBe(2);
    expect(eventos).toEqual([]);
  });

  it("cai sempre: tenta três vezes e diz com clareza o que houve, sem o 'terminated'", async () => {
    responder = (_req, res) => {
      comecar(res);
      res.destroy();
    };
    const erro = await passo().catch((falha: Error) => falha);
    expect(erro).toBeInstanceOf(Error);
    expect((erro as Error).message).toBe(MENSAGEM_DA_QUEDA);
    expect((erro as Error).message).not.toContain("terminated");
    expect(pedidos).toBe(3);
  });

  it("cai depois de o texto começar a sair: não repete, para não duplicar o que a pessoa já viu", async () => {
    responder = (_req, res) => {
      comecar(res);
      res.write(linha({ tipo: "texto", delta: "Vou consultar" }), () => setTimeout(() => res.destroy(), 20));
    };
    await expect(passo()).rejects.toThrow(MENSAGEM_DA_QUEDA);
    expect(pedidos).toBe(1);
    expect(eventos).toEqual([{ tipo: "texto", delta: "Vou consultar" }]);
  });

  it("o agents recusar o passo (400) não é queda: não repete", async () => {
    responder = (_req, res) => {
      res.writeHead(400, { "content-type": "application/json" });
      res.end(JSON.stringify({ message: "Pedido inválido para o assistente." }));
    };
    await expect(passo()).rejects.toThrow("Pedido inválido para o assistente.");
    expect(pedidos).toBe(1);
  });

  it("agents fora do ar: tenta de novo e, sem resposta, avisa que o assistente não está disponível", async () => {
    const guardada = process.env.AGENTS_URL;
    // Uma porta que acabou de ser aberta e fechada: ninguém escuta nela.
    const fechado = createServer();
    await new Promise<void>((pronto) => fechado.listen(0, "127.0.0.1", pronto));
    const porta = (fechado.address() as AddressInfo).port;
    await new Promise<void>((pronto) => fechado.close(() => pronto()));
    process.env.AGENTS_URL = `http://127.0.0.1:${porta}`;
    try {
      await expect(passo()).rejects.toBeInstanceOf(SemConexaoComOAgents);
      await expect(passo()).rejects.toThrow("O assistente não está disponível agora");
    } finally {
      process.env.AGENTS_URL = guardada;
    }
  });
});
