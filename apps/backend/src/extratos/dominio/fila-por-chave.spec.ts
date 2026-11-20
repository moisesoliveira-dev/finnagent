import { describe, expect, it } from "vitest";
import { FilaPorChave } from "./fila-por-chave.js";

const esperar = (ms: number) => new Promise((resolver) => setTimeout(resolver, ms));

describe("fila por chave", () => {
  it("roda uma ação por vez na mesma chave, na ordem de chegada", async () => {
    const fila = new FilaPorChave();
    const eventos: string[] = [];
    const tarefa = (nome: string, ms: number) => async () => {
      eventos.push(`início ${nome}`);
      await esperar(ms);
      eventos.push(`fim ${nome}`);
      return nome;
    };
    const resultados = await Promise.all([fila.executar("linha", tarefa("a", 20)), fila.executar("linha", tarefa("b", 1)), fila.executar("linha", tarefa("c", 1))]);
    expect(resultados).toEqual(["a", "b", "c"]);
    expect(eventos).toEqual(["início a", "fim a", "início b", "fim b", "início c", "fim c"]);
  });

  it("deixa chaves diferentes andarem juntas", async () => {
    const fila = new FilaPorChave();
    const eventos: string[] = [];
    await Promise.all([
      fila.executar("x", async () => { eventos.push("x início"); await esperar(15); eventos.push("x fim"); }),
      fila.executar("y", async () => { eventos.push("y início"); await esperar(1); eventos.push("y fim"); }),
    ]);
    expect(eventos).toEqual(["x início", "y início", "y fim", "x fim"]);
  });

  it("segue para a próxima quando uma ação falha, e esvazia a fila no fim", async () => {
    const fila = new FilaPorChave();
    const falha = fila.executar("k", async () => {
      throw new Error("falhou");
    });
    const ok = fila.executar("k", async () => "ok");
    await expect(falha).rejects.toThrow("falhou");
    await expect(ok).resolves.toBe("ok");
    await esperar(1);
    expect(fila.tamanho).toBe(0);
  });
});
