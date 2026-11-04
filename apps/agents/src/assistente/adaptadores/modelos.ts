import { ChatAnthropic } from "@langchain/anthropic";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatOpenAI } from "@langchain/openai";
import type { ModeloResolvido } from "@finnagent/contracts";
import type { FabricaDeModelos } from "../portas/fabrica-de-modelos.js";

/**
 * O teto da resposta na Anthropic. Um plano grande (acumular_linhas com dezenas de linhas) passa fácil de 4 mil
 * tokens e chega cortado. Os Claude 3 e 3.5 têm teto menor e recusam um valor acima dele. Acima de uns 21 mil, o
 * SDK exige streaming em qualquer chamada, então o valor fica abaixo disso.
 */
export function saidaDaAnthropic(model: string) {
  if (/claude-3-5|claude-3\.5/i.test(model)) return 8192;
  if (/claude-3-(opus|sonnet|haiku)|claude-3-haiku/i.test(model)) return 4096;
  return 16_000;
}

/**
 * Um adaptador por família. OpenAI, os compatíveis (OpenRouter, Groq, Mistral, DeepSeek...) e o Ollama
 * falam o mesmo formato e só mudam a URL; Anthropic e Gemini têm cliente próprio.
 */
export class FabricaDeModelosLangChain implements FabricaDeModelos {
  criar(modelo: ModeloResolvido, temperatura: number | null) {
    const comTemperatura = temperatura === null ? {} : { temperature: temperatura };
    if (modelo.kind === "anthropic") {
      return new ChatAnthropic({ model: modelo.model, apiKey: modelo.apiKey, maxTokens: saidaDaAnthropic(modelo.model), ...comTemperatura });
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
