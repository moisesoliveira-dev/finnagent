import { describe, expect, it } from "vitest";
import {
  contarPor,
  diasAte,
  fusoDaConta,
  inicioDaRetencao,
  montarVolume,
  paginaNoLimite,
  retencaoDaConta,
} from "./pagina.js";

describe("página de eventos", () => {
  it("traz a página pedida para dentro do que existe", () => {
    expect(paginaNoLimite(1, 0, 50)).toBe(1);
    expect(paginaNoLimite(2, 120, 50)).toBe(2);
    expect(paginaNoLimite(9, 120, 50)).toBe(3);
    expect(paginaNoLimite(3, 100, 50)).toBe(2);
  });

  it("lista os dias da janela, atravessando a virada do mês e do ano", () => {
    expect(diasAte("2026-03-02", 4)).toEqual(["2026-02-27", "2026-02-28", "2026-03-01", "2026-03-02"]);
    expect(diasAte("2027-01-01", 2)).toEqual(["2026-12-31", "2027-01-01"]);
    expect(diasAte("2026-10-28", 30)).toHaveLength(30);
  });

  it("conta com zero o que o banco não trouxe e ignora chave desconhecida", () => {
    expect(contarPor(["a", "b"] as const, [{ chave: "b", total: 4 }, { chave: "z", total: 9 }])).toEqual({ a: 0, b: 4 });
  });

  it("monta o volume de cada dia, somando os status", () => {
    const volume = montarVolume(
      ["2026-10-27", "2026-10-28"],
      [
        { dia: "2026-10-28", status: "concluído", total: 5 },
        { dia: "2026-10-28", status: "pendente", total: 2 },
        { dia: "2026-10-01", status: "concluído", total: 7 },
      ],
    );
    expect(volume).toEqual([
      { date: "2026-10-27", total: 0, status: { pendente: 0, processando: 0, "concluído": 0, "com falha": 0 } },
      { date: "2026-10-28", total: 7, status: { pendente: 2, processando: 0, "concluído": 5, "com falha": 0 } },
    ]);
  });

  it("usa só fuso e retenção conhecidos", () => {
    expect(fusoDaConta("America/Manaus")).toBe("America/Manaus");
    expect(fusoDaConta("'; DROP TABLE outbox; --")).toBe("America/Sao_Paulo");
    expect(fusoDaConta(null)).toBe("America/Sao_Paulo");
    expect(retencaoDaConta("90d")).toBe("90d");
    expect(retencaoDaConta("2 anos")).toBe("sempre");
  });

  it("corta a retenção em 90 dias ou um ano; sempre não corta", () => {
    const agora = new Date("2026-10-28T12:00:00.000Z");
    expect(inicioDaRetencao("sempre", agora)).toBeNull();
    expect(inicioDaRetencao("90d", agora)?.toISOString()).toBe("2026-07-30T12:00:00.000Z");
    expect(inicioDaRetencao("1a", agora)?.toISOString()).toBe("2025-10-28T12:00:00.000Z");
  });
});
