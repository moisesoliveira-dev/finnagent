import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../../persistencia/prisma.service.js";
import { PrismaAuthRepositorio } from "./prisma-auth-repositorio.js";

type Evento = { operation: string; tenantId: string; idempotencyKey: string; payload: Record<string, unknown> };

type Estado = {
  falhas?: number;
  lockedUntil?: Date | null;
  sessao?: { tenantId: string; userId: string } | null;
  apagadas?: number;
  vencidas?: number;
};

/**
 * Banco de mentira que só expõe `$transaction`: qualquer escrita fora dela quebraria o teste.
 * Assim fica provado que o estado e o evento do outbox saem pela mesma transação.
 */
function montar(estado: Estado = {}) {
  const eventos: Evento[] = [];
  const tx = {
    user: {
      create: vi.fn(async ({ data }) => ({ ...data, name: data.name, failedAttempts: 0, lockedUntil: null })),
      update: vi.fn(async () => ({ tenantId: "t1", failedAttempts: estado.falhas ?? 1 })),
      findUnique: vi.fn(async () => ({
        tenantId: "t1",
        failedAttempts: estado.falhas ?? 0,
        lockedUntil: estado.lockedUntil ?? null,
      })),
    },
    authSession: {
      deleteMany: vi.fn(async () => ({ count: estado.apagadas ?? estado.vencidas ?? 0 })),
      create: vi.fn(async () => ({})),
      findUnique: vi.fn(async () => (estado.sessao === undefined ? { tenantId: "t1", userId: "u1" } : estado.sessao)),
    },
    outbox: {
      createMany: vi.fn(async ({ data }: { data: { operation: string; tenantId: string; idempotencyKey: string; payload: string }[] }) => {
        for (const linha of data) eventos.push({ ...linha, payload: JSON.parse(linha.payload) });
      }),
    },
  };
  const prisma = { ativo: true, $transaction: async (executar: (cliente: typeof tx) => unknown) => executar(tx) };
  return { repositorio: new PrismaAuthRepositorio(prisma as unknown as PrismaService), eventos, tx };
}

const agora = new Date("2026-10-27T12:00:00Z");

describe("eventos de autenticação no outbox", () => {
  it("cria o usuário e registra criar-usuario no mesmo tenant", async () => {
    const { repositorio, eventos } = montar();
    await repositorio.criarUsuario({
      id: "u1",
      email: "ana@exemplo.com",
      name: "Ana",
      passwordHash: "scrypt$x",
      tenantPreferido: "tenant-legado",
    });
    expect(eventos).toHaveLength(1);
    expect(eventos[0]).toMatchObject({ operation: "criar-usuario", tenantId: "tenant-legado", payload: { id: "u1" } });
    expect(JSON.stringify(eventos)).not.toContain("scrypt");
  });

  it("registra cada falha, e só trava quando chega no limite", async () => {
    const abaixo = montar({ falhas: 2 });
    await abaixo.repositorio.registrarFalha("u1", 5, 900_000, agora);
    expect(abaixo.eventos.map((evento) => evento.operation)).toEqual(["registrar-falha-de-acesso"]);

    const noLimite = montar({ falhas: 5 });
    await noLimite.repositorio.registrarFalha("u1", 5, 900_000, agora);
    expect(noLimite.eventos.map((evento) => evento.operation)).toEqual(["registrar-falha-de-acesso", "bloquear-conta"]);
    expect(noLimite.eventos[1].payload).toEqual({ userId: "u1", ate: "2026-10-27T12:15:00.000Z" });
  });

  it("dá chave de idempotência própria a cada evento", async () => {
    const { repositorio, eventos } = montar({ falhas: 5 });
    await repositorio.registrarFalha("u1", 5, 900_000, agora);
    await repositorio.registrarFalha("u1", 5, 900_000, agora);
    expect(new Set(eventos.map((evento) => evento.idempotencyKey)).size).toBe(eventos.length);
  });

  it("só registra a liberação quando havia falha ou trava para limpar", async () => {
    const limpo = montar({ falhas: 0, lockedUntil: null });
    await limpo.repositorio.zerarFalhas("u1");
    expect(limpo.eventos).toHaveLength(0);
    expect(limpo.tx.user.update).not.toHaveBeenCalled();

    const comFalhas = montar({ falhas: 3 });
    await comFalhas.repositorio.zerarFalhas("u1");
    expect(comFalhas.eventos.map((evento) => evento.operation)).toEqual(["zerar-falhas-de-acesso"]);

    const travado = montar({ falhas: 0, lockedUntil: agora });
    await travado.repositorio.zerarFalhas("u1");
    expect(travado.eventos).toHaveLength(1);
  });

  it("abre a sessão com o evento, sem expor o id (hash do token)", async () => {
    const { repositorio, eventos } = montar({ vencidas: 2 });
    await repositorio.criarSessao(
      { id: "hash-do-token-secreto", tenantId: "t1", userId: "u1", expiresAt: new Date("2026-11-03T12:00:00Z"), userAgent: "x" },
      agora,
    );
    expect(eventos).toHaveLength(1);
    expect(eventos[0]).toMatchObject({
      operation: "abrir-sessao",
      tenantId: "t1",
      payload: { userId: "u1", expiresAt: "2026-11-03T12:00:00.000Z", vencidasRemovidas: 2 },
    });
    expect(JSON.stringify(eventos)).not.toContain("hash-do-token-secreto");
  });

  it("encerra a sessão com o motivo, e não registra nada se ela já não existia", async () => {
    const saiu = montar({ apagadas: 1 });
    await saiu.repositorio.removerSessao("h", "sair");
    expect(saiu.eventos).toHaveLength(1);
    expect(saiu.eventos[0]).toMatchObject({ operation: "encerrar-sessao", payload: { userId: "u1", motivo: "sair" } });

    const expirou = montar({ apagadas: 1 });
    await expirou.repositorio.removerSessao("h", "expirada");
    expect(expirou.eventos[0].payload.motivo).toBe("expirada");

    const inexistente = montar({ sessao: null });
    await inexistente.repositorio.removerSessao("h", "sair");
    expect(inexistente.eventos).toHaveLength(0);

    const corrida = montar({ apagadas: 0 });
    await corrida.repositorio.removerSessao("h", "sair");
    expect(corrida.eventos).toHaveLength(0);
  });
});
