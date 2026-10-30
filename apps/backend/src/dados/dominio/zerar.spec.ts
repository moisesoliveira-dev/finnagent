import { describe, expect, it } from "vitest";
import { TABELAS_QUE_FICAM, TABELAS_QUE_ZERAM, aplicarZeramento, type BancoQueZera } from "./zerar.js";

describe("zerar os dados", () => {
  it("não apaga configuração", () => {
    const fica = new Set<string>(TABELAS_QUE_FICAM);
    expect(TABELAS_QUE_ZERAM.filter((nome) => fica.has(nome))).toEqual([]);
    expect(fica.has("preference")).toBe(true);
    expect(fica.has("holiday")).toBe(true);
    expect(fica.has("aiProvider")).toBe(true);
    expect(fica.has("user")).toBe(true);
  });

  it("solta a cobertura antes de apagar os lançamentos e segue a ordem", async () => {
    const chamadas: string[] = [];
    const apaga = (nome: string) => ({
      deleteMany: async () => {
        chamadas.push(nome);
      },
    });
    const banco = Object.fromEntries(TABELAS_QUE_ZERAM.map((nome) => [nome, apaga(nome)])) as unknown as BancoQueZera;
    banco.entry.updateMany = async () => {
      chamadas.push("entry.coveredById");
    };
    await aplicarZeramento(banco, "00000000-0000-4000-8000-000000000001");
    expect(chamadas).toEqual([
      ...TABELAS_QUE_ZERAM.slice(0, TABELAS_QUE_ZERAM.indexOf("entry")),
      "entry.coveredById",
      ...TABELAS_QUE_ZERAM.slice(TABELAS_QUE_ZERAM.indexOf("entry")),
    ]);
  });
});
