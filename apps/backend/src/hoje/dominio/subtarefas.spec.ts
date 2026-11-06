import type { Tarefa } from "@finnagent/contracts";
import { describe, expect, it } from "vitest";
import { ancestrais, descendentes, mudancasAoConcluir, ordemDepoisDeMover, podeMover } from "./subtarefas.js";

const t = (id: string, parentId: string | null = null, doneOn: string | null = null): Tarefa => ({ id, title: id, date: "2026-11-06", doneOn, position: 0, parentId, repeat: null });
const HOJE = "2026-11-06";
// raiz > a > a1, a2; raiz > b
const ARVORE = [t("raiz"), t("a", "raiz"), t("a1", "a"), t("a2", "a"), t("b", "raiz")];

describe("a árvore das atividades", () => {
  it("acha descendentes e ancestrais em qualquer profundidade", () => {
    expect(descendentes(ARVORE, "raiz")).toEqual(["a", "a1", "a2", "b"]);
    expect(descendentes(ARVORE, "a")).toEqual(["a1", "a2"]);
    expect(ancestrais(ARVORE, "a1")).toEqual(["a", "raiz"]);
    expect(ancestrais(ARVORE, "raiz")).toEqual([]);
  });

  it("marcar leva as descendentes abertas; a última aberta fecha o pai e sobe enquanto der", () => {
    expect(mudancasAoConcluir(ARVORE, "a", HOJE)).toEqual([{ id: "a", doneOn: HOJE }, { id: "a1", doneOn: HOJE }, { id: "a2", doneOn: HOJE }]);
    // a1 fecha, a2 já estava fechada: a fecha; b aberta: a raiz não.
    const quase = [t("raiz"), t("a", "raiz"), t("a1", "a"), t("a2", "a", HOJE), t("b", "raiz")];
    expect(mudancasAoConcluir(quase, "a1", HOJE)).toEqual([{ id: "a1", doneOn: HOJE }, { id: "a", doneOn: HOJE }]);
    // Com b fechada também, sobe até a raiz.
    const tudo = [t("raiz"), t("a", "raiz"), t("a1", "a"), t("a2", "a", HOJE), t("b", "raiz", HOJE)];
    expect(mudancasAoConcluir(tudo, "a1", HOJE)).toEqual([{ id: "a1", doneOn: HOJE }, { id: "a", doneOn: HOJE }, { id: "raiz", doneOn: HOJE }]);
  });

  it("reabrir uma folha reabre os ancestrais fechados e deixa as filhas como estão", () => {
    const fechada = [t("raiz", null, HOJE), t("a", "raiz", HOJE), t("a1", "a", HOJE), t("a2", "a", HOJE), t("b", "raiz", HOJE)];
    expect(mudancasAoConcluir(fechada, "a1", null)).toEqual([{ id: "a1", doneOn: null }, { id: "a", doneOn: null }, { id: "raiz", doneOn: null }]);
    expect(mudancasAoConcluir(fechada, "a", null)).toEqual([{ id: "a", doneOn: null }, { id: "raiz", doneOn: null }]);
  });

  it("mover não entra em si mesma nem numa descendente, e a ordem das irmãs respeita o antes", () => {
    expect(podeMover(ARVORE, "a", null)).toBe(true);
    expect(podeMover(ARVORE, "a", "b")).toBe(true);
    expect(podeMover(ARVORE, "a", "a")).toBe(false);
    expect(podeMover(ARVORE, "a", "a2")).toBe(false);
    expect(ordemDepoisDeMover(["a", "b", "c"], "c", "a")).toEqual(["c", "a", "b"]);
    expect(ordemDepoisDeMover(["a", "b", "c"], "a", null)).toEqual(["b", "c", "a"]);
    expect(ordemDepoisDeMover(["a", "b"], "novo", "b")).toEqual(["a", "novo", "b"]);
  });
});
