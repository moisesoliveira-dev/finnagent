import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../../persistencia/prisma.service.js";
import { PrismaAuthRepositorio } from "./prisma-auth-repositorio.js";

type Evento = { operation: string; tenantId: string; payload: Record<string, unknown> };

const linha = {
  id: "u1",
  tenantId: "t1",
  email: "ana@exemplo.com",
  name: "Ana",
  headline: "Analista",
  location: "Recife",
  bio: "Texto livre da Ana.",
  avatarTone: "brand",
  role: "master",
  passwordHash: "scrypt$hash-antigo",
  failedAttempts: 0,
  lockedUntil: null,
  createdAt: new Date("2026-10-01T00:00:00Z"),
};

/** Banco de mentira só com `$transaction`: escrita fora dela quebraria o teste. */
function montar(apagadas = 2) {
  const eventos: Evento[] = [];
  const tx = {
    user: {
      findUnique: vi.fn(async () => linha),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ ...linha, ...data })),
    },
    authSession: { deleteMany: vi.fn(async () => ({ count: apagadas })) },
    outbox: {
      createMany: vi.fn(async ({ data }: { data: { operation: string; tenantId: string; payload: string }[] }) => {
        for (const item of data) eventos.push({ ...item, payload: JSON.parse(item.payload) });
      }),
    },
  };
  const prisma = { ativo: true, $transaction: async (executar: (cliente: typeof tx) => unknown) => executar(tx) };
  return { repositorio: new PrismaAuthRepositorio(prisma as unknown as PrismaService), eventos, tx };
}

const mesmoPerfil = { name: "Ana", headline: "Analista", location: "Recife", bio: "Texto livre da Ana.", avatarTone: "brand" as const };

describe("perfil no repositório", () => {
  it("grava a mudança e o evento juntos, dizendo só quais campos mudaram", async () => {
    const { repositorio, eventos, tx } = montar();
    const salvo = await repositorio.atualizarPerfil("u1", { ...mesmoPerfil, headline: "Gerente", bio: "Outro texto." });
    expect(tx.user.update).toHaveBeenCalledOnce();
    expect(salvo).toMatchObject({ headline: "Gerente", bio: "Outro texto." });
    expect(eventos).toHaveLength(1);
    expect(eventos[0]).toMatchObject({ operation: "atualizar-perfil", tenantId: "t1" });
    expect(eventos[0].payload).toEqual({ userId: "u1", campos: ["headline", "bio"] });
  });

  it("não grava nem registra evento quando nada mudou", async () => {
    const { repositorio, eventos, tx } = montar();
    await repositorio.atualizarPerfil("u1", mesmoPerfil);
    expect(tx.user.update).not.toHaveBeenCalled();
    expect(eventos).toHaveLength(0);
  });

  it("troca a senha e encerra as outras sessões na mesma transação, sem o hash no evento", async () => {
    const { repositorio, eventos, tx } = montar(3);
    expect(await repositorio.trocarSenha("u1", "scrypt$hash-novo", "sessao-atual")).toBe(3);
    expect(tx.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { passwordHash: "scrypt$hash-novo", failedAttempts: 0, lockedUntil: null } }),
    );
    expect(tx.authSession.deleteMany).toHaveBeenCalledWith({ where: { userId: "u1", NOT: { id: "sessao-atual" } } });
    expect(eventos[0]).toMatchObject({ operation: "trocar-senha", payload: { userId: "u1", sessoesEncerradas: 3 } });
    expect(JSON.stringify(eventos)).not.toContain("hash-novo");
  });

  it("só registra o encerramento das outras sessões quando alguma saiu", async () => {
    const algumas = montar(2);
    expect(await algumas.repositorio.encerrarOutras("u1", "atual")).toBe(2);
    expect(algumas.eventos).toHaveLength(1);
    const nenhuma = montar(0);
    expect(await nenhuma.repositorio.encerrarOutras("u1", "atual")).toBe(0);
    expect(nenhuma.eventos).toHaveLength(0);
  });
});
