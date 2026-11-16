import { describe, expect, it } from "vitest";
import { rotaInterna } from "./navegacao";

describe("rota interna", () => {
  it.each(["https://malicioso.test", "//malicioso.test", "\\\\malicioso.test", "/\\malicioso.test", "financas"])(
    "recusa %s",
    (rota) => expect(rotaInterna(rota)).toBe("/notificacoes"),
  );

  it("preserva caminho, consulta e fragmento internos", () => {
    expect(rotaInterna("/extratos?aba=conferencia#linha-1")).toBe("/extratos?aba=conferencia#linha-1");
  });
});
