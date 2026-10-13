import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { initChatModel } from "langchain";
import { ModeloIndisponivel } from "../dominio/erros.js";
import type { ArquivoDeExtrato, LeitorDeExtrato, ModeloDeExtrato } from "../portas/leitor.js";

const INSTRUCAO = [
  "Organize o extrato bancário brasileiro.",
  "Responda só com JSON: {\"linhas\":[{\"date\":\"AAAA-MM-DD\",\"description\":\"texto\",\"cents\":0}]}",
  "cents é inteiro, em centavos. Saída é negativa e entrada é positiva.",
  "Se a data não existir, use uma string vazia.",
].join(" ");

export class OpenAiExtrato implements LeitorDeExtrato, ModeloDeExtrato {
  async ler(arquivo: ArquivoDeExtrato) {
    const modelo = await this.chat();
    const resposta = await modelo.invoke([
      new HumanMessage({
        content: [
          { type: "text", text: "Transcreva o extrato. Mantenha datas, descrições e valores." },
          blocoDoArquivo(arquivo),
        ],
      }),
    ]);
    return textoDe(resposta.content);
  }

  async organizarTexto(texto: string) {
    const modelo = await this.chat();
    const resposta = await modelo.invoke([
      new SystemMessage(INSTRUCAO),
      new HumanMessage(texto),
    ]);
    return jsonDe(textoDe(resposta.content));
  }

  private chat() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return Promise.reject(new ModeloIndisponivel());
    return initChatModel("gpt-4o", { modelProvider: "openai", apiKey, temperature: 0 });
  }
}

function blocoDoArquivo(arquivo: ArquivoDeExtrato) {
  const url = `data:${arquivo.mediaType};base64,${arquivo.conteudo}`;
  if (arquivo.mediaType === "application/pdf") {
    return { type: "file" as const, file: { filename: arquivo.filename, file_data: url } };
  }
  return { type: "image_url" as const, image_url: { url } };
}

function textoDe(conteudo: unknown) {
  if (typeof conteudo === "string") return conteudo;
  if (!Array.isArray(conteudo)) return "";
  return conteudo
    .map((parte) => {
      if (typeof parte === "string") return parte;
      if (parte && typeof parte === "object" && "text" in parte) return String(parte.text);
      return "";
    })
    .join("");
}

function jsonDe(texto: string) {
  const limpo = texto.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  const inicio = limpo.indexOf("{");
  const fim = limpo.lastIndexOf("}");
  if (inicio < 0 || fim < inicio) return [];
  try {
    const corpo = JSON.parse(limpo.slice(inicio, fim + 1)) as { linhas?: unknown };
    return corpo.linhas ?? [];
  } catch {
    return [];
  }
}
