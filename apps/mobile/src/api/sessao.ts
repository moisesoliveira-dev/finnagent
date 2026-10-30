import { SecureStorage } from "@aparajita/capacitor-secure-storage";
import type { UsuarioDaConta } from "@finnagent/contracts";

const CHAVE = "prumo.sessao";

export type SessaoGuardada = { token: string; expiresAt: string; user: UsuarioDaConta };

let atual: SessaoGuardada | null = null;
const ouvintes = new Set<() => void>();

function avisar() {
  for (const ouvinte of ouvintes) ouvinte();
}

/**
 * O token fica no Keychain (iOS) ou no Keystore (Android), cifrado pelo sistema. No navegador, em desenvolvimento,
 * o plugin usa o localStorage: só serve para testar.
 */
export async function carregarSessao() {
  try {
    const sessao = (await SecureStorage.get(CHAVE)) as SessaoGuardada | null;
    if (!sessao?.token || Date.parse(sessao.expiresAt) <= Date.now()) {
      if (sessao) await SecureStorage.remove(CHAVE);
      return null;
    }
    atual = sessao;
    return sessao;
  } catch {
    // Dado ilegível ou cofre indisponível: pede o login de novo em vez de travar o app.
    await SecureStorage.remove(CHAVE).catch(() => undefined);
    return null;
  }
}

export async function guardarSessao(sessao: SessaoGuardada) {
  atual = sessao;
  await SecureStorage.set(CHAVE, sessao);
  avisar();
}

/** O nome mudou no perfil: a sessão guardada leva o usuário novo, para a saudação e o perfil não ficarem velhos. */
export async function atualizarUsuario(usuario: UsuarioDaConta) {
  if (!atual) return;
  atual = { ...atual, user: usuario };
  await SecureStorage.set(CHAVE, atual).catch(() => undefined);
  avisar();
}

export async function encerrarSessao() {
  atual = null;
  await SecureStorage.remove(CHAVE).catch(() => undefined);
  avisar();
}

export const tokenAtual = () => atual?.token ?? "";
export const sessaoAtual = () => atual;

export function aoMudarASessao(ouvinte: () => void) {
  ouvintes.add(ouvinte);
  return () => void ouvintes.delete(ouvinte);
}
