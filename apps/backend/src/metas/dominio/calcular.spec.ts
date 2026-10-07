import { calcularMeta } from "@finnagent/contracts";
import { describe, expect, it } from "vitest";

const hoje = { year: 2026, month: 10 };

describe("cálculo da meta", () => {
  it("divide a falta pelos meses do prazo, contando o mês atual", () => {
    const calculo = calcularMeta(
      { targetCents: 12000, savedCents: 0, dueYear: 2027, dueMonth: 1 },
      hoje,
      1000,
    );
    expect(calculo.falta).toBe(12000);
    expect(calculo.mesesNoPrazo).toBe(4);
    expect(calculo.porMes).toBe(3000);
    expect(calculo.mesesNaSobra).toBe(12);
    expect(calculo.alcancada).toBe(false);
  });

  it("arredonda a parcela e os meses da sobra para cima", () => {
    const calculo = calcularMeta(
      { targetCents: 101, savedCents: 0, dueYear: 2026, dueMonth: 12 },
      hoje,
      30,
    );
    expect(calculo.mesesNoPrazo).toBe(3);
    expect(calculo.porMes).toBe(34);
    expect(calculo.mesesNaSobra).toBe(4);
  });

  it("pede o valor inteiro quando o prazo é o mês atual", () => {
    const calculo = calcularMeta(
      { targetCents: 300, savedCents: 0, dueYear: 2026, dueMonth: 10 },
      hoje,
      100,
    );
    expect(calculo.mesesNoPrazo).toBe(1);
    expect(calculo.porMes).toBe(300);
    expect(calculo.prazoPassou).toBe(false);
  });

  it("desconta o que já foi separado e marca a meta alcançada", () => {
    const falta = calcularMeta(
      { targetCents: 1000, savedCents: 400, dueYear: null, dueMonth: null },
      hoje,
      200,
    );
    expect(falta.falta).toBe(600);
    expect(falta.mesesNaSobra).toBe(3);
    expect(falta.porMes).toBeNull();

    const pronta = calcularMeta(
      { targetCents: 500, savedCents: 800, dueYear: null, dueMonth: null },
      hoje,
      -100,
    );
    expect(pronta.alcancada).toBe(true);
    expect(pronta.falta).toBe(0);
    expect(pronta.mesesNaSobra).toBeNull();
  });

  it("avisa o prazo vencido e não projeta meses sem sobra", () => {
    const vencida = calcularMeta(
      { targetCents: 500, savedCents: 0, dueYear: 2026, dueMonth: 9 },
      hoje,
      100,
    );
    expect(vencida.prazoPassou).toBe(true);
    expect(vencida.porMes).toBeNull();
    expect(vencida.mesesNaSobra).toBe(5);

    const semSobra = calcularMeta(
      { targetCents: 500, savedCents: 100, dueYear: null, dueMonth: null },
      hoje,
      0,
    );
    expect(semSobra.mesesNaSobra).toBeNull();
    expect(semSobra.porMes).toBeNull();
  });
});
