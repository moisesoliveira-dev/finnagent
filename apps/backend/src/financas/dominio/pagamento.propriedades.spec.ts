import fc from "fast-check";
import type { Ocorrencia } from "@finnagent/contracts";
import { describe, expect, it } from "vitest";
import { ocorrenciaDoPagamento, pagarOcorrencia } from "./pagamento.js";

const dia = (mes: number, numero: number) => `2026-${String(mes).padStart(2, "0")}-${String(numero).padStart(2, "0")}`;

const ocorrencias = fc
  .array(
    fc.record({
      mes: fc.integer({ min: 1, max: 12 }),
      dia: fc.integer({ min: 1, max: 28 }),
      status: fc.constantFrom("pending" as const, "completed" as const, "cancelled" as const, "refunded" as const),
      plannedCents: fc.integer({ min: -500_000, max: 500_000 }),
    }),
    { maxLength: 24 },
  )
  .map((itens) =>
    itens.map(
      (item, indice): Ocorrencia => ({
        number: indice + 1,
        dueDate: dia(item.mes, item.dia),
        plannedCents: item.plannedCents,
        paidCents: item.status === "completed" ? item.plannedCents : null,
        paidOn: item.status === "completed" ? dia(item.mes, item.dia) : null,
        status: item.status,
      }),
    ),
  );
const data = fc.record({ mes: fc.integer({ min: 1, max: 12 }), dia: fc.integer({ min: 1, max: 28 }) }).map((d) => dia(d.mes, d.dia));

describe("pagamento pelo extrato (propriedades)", () => {
  it("só paga uma ocorrência do mesmo mês, pendente antes de paga, e nunca uma cancelada ou estornada", () => {
    fc.assert(
      fc.property(ocorrencias, data, (lista, quando) => {
        const numero = ocorrenciaDoPagamento(lista, quando);
        const doMes = lista.filter(
          (item) => item.dueDate.slice(0, 7) === quando.slice(0, 7) && (item.status === "pending" || item.status === "completed"),
        );
        if (doMes.length === 0) {
          expect(numero).toBeNull();
          return;
        }
        const escolhida = lista.find((item) => item.number === numero);
        expect(escolhida && doMes.includes(escolhida)).toBe(true);
        if (doMes.some((item) => item.status === "pending")) expect(escolhida?.status).toBe("pending");
      }),
    );
  });

  it("pagar marca como paga com o valor e a data, sem mexer no planejado", () => {
    fc.assert(
      fc.property(ocorrencias.filter((lista) => lista.length > 0), fc.integer({ min: -500_000, max: 500_000 }), data, (lista, cents, quando) => {
        const paga = pagarOcorrencia(lista[0], cents, quando);
        expect(paga).toMatchObject({ status: "completed", paidCents: cents, paidOn: quando, plannedCents: lista[0].plannedCents });
        expect(paga.number).toBe(lista[0].number);
      }),
    );
  });
});
