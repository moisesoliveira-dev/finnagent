import { createSign } from "node:crypto";
import { Injectable } from "@nestjs/common";
import type { CargaDoPush } from "@finnagent/contracts";
import { z } from "zod";
import { log } from "../../log.js";
import type { CanalDePush, ResultadoDoPush } from "../portas/canal-de-push.js";
import type { DispositivoGravado } from "../portas/notificacoes-repositorio.js";

const ESCOPO = "https://www.googleapis.com/auth/firebase.messaging";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const PRAZO_DO_PEDIDO = 10_000;

const contaDeServico = z.object({
  project_id: z.string().min(1),
  client_email: z.string().min(1),
  private_key: z.string().min(1),
});

type ContaDeServico = z.infer<typeof contaDeServico>;

/**
 * Push do celular pelo Firebase Cloud Messaging (API HTTP v1). O Firebase entrega no Android e, com a chave da
 * Apple cadastrada no projeto dele, no iOS. `FIREBASE_SERVICE_ACCOUNT` é o JSON da conta de serviço, inteiro.
 */
@Injectable()
export class FirebasePush implements CanalDePush {
  private readonly conta: ContaDeServico | null = lerConta(process.env.FIREBASE_SERVICE_ACCOUNT);
  private acesso: { token: string; ate: number } | null = null;

  disponivel() {
    return this.conta !== null;
  }

  async enviar(dispositivo: DispositivoGravado, carga: CargaDoPush): Promise<ResultadoDoPush> {
    if (!this.conta) return "falhou";
    try {
      const resposta = await fetch(`https://fcm.googleapis.com/v1/projects/${this.conta.project_id}/messages:send`, {
        method: "POST",
        headers: { authorization: `Bearer ${await this.tokenDeAcesso(this.conta)}`, "content-type": "application/json" },
        body: JSON.stringify({ message: mensagemDe(dispositivo.endpoint, carga) }),
        signal: AbortSignal.timeout(PRAZO_DO_PEDIDO),
      });
      if (resposta.ok) return "entregue";
      const corpo = (await resposta.json().catch(() => ({}))) as { error?: { status?: string; details?: { errorCode?: string }[] } };
      const codigo = corpo.error?.details?.find((item) => item.errorCode)?.errorCode ?? corpo.error?.status ?? "";
      // O aparelho desinstalou o app ou o token trocou.
      if (resposta.status === 404 || codigo === "UNREGISTERED") return "expirado";
      if (resposta.status === 401) this.acesso = null;
      log.warn({ status: resposta.status, codigo }, "o push do celular falhou");
      return "falhou";
    } catch (error) {
      log.warn({ err: error instanceof Error ? error.message : String(error) }, "o push do celular não respondeu");
      return "falhou";
    }
  }

  /** O token OAuth vale uma hora; renova cinco minutos antes. */
  private async tokenDeAcesso(conta: ContaDeServico) {
    const agora = Math.floor(Date.now() / 1000);
    if (this.acesso && this.acesso.ate > agora + 300) return this.acesso.token;
    const assertion = jwt(conta, agora);
    const resposta = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
      signal: AbortSignal.timeout(PRAZO_DO_PEDIDO),
    });
    if (!resposta.ok) throw new Error(`o Google recusou a conta de serviço (${resposta.status})`);
    const corpo = (await resposta.json()) as { access_token: string; expires_in: number };
    this.acesso = { token: corpo.access_token, ate: agora + corpo.expires_in };
    return corpo.access_token;
  }
}

function lerConta(bruto: string | undefined): ContaDeServico | null {
  if (!bruto?.trim()) return null;
  try {
    const lida = contaDeServico.safeParse(JSON.parse(bruto));
    if (lida.success) return lida.data;
  } catch {
    // Cai no aviso abaixo.
  }
  log.error("FIREBASE_SERVICE_ACCOUNT não é o JSON de uma conta de serviço: o push do celular fica desligado");
  return null;
}

function base64url(texto: string) {
  return Buffer.from(texto).toString("base64url");
}

function jwt(conta: ContaDeServico, agora: number) {
  const cabecalho = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const corpo = base64url(
    JSON.stringify({ iss: conta.client_email, scope: ESCOPO, aud: TOKEN_URL, iat: agora, exp: agora + 3600 }),
  );
  const assinatura = createSign("RSA-SHA256").update(`${cabecalho}.${corpo}`).sign(conta.private_key, "base64url");
  return `${cabecalho}.${corpo}.${assinatura}`;
}

/** `data` leva o destino para o app abrir a tela certa no toque; `notification` é o que o sistema mostra. */
function mensagemDe(token: string, carga: CargaDoPush) {
  return {
    token,
    notification: { title: carga.titulo, body: carga.texto },
    data: { id: carga.id, tipo: carga.tipo, tela: carga.tela, alvo: carga.alvo ?? "" },
    android: { priority: "HIGH", notification: { tag: carga.id, channel_id: "avisos" } },
    apns: { headers: { "apns-collapse-id": carga.id.slice(0, 64) }, payload: { aps: { sound: "default" } } },
  };
}
