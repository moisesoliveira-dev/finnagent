import { describe, expect, it } from "vitest";
import { conferirSenha, gerarHash, hashDeReferencia } from "./senha.js";

describe("senha", () => {
  it("guarda só o hash, com sal próprio a cada senha", async () => {
    const um = await gerarHash("uma senha longa");
    const outro = await gerarHash("uma senha longa");
    expect(um.startsWith("scrypt$32768$8$1$")).toBe(true);
    expect(um).not.toContain("uma senha longa");
    expect(um).not.toBe(outro);
  });

  it("confere a senha certa e recusa a errada", async () => {
    const hash = await gerarHash("uma senha longa");
    expect(await conferirSenha("uma senha longa", hash)).toBe(true);
    expect(await conferirSenha("uma senha longo", hash)).toBe(false);
    expect(await conferirSenha("", hash)).toBe(false);
  });

  it("trata a mesma senha escrita em formas Unicode diferentes como igual", async () => {
    const hash = await gerarHash("coração-forte-2026");
    expect(await conferirSenha("coração-forte-2026".normalize("NFD"), hash)).toBe(true);
  });

  it("recusa hash malformado em vez de lançar", async () => {
    expect(await conferirSenha("x", "")).toBe(false);
    expect(await conferirSenha("x", "bcrypt$1$2$3$4$5")).toBe(false);
    expect(await conferirSenha("x", "scrypt$a$8$1$c2Fs$aGFzaA==")).toBe(false);
  });

  it("mantém um hash de referência estável para o e-mail inexistente", async () => {
    expect(await hashDeReferencia()).toBe(await hashDeReferencia());
  });
});
