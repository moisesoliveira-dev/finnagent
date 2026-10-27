import { LIMITES_DO_PERFIL, SENHA_MAXIMA, SENHA_MINIMA, TONS_DO_AVATAR, type DadosDoPerfil } from "@finnagent/contracts";
import { z } from "zod";
import { senhaFraca } from "./pedido.js";

const texto = (limite: number) => z.string().trim().max(limite).default("");

const perfil = z.object({
  name: z.string().trim().min(1).max(LIMITES_DO_PERFIL.name),
  headline: texto(LIMITES_DO_PERFIL.headline),
  location: texto(LIMITES_DO_PERFIL.location),
  bio: texto(LIMITES_DO_PERFIL.bio),
  avatarTone: z.enum(TONS_DO_AVATAR),
});

const troca = z.object({
  currentPassword: z.string().min(1).max(SENHA_MAXIMA),
  newPassword: z.string().min(SENHA_MINIMA).max(SENHA_MAXIMA),
});

export type PedidoDeTroca = z.infer<typeof troca>;

export function interpretarPerfil(corpo: unknown): DadosDoPerfil | string {
  const lido = perfil.safeParse(corpo);
  if (lido.success) return lido.data;
  const campos = new Set(lido.error.issues.map((item) => String(item.path[0])));
  if (campos.has("name")) return "Informe seu nome.";
  if (campos.has("headline")) return `O cargo pode ter até ${LIMITES_DO_PERFIL.headline} caracteres.`;
  if (campos.has("location")) return `A cidade pode ter até ${LIMITES_DO_PERFIL.location} caracteres.`;
  if (campos.has("bio")) return `O texto sobre você pode ter até ${LIMITES_DO_PERFIL.bio} caracteres.`;
  return "Escolha uma das cores do avatar.";
}

export function interpretarTroca(corpo: unknown, email: string): PedidoDeTroca | string {
  const lido = troca.safeParse(corpo);
  if (!lido.success) {
    const campos = new Set(lido.error.issues.map((item) => String(item.path[0])));
    if (campos.has("currentPassword")) return "Informe a senha atual.";
    return `A nova senha precisa ter de ${SENHA_MINIMA} a ${SENHA_MAXIMA} caracteres.`;
  }
  if (lido.data.newPassword === lido.data.currentPassword) return "A nova senha precisa ser diferente da atual.";
  return senhaFraca(lido.data.newPassword, email) ?? lido.data;
}
