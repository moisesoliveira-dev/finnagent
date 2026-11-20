import { describe, expect, it } from "vitest";
import { traduzirErroDoBanco } from "./filtro-de-erros-do-banco.js";

const erroDoPrisma = (code: string) => Object.assign(new Error("falha"), { code, clientVersion: "6.19.3" });

describe("erros do banco como resposta", () => {
  it("traduz chave repetida, referência quebrada, registro ausente e conflito de escrita", () => {
    expect(traduzirErroDoBanco(erroDoPrisma("P2002"))?.getStatus()).toBe(409);
    expect(traduzirErroDoBanco(erroDoPrisma("P2003"))?.getStatus()).toBe(409);
    expect(traduzirErroDoBanco(erroDoPrisma("P2025"))?.getStatus()).toBe(404);
    expect(traduzirErroDoBanco(erroDoPrisma("P2034"))?.getStatus()).toBe(409);
  });

  it("traduz banco fora do ar e limite de conexões como indisponível (503), inclusive o erro de inicialização", () => {
    expect(traduzirErroDoBanco(erroDoPrisma("P1001"))?.getStatus()).toBe(503);
    expect(traduzirErroDoBanco(erroDoPrisma("P1017"))?.getStatus()).toBe(503);
    expect(traduzirErroDoBanco(erroDoPrisma("P2024"))?.getStatus()).toBe(503);
    expect(traduzirErroDoBanco(Object.assign(new Error("Can't reach database"), { errorCode: "P1001", clientVersion: "6.19.3" }))?.getStatus()).toBe(503);
  });

  it("deixa passar o que não é regra do banco, para virar erro de verdade", () => {
    expect(traduzirErroDoBanco(erroDoPrisma("P2010"))).toBeNull();
    expect(traduzirErroDoBanco(new Error("outro"))).toBeNull();
    expect(traduzirErroDoBanco({ code: "P2002" })).toBeNull();
    expect(traduzirErroDoBanco(null)).toBeNull();
  });
});
