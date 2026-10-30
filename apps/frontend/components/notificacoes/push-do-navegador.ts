import type { CanaisDisponiveis } from "@finnagent/contracts";

const WORKER = "/sw-notificacoes.js";

export type EstadoDoPush = "indisponivel" | "bloqueado" | "desligado" | "ligado";

export function pushSuportado() {
  return (
    typeof window !== "undefined" &&
    window.isSecureContext &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

async function inscricaoAtual() {
  const registro = await navigator.serviceWorker.getRegistration(WORKER);
  return registro ? registro.pushManager.getSubscription() : null;
}

/** Lê sem pedir nada: a permissão só é pedida no clique da pessoa. */
export async function estadoDoPush(canais: CanaisDisponiveis | null): Promise<EstadoDoPush> {
  if (!pushSuportado() || !canais?.navegador) return "indisponivel";
  if (Notification.permission === "denied") return "bloqueado";
  return (await inscricaoAtual()) ? "ligado" : "desligado";
}

/** Pede a permissão, inscreve o navegador e entrega a inscrição ao backend. */
export async function ligarPush(chavePublica: string): Promise<EstadoDoPush> {
  const permissao = await Notification.requestPermission();
  if (permissao !== "granted") return permissao === "denied" ? "bloqueado" : "desligado";
  const registro = await navigator.serviceWorker.register(WORKER, { scope: "/" });
  await navigator.serviceWorker.ready;
  const inscricao =
    (await registro.pushManager.getSubscription()) ??
    (await registro.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytesDaChave(chavePublica) }));
  const json = inscricao.toJSON();
  const resposta = await fetch("/api/notificacoes/dispositivos", {
    method: "POST",
    body: JSON.stringify({ tipo: "navegador", endpoint: json.endpoint, chaves: json.keys }),
  });
  if (!resposta.ok) {
    await inscricao.unsubscribe();
    const corpo = (await resposta.json().catch(() => ({}))) as { message?: string };
    throw new Error(corpo.message || "Não foi possível ativar o aviso neste navegador.");
  }
  return "ligado";
}

/** Cancela a inscrição deste navegador. Usado também ao sair da conta, para o próximo usuário não receber. */
export async function desligarPush() {
  if (!pushSuportado()) return;
  const inscricao = await inscricaoAtual();
  if (!inscricao) return;
  await fetch("/api/notificacoes/dispositivos/remover", {
    method: "POST",
    body: JSON.stringify({ endpoint: inscricao.endpoint }),
  }).catch(() => undefined);
  await inscricao.unsubscribe();
}

/** A chave VAPID vem em base64url; o navegador quer os bytes. */
function bytesDaChave(base64url: string) {
  const base64 = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const bruto = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(bruto.length));
  for (let i = 0; i < bruto.length; i += 1) bytes[i] = bruto.charCodeAt(i);
  return bytes;
}
