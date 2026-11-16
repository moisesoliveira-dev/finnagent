import { randomUUID } from "node:crypto";
import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { Redis } from "ioredis";
import { Limitador } from "../dominio/limitador.js";

const REGISTRAR = `
local agora = tonumber(ARGV[1])
local janela = tonumber(ARGV[2])
local maximo = tonumber(ARGV[3])
redis.call("ZREMRANGEBYSCORE", KEYS[1], 0, agora - janela)
local quantidade = redis.call("ZCARD", KEYS[1])
if quantidade >= maximo then
  local primeira = redis.call("ZRANGE", KEYS[1], 0, 0, "WITHSCORES")
  redis.call("PEXPIRE", KEYS[1], janela)
  return math.ceil((tonumber(primeira[2]) + janela - agora) / 1000)
end
redis.call("ZADD", KEYS[1], agora, ARGV[4])
redis.call("PEXPIRE", KEYS[1], janela)
return 0
`;

/** Limite de tentativas compartilhado entre replicas; sem Redis, protege a instancia local. */
@Injectable()
export class LimitadorDeTentativas implements OnModuleDestroy {
  private readonly redis: Redis | null;
  private readonly locais = new Map<string, Limitador>();

  constructor() {
    const url = process.env.REDIS_URL?.trim();
    this.redis = url
      ? new Redis(url, {
          connectTimeout: 1_000,
          enableOfflineQueue: false,
          maxRetriesPerRequest: 1,
          retryStrategy: () => null,
        })
      : null;
    this.redis?.on("error", () => undefined);
  }

  async registrar(escopo: string, chave: string, maximo: number, janelaMs: number) {
    if (this.redis?.status === "ready") {
      try {
        const resultado = await this.redis.eval(
          REGISTRAR,
          1,
          `finnagent:limite:${escopo}:${chave}`,
          Date.now(),
          janelaMs,
          maximo,
          randomUUID(),
        );
        return Number(resultado);
      } catch {
        // Uma falha transitoria usa a defesa local para esta requisicao.
      }
    }
    return this.local(escopo, maximo, janelaMs).registrar(chave);
  }

  onModuleDestroy() {
    this.redis?.disconnect();
  }

  private local(escopo: string, maximo: number, janelaMs: number) {
    const id = `${escopo}:${maximo}:${janelaMs}`;
    let limitador = this.locais.get(id);
    if (!limitador) {
      limitador = new Limitador(maximo, janelaMs);
      this.locais.set(id, limitador);
    }
    return limitador;
  }
}
