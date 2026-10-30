import { SecureStorage } from "@aparajita/capacitor-secure-storage";
import { Capacitor } from "@capacitor/core";
import { PushNotifications, type Token } from "@capacitor/push-notifications";
import { TELAS_DE_DESTINO, type TelaDeDestino } from "@finnagent/contracts";
import { enviar } from "../api/cliente";
import { rotaDoApp } from "./destino";

const CHAVE = "prumo.push";
/** O canal do Android. O backend manda o push nele (`channel_id`). */
const CANAL = "avisos";

export type EstadoDoPushNoCelular = "indisponivel" | "bloqueado" | "desligado" | "ligado";

export const pushNoAparelho = () => Capacitor.isNativePlatform();

const plataforma = () => (Capacitor.getPlatform() === "ios" ? "ios" : "android");

async function tokenGuardado() {
  return ((await SecureStorage.get(CHAVE).catch(() => null)) as string | null) || null;
}

async function entregarToken(token: string) {
  await enviar<void>("/api/notificacoes/dispositivos", { tipo: "celular", token, plataforma: plataforma() });
  await SecureStorage.set(CHAVE, token);
}

/** Pede o token ao sistema e espera a resposta (o registro responde por evento). */
function registrar() {
  return new Promise<string>((resolver, rejeitar) => {
    const ouvintes = Promise.all([
      PushNotifications.addListener("registration", (token: Token) => {
        void ouvintes.then((lista) => lista.forEach((item) => void item.remove()));
        resolver(token.value);
      }),
      PushNotifications.addListener("registrationError", (erro) => {
        void ouvintes.then((lista) => lista.forEach((item) => void item.remove()));
        rejeitar(new Error(erro.error || "O aparelho não entregou o token do push."));
      }),
    ]);
    void ouvintes.then(() => PushNotifications.register());
  });
}

export async function estadoDoPushNoCelular(): Promise<EstadoDoPushNoCelular> {
  if (!pushNoAparelho()) return "indisponivel";
  const { receive } = await PushNotifications.checkPermissions();
  if (receive === "denied") return "bloqueado";
  return receive === "granted" && (await tokenGuardado()) ? "ligado" : "desligado";
}

/** No toque da pessoa: pede a permissão, registra o aparelho e entrega o token ao backend. */
export async function ligarPushNoCelular(): Promise<EstadoDoPushNoCelular> {
  if (!pushNoAparelho()) return "indisponivel";
  const { receive } = await PushNotifications.requestPermissions();
  if (receive !== "granted") return receive === "denied" ? "bloqueado" : "desligado";
  if (plataforma() === "android") {
    await PushNotifications.createChannel({ id: CANAL, name: "Avisos", description: "Vencimentos, lembretes, extratos, metas e o assistente", importance: 4 });
  }
  await entregarToken(await registrar());
  return "ligado";
}

/** Tira o aparelho da lista. Usado também ao sair da conta: o próximo usuário não recebe o push de quem saiu. */
export async function desligarPushNoCelular() {
  if (!pushNoAparelho()) return;
  const token = await tokenGuardado();
  if (token) await enviar<void>("/api/notificacoes/dispositivos/remover", { endpoint: token }).catch(() => undefined);
  await SecureStorage.remove(CHAVE).catch(() => undefined);
  await PushNotifications.unregister().catch(() => undefined);
}

/**
 * Enquanto a pessoa está logada: o token novo (o sistema troca de vez em quando) vai para o backend, o push que
 * chega com o app aberto atualiza o sino, e o toque na notificação abre a tela dela.
 */
export function ouvirPush(navegar: (rota: string) => void, aoChegar: () => void) {
  if (!pushNoAparelho()) return () => undefined;
  const ouvintes = Promise.all([
    PushNotifications.addListener("registration", (token) => {
      void tokenGuardado().then((atual) => {
        if (atual && atual !== token.value) void entregarToken(token.value).catch(() => undefined);
      });
    }),
    PushNotifications.addListener("pushNotificationReceived", () => aoChegar()),
    PushNotifications.addListener("pushNotificationActionPerformed", (acao) => {
      const dados = acao.notification.data as { tela?: string; alvo?: string } | undefined;
      const tela = (TELAS_DE_DESTINO as readonly string[]).includes(dados?.tela ?? "") ? (dados?.tela as TelaDeDestino) : null;
      aoChegar();
      if (tela) navegar(rotaDoApp({ tela, id: dados?.alvo || null }));
    }),
  ]);
  // Quem já ativou: registra de novo a cada abertura, para pegar o token se ele mudou.
  void estadoDoPushNoCelular().then((estado) => {
    if (estado === "ligado") void PushNotifications.register();
  });
  return () => void ouvintes.then((lista) => lista.forEach((item) => void item.remove()));
}
