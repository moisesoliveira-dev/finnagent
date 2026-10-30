import type { CargaDoPush } from "@finnagent/contracts";
import type { DispositivoGravado } from "./notificacoes-repositorio.js";

export const PUSH_DO_NAVEGADOR = Symbol("PUSH_DO_NAVEGADOR");
export const PUSH_DO_CELULAR = Symbol("PUSH_DO_CELULAR");

/** expirado: a inscrição não existe mais e o aparelho sai da lista. falhou: erro de rede ou do serviço. */
export type ResultadoDoPush = "entregue" | "expirado" | "falhou";

/** Um serviço de push. Sem as variáveis dele, fica indisponível e o sistema segue só com a central. */
export interface CanalDePush {
  disponivel(): boolean;
  enviar(dispositivo: DispositivoGravado, carga: CargaDoPush): Promise<ResultadoDoPush>;
}

/** O Web Push ainda entrega a chave pública que o navegador usa para se inscrever. */
export interface PushDoNavegador extends CanalDePush {
  chavePublica(): string | null;
}
