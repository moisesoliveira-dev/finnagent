import { config } from "dotenv";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";

export function carregarEnv(inicio = import.meta.dirname) {
  let pasta = inicio;
  for (let nivel = 0; nivel < 8; nivel += 1) {
    if (existsSync(resolve(pasta, "pnpm-workspace.yaml"))) {
      config({ path: resolve(pasta, ".env") });
      return;
    }
    const acima = dirname(pasta);
    if (acima === pasta) break;
    pasta = acima;
  }
}

export function alinharUrlsDoBanco() {
  const direta = process.env.DIRECT_URL;
  const pooled = process.env.DATABASE_URL;
  if (!process.env.DATABASE_URL && direta) process.env.DATABASE_URL = direta;
  if (!process.env.DIRECT_URL && pooled) process.env.DIRECT_URL = pooled;
}

export function bancoConfigurado() {
  return Boolean(process.env.DIRECT_URL || process.env.DATABASE_URL);
}
