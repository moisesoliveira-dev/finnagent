import { ChatAnthropic } from "@langchain/anthropic";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatOpenAI } from "@langchain/openai";
import type { ModeloResolvido } from "@finnagent/contracts";
import type { FabricaDeModelos } from "../portas/fabrica-de-modelos.js";

/**
 * Um adaptador por família. OpenAI, os compatíveis (OpenRouter, Groq, Mistral, DeepSeek...) e o Ollama
 * falam o mesmo formato e só mudam a URL; Anthropic e Gemini têm cliente próprio.
 */
export class FabricaDeModelosLangChain implements FabricaDeModelos {
  criar(modelo: ModeloResolvido, temperatura: number | null) {
    const comTemperatura = temperatura === null ? {} : { temperature: temperatura };
    if (modelo.kind === "anthropic") {
      return new ChatAnthropic({ model: modelo.model, apiKey: modelo.apiKey, maxTokens: 4096, ...comTemperatura });
    }
    if (modelo.kind === "google") {
      return new ChatGoogleGenerativeAI({ model: modelo.model, apiKey: modelo.apiKey, ...comTemperatura });
    }
    const baseURL = modelo.kind === "openai" ? undefined : modelo.baseUrl || undefined;
    // Sem chave salva, a OpenAI usa a do ambiente, como a leitura de extrato. O Ollama não pede chave,
    // mas o cliente exige um valor.
    const apiKey = modelo.apiKey || (modelo.kind === "openai" ? process.env.OPENAI_API_KEY : "") || "sem-chave";
    return new ChatOpenAI({
      model: modelo.model,
      apiKey,
      configuration: baseURL ? { baseURL } : undefined,
      ...comTemperatura,
    });
  }
}
