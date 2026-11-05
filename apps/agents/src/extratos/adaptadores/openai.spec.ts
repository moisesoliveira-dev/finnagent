import { describe, expect, it } from "vitest";
import { MENSAGEM_DA_LEITURA_VAZIA, blocoDoArquivo, transcricaoVazia } from "./openai.js";

describe("arquivo do extrato para o modelo", () => {
  it("o PDF vai no bloco padrão do LangChain, com o nome, para a API de Chat e a Responses", () => {
    expect(blocoDoArquivo({ filename: "extrato.pdf", mediaType: "application/pdf", conteudo: "JVBERi0=" })).toEqual({
      type: "file",
      source_type: "base64",
      mime_type: "application/pdf",
      data: "JVBERi0=",
      metadata: { filename: "extrato.pdf" },
    });
  });

  it("a imagem vai no bloco padrão de imagem", () => {
    expect(blocoDoArquivo({ filename: "foto.png", mediaType: "image/png", conteudo: "iVBOR" })).toEqual({
      type: "image",
      source_type: "base64",
      mime_type: "image/png",
      data: "iVBOR",
    });
  });

  it("transcrição sem nenhum valor é o modelo sem o arquivo, não um extrato vazio", () => {
    expect(transcricaoVazia("Claro. Envie a imagem ou o PDF do extrato para que eu possa transcrevê-lo.")).toBe(true);
    expect(transcricaoVazia("")).toBe(true);
    expect(transcricaoVazia("| 28 SET | Drogasil | R$ 285,07 |")).toBe(false);
    expect(transcricaoVazia("2026-10-02 MERCADO -45.00")).toBe(false);
    expect(MENSAGEM_DA_LEITURA_VAZIA).toContain("aceita PDF e imagem");
  });
});
