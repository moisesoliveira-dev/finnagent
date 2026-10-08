import { montarEventos, type LinhaOutbox } from "@finnagent/contracts";
import { describe, expect, it } from "vitest";

function linha(parcial: Partial<LinhaOutbox> & Pick<LinhaOutbox, "id" | "operation">): LinhaOutbox {
  return {
    idempotencyKey: `${parcial.id}:chave`,
    payload: "{}",
    occurredAt: "2026-10-08T09:00:00.000Z",
    publishedAt: "2026-10-08T09:00:01.000Z",
    ...parcial,
  };
}

describe("eventos da outbox", () => {
  it("deriva pendente, processando e concluído e só registra histórico do que foi consumido", () => {
    const resposta = montarEventos(
      [
        linha({
          id: "a",
          operation: "criar-lancamento",
          occurredAt: "2026-10-08T08:00:00.000Z",
          publishedAt: null,
          payload: JSON.stringify({ id: "lan-1", valor_centavos: -4500 }),
        }),
        linha({
          id: "b",
          operation: "importar-extrato",
          occurredAt: "2026-10-08T09:00:00.000Z",
          payload: JSON.stringify({ statementId: "ext-1" }),
        }),
        linha({
          id: "c",
          operation: "criar-compromisso",
          occurredAt: "2026-10-08T10:00:00.000Z",
          idempotencyKey: "c:chave",
          payload: JSON.stringify({ id: "cal-1" }),
        }),
      ],
      [{ idempotencyKey: "c:chave", consumedAt: "2026-10-08T10:00:02.000Z" }],
    );

    expect(resposta.events.map((evento) => [evento.id, evento.status, evento.category, evento.origin])).toEqual([
      ["c", "concluído", "agenda", "sistema"],
      ["b", "processando", "extratos", "importação"],
      ["a", "pendente", "financeiro", "sistema"],
    ]);
    expect(resposta.events[2]?.aggregate).toBe("Lançamento · lan-1");
    expect(resposta.events[2]?.payload).toEqual({ id: "lan-1", valor_centavos: -4500 });
    expect(resposta.events[1]?.aggregate).toBe("Extrato · ext-1");
    expect(resposta.history).toEqual([
      {
        eventId: "c",
        eventType: "criar-compromisso",
        consumer: "Publicar outbox",
        result: "sucesso",
        attempt: 1,
        durationMs: null,
        occurredAt: "2026-10-08T10:00:02.000Z",
        error: "",
      },
    ]);
    expect(resposta.events[0]?.correlationId).toBeNull();
    expect(resposta.events[0]?.schemaVersion).toBe(1);
  });

  it("mascara segredo e número de conta e ignora payload inválido", () => {
    const resposta = montarEventos(
      [
        linha({
          id: "s",
          operation: "desconhecida",
          publishedAt: null,
          payload: JSON.stringify({
            token: "abc",
            conta: "12345678",
            nome: "Mercado",
            valor_centavos: -12840,
          }),
        }),
        linha({ id: "vazio", operation: "definir-workflow", publishedAt: null, payload: "não é json" }),
      ],
      [{ idempotencyKey: "outro-tenant", consumedAt: "2026-10-08T11:00:00.000Z" }],
    );

    expect(resposta.events[0]?.category).toBe("sistema");
    expect(resposta.events[0]?.payload).toEqual({
      token: "••••",
      conta: "••••",
      nome: "Mercado",
      valor_centavos: -12840,
    });
    expect(resposta.events[1]?.payload).toEqual({});
    expect(resposta.events[1]?.aggregate).toBe("Fluxo");
    expect(resposta.history).toEqual([]);
  });

  it("mascara um texto que é só dígitos longos e classifica o cruzamento como sistema", () => {
    const resposta = montarEventos(
      [
        linha({
          id: "x",
          operation: "cruzar-linha",
          payload: JSON.stringify({ id: "linha-1", documento: "123456" }),
        }),
      ],
      [],
    );
    expect(resposta.events[0]?.origin).toBe("sistema");
    expect(resposta.events[0]?.category).toBe("extratos");
    expect(resposta.events[0]?.payload).toEqual({ id: "linha-1", documento: "••••" });
  });
});
