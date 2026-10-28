import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type { ModeloResolvido } from "@finnagent/contracts";

/** Cria o modelo de chat de um provedor. `temperatura` null deixa o padrão do modelo. */
export interface FabricaDeModelos {
  criar(modelo: ModeloResolvido, temperatura: number | null): BaseChatModel;
}
