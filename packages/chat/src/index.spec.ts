import type { EventoDoChat, MensagemDoChat } from "@finnagent/contracts";
import { describe, expect, it } from "vitest";
import { ID_PROVISORIO, aplicarEvento, lerEventos, mensagemProvisoria } from "./index";

const feita = (texto: string): MensagemDoChat => ({
  id: "m1",
  role: "assistant",
  partes: [{ tipo: "texto", texto }],
  agente: null,
  createdAt: "2026-10-30T10:00:00Z",
});

describe("estado do chat", () => {
  it("troca a mensagem provisória pela definitiva e junta o texto que chega", () => {
    let lista: MensagemDoChat[] = [mensagemProvisoria("oi")];
    let id: string | null = null;
    const eventos: EventoDoChat[] = [
      { tipo: "inicio", usuario: { ...feita("oi"), id: "u1", role: "user" }, assistenteId: "a1" },
      { tipo: "texto", delta: "Olá" },
      { tipo: "texto", delta: ", Ana!" },
    ];
    for (const evento of eventos) ({ mensagens: lista, assistenteId: id } = aplicarEvento(lista, id, evento));
    expect(lista.map((item) => item.id)).toEqual(["u1", "a1"]);
    expect(lista.some((item) => item.id === ID_PROVISORIO)).toBe(false);
    expect(lista[1]?.partes).toEqual([{ tipo: "texto", texto: "Olá, Ana!" }]);
  });

  it("lê eventos NDJSON mesmo quando uma linha chega partida em dois pedaços", async () => {
    const partes = ['{"tipo":"texto","delta":"a"}\n{"tipo":"te', 'xto","delta":"b"}\n'];
    const corpo = new ReadableStream<Uint8Array>({
      start(controle) {
        for (const parte of partes) controle.enqueue(new TextEncoder().encode(parte));
        controle.close();
      },
    });
    const lidos: EventoDoChat[] = [];
    for await (const evento of lerEventos(new Response(corpo))) lidos.push(evento);
    expect(lidos).toEqual([
      { tipo: "texto", delta: "a" },
      { tipo: "texto", delta: "b" },
    ]);
  });
});
