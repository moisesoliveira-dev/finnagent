import { Injectable } from "@nestjs/common";
import type { CargaDoPush } from "@finnagent/contracts";
import webpush from "web-push";
import { log } from "../../log.js";
import type { PushDoNavegador, ResultadoDoPush } from "../portas/canal-de-push.js";
import type { DispositivoGravado } from "../portas/notificacoes-repositorio.js";

/** Um dia: depois disso o serviço do navegador descarta o push que não conseguiu entregar. */
const VIDA_DO_PUSH_S = 24 * 60 * 60;

/** Push do navegador (Web Push, chaves VAPID). Sem as três variáveis, fica desligado. */
@Injectable()
export class WebPush implements PushDoNavegador {
  private readonly publica = process.env.VAPID_PUBLIC_KEY?.trim() || null;
  private readonly privada = process.env.VAPID_PRIVATE_KEY?.trim() || null;
  private readonly assunto = process.env.VAPID_SUBJECT?.trim() || null;

  disponivel() {
    return Boolean(this.publica && this.privada && this.assunto);
  }

  chavePublica() {
    return this.disponivel() ? this.publica : null;
  }

  async enviar(dispositivo: DispositivoGravado, carga: CargaDoPush): Promise<ResultadoDoPush> {
    if (!this.publica || !this.privada || !this.assunto) return "falhou";
    try {
      await webpush.sendNotification(
        { endpoint: dispositivo.endpoint, keys: { p256dh: dispositivo.p256dh, auth: dispositivo.auth } },
        JSON.stringify(carga),
        {
          TTL: VIDA_DO_PUSH_S,
          urgency: "normal",
          topic: carga.id.replace(/-/g, "").slice(0, 32),
          vapidDetails: { subject: this.assunto, publicKey: this.publica, privateKey: this.privada },
        },
      );
      return "entregue";
    } catch (error) {
      const status = typeof error === "object" && error !== null && "statusCode" in error ? Number(error.statusCode) : 0;
      // 404 e 410: a inscrição acabou (a pessoa tirou a permissão ou limpou o navegador).
      if (status === 404 || status === 410) return "expirado";
      log.warn({ status, err: error instanceof Error ? error.message : String(error) }, "o push do navegador falhou");
      return "falhou";
    }
  }
}
