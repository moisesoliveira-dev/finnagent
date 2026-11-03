import { describe, expect, it } from "vitest";
import { casaComABusca, termosDaBusca } from "./busca.js";

describe("busca na conferência", () => {
  it("separa os nomes por | e ignora maiúsculas e acento", () => {
    expect(termosDaBusca("Uber | 99 |  Pão de Açúcar")).toEqual(["uber", "99", "pao de acucar"]);
  });

  it("descarta termo curto demais, que casaria com tudo, e limita a quantidade", () => {
    expect(termosDaBusca("a|u|  |ok")).toEqual(["ok"]);
    expect(termosDaBusca(Array.from({ length: 12 }, (_, i) => `nome${i}`).join("|"))).toHaveLength(8);
    expect(termosDaBusca(undefined)).toEqual([]);
  });

  it("a descrição casa com qualquer termo, e sem termo casa com tudo", () => {
    const termos = termosDaBusca("uber|99");
    expect(casaComABusca("Compra no débito via NuPay — Uber", termos)).toBe(true);
    expect(casaComABusca("COMPRA NO DEBITO VIA NUPAY - 99FOOD", termos)).toBe(true);
    expect(casaComABusca("Compra no débito — DONA PITANGA ECONTR", termos)).toBe(false);
    expect(casaComABusca("qualquer coisa", [])).toBe(true);
  });
});
