import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  alinharUrlsDoBanco,
  bancoConfigurado,
  carregarEnv,
} from "../carregar-env.js";

carregarEnv();

function diretorioDoBackend(inicio: string) {
  let pasta = inicio;
  for (let nivel = 0; nivel < 8; nivel += 1) {
    if (existsSync(resolve(pasta, "prisma", "schema.prisma"))) return pasta;
    const acima = dirname(pasta);
    if (acima === pasta) break;
    pasta = acima;
  }
  return inicio;
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  readonly ativo: boolean;

  constructor() {
    carregarEnv();
    const configurado = bancoConfigurado();
    alinharUrlsDoBanco();
    if (!configurado) {
      process.env.DATABASE_URL = "postgresql://127.0.0.1:1/indisponivel";
      process.env.DIRECT_URL = process.env.DATABASE_URL;
    }
    super();
    this.ativo = configurado;
  }

  async onModuleInit() {
    if (!this.ativo) return;
    const pasta = diretorioDoBackend(import.meta.dirname);
    const cli = resolve(pasta, "node_modules", "prisma", "build", "index.js");
    try {
      execFileSync(process.execPath, [cli, "migrate", "deploy"], {
        cwd: pasta,
        stdio: "inherit",
        env: process.env,
      });
    } catch (error) {
      console.error("Não foi possível aplicar as migrations.", error);
    }
    await this.$connect();
  }

  async onModuleDestroy() {
    if (this.ativo) await this.$disconnect();
  }
}
