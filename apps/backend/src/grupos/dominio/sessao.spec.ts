import { describe, expect, it } from "vitest";
import { fimDaSessao, inicioDaSessao } from "./sessao.js";

describe("datas da sessão", () => {
  it("usa o dia anterior em São Paulo quando o UTC já virou o mês", () => {
    const instante = new Date("2026-10-01T02:30:00.000Z");
    expect(inicioDaSessao(instante)).toBe("2026-09-01");
    expect(fimDaSessao(instante)).toBe("2026-09-30");
  });

  it("usa o mês novo em São Paulo depois da meia-noite local", () => {
    const instante = new Date("2026-10-01T03:30:00.000Z");
    expect(inicioDaSessao(instante)).toBe("2026-10-01");
    expect(fimDaSessao(instante)).toBe("2026-10-01");
  });
});
