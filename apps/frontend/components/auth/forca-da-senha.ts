import { SENHA_MINIMA } from "@finnagent/contracts";

export type ForcaDaSenha = { nivel: 0 | 1 | 2 | 3 | 4; rotulo: string };

/** Estimativa simples para orientar. Quem decide se a senha vale é o backend. */
export function forcaDaSenha(senha: string): ForcaDaSenha {
  if (!senha) return { nivel: 0, rotulo: "" };
  if (senha.length < SENHA_MINIMA) return { nivel: 1, rotulo: "Curta" };
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((regra) => regra.test(senha)).length;
  const variedade = new Set(senha).size;
  let pontos = 2;
  if (senha.length >= 14) pontos += 1;
  if (classes >= 3 && variedade >= 6) pontos += 1;
  if (variedade < 5) pontos = 2;
  if (pontos >= 4) return { nivel: 4, rotulo: "Forte" };
  if (pontos === 3) return { nivel: 3, rotulo: "Boa" };
  return { nivel: 2, rotulo: "Razoável" };
}
