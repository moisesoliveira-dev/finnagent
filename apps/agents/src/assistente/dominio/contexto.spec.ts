import { describe, expect, it } from "vitest";
import { saidaDaAnthropic } from "../adaptadores/modelos.js";
import { avisoDeContextoCortado, tokensEstimados } from "./contexto.js";

describe("contexto cortado", () => {
  it("só o Ollama, e só quando leu bem menos do que recebeu", () => {
    expect(avisoDeContextoCortado("ollama", 4096, 15_000)).toContain("pelo menos 19456 tokens");
    expect(avisoDeContextoCortado("ollama", 14_000, 15_000)).toBeNull();
    expect(avisoDeContextoCortado("openai", 4096, 15_000)).toBeNull();
    expect(avisoDeContextoCortado("ollama", undefined, 15_000)).toBeNull();
    expect(tokensEstimados(57_000)).toBe(14_250);
  });
});

describe("teto da resposta na Anthropic", () => {
  it("dá espaço para plano grande e respeita o teto dos Claude antigos", () => {
    expect(saidaDaAnthropic("claude-sonnet-4-5")).toBe(16_000);
    expect(saidaDaAnthropic("claude-3-7-sonnet-latest")).toBe(16_000);
    expect(saidaDaAnthropic("claude-3-5-haiku-latest")).toBe(8192);
    expect(saidaDaAnthropic("claude-3-haiku-20240307")).toBe(4096);
  });
});
