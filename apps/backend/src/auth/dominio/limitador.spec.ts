import { describe, expect, it } from "vitest";
import { Limitador } from "./limitador.js";

describe("limitador", () => {
  it("libera até o máximo e depois diz quantos segundos faltam", () => {
    let agora = 1_000_000;
    const limitador = new Limitador(3, 60_000, () => agora);
    expect(limitador.registrar("a")).toBe(0);
    expect(limitador.registrar("a")).toBe(0);
    expect(limitador.registrar("a")).toBe(0);
    expect(limitador.registrar("a")).toBe(60);
    agora += 30_000;
    expect(limitador.registrar("a")).toBe(30);
  });

  it("volta a liberar quando a janela passa, e conta cada chave separada", () => {
    let agora = 0;
    const limitador = new Limitador(1, 10_000, () => agora);
    expect(limitador.registrar("a")).toBe(0);
    expect(limitador.registrar("b")).toBe(0);
    expect(limitador.registrar("a")).toBeGreaterThan(0);
    agora = 10_000;
    expect(limitador.registrar("a")).toBe(0);
  });

  it("não estoura a memória: descarta a chave mais antiga", () => {
    const limitador = new Limitador(1, 60_000, () => 0, 2);
    limitador.registrar("a");
    limitador.registrar("b");
    limitador.registrar("c");
    expect(limitador.registrar("a")).toBe(0);
  });
});
