import { SENHA_MAXIMA, SENHA_MINIMA } from "@finnagent/contracts";
import { z } from "zod";

const COMUNS = new Set([
  "1234567890",
  "12345678910",
  "0123456789",
  "qwertyuiop",
  "senha12345",
  "password12",
  "password123",
  "senhasenha",
  "1q2w3e4r5t",
  "abc1234567",
  "prumo12345",
]);

const email = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .pipe(z.email());

const entrada = z.object({
  email,
  password: z.string().min(1).max(SENHA_MAXIMA),
});

const cadastro = z.object({
  name: z.string().trim().min(1).max(80),
  email,
  password: z.string().min(SENHA_MINIMA).max(SENHA_MAXIMA),
});

export type PedidoDeEntrada = z.infer<typeof entrada>;
export type PedidoDeCadastro = z.infer<typeof cadastro>;

export function interpretarEntrada(corpo: unknown): PedidoDeEntrada | string {
  const lido = entrada.safeParse(corpo);
  return lido.success ? lido.data : "Informe o e-mail e a senha.";
}

export function interpretarCadastro(corpo: unknown): PedidoDeCadastro | string {
  const lido = cadastro.safeParse(corpo);
  if (!lido.success) {
    const campos = new Set(lido.error.issues.map((item) => String(item.path[0])));
    if (campos.has("name")) return "Informe seu nome.";
    if (campos.has("email")) return "Informe um e-mail válido.";
    return `A senha precisa ter de ${SENHA_MINIMA} a ${SENHA_MAXIMA} caracteres.`;
  }
  const fraca = senhaFraca(lido.data.password, lido.data.email);
  return fraca ?? lido.data;
}

/** Motivo para recusar uma senha que cabe no tamanho mas é previsível. `null` se ela serve. */
export function senhaFraca(password: string, email: string): string | null {
  const minuscula = password.toLowerCase();
  if (minuscula === email || minuscula === email.split("@")[0]) {
    return "A senha não pode ser igual ao e-mail.";
  }
  if (COMUNS.has(minuscula) || new Set(password).size < 4) {
    return "Escolha uma senha menos previsível.";
  }
  return null;
}
