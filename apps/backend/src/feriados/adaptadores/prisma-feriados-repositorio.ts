import { Injectable } from "@nestjs/common";
import type { FeriadoLocal } from "@finnagent/contracts";
import type { Holiday } from "@prisma/client";
import { BancoIndisponivel } from "../../grupos/dominio/erros.js";
import { gravarOutbox, marcaDe } from "../../persistencia/gravar-outbox.js";
import { PrismaService } from "../../persistencia/prisma.service.js";
import type { FeriadosRepositorio } from "../portas/feriados-repositorio.js";

@Injectable()
export class PrismaFeriadosRepositorio implements FeriadosRepositorio {
  constructor(private readonly prisma: PrismaService) {}

  async listar(tenantId: string) {
    const linhas = await this.banco().holiday.findMany({ where: { tenantId }, orderBy: [{ month: "asc" }, { day: "asc" }] });
    return linhas.map(feriadoDe);
  }

  async criar(tenantId: string, feriado: FeriadoLocal) {
    return this.banco().$transaction(async (tx) => {
      const repetido = await tx.holiday.findFirst({ where: { tenantId, month: feriado.mes, day: feriado.dia } });
      if (repetido) return "repetido" as const;
      const criado = await tx.holiday.create({
        data: { id: feriado.id, tenantId, name: feriado.nome, day: feriado.dia, month: feriado.mes },
      });
      await gravarOutbox(tx, tenantId, "criar-feriado-local", feriado.id, feriado, marcaDe(feriado));
      return feriadoDe(criado);
    });
  }

  async remover(tenantId: string, id: string) {
    return this.banco().$transaction(async (tx) => {
      const apagados = await tx.holiday.deleteMany({ where: { id, tenantId } });
      if (apagados.count === 0) return false;
      await gravarOutbox(tx, tenantId, "remover-feriado-local", id, { id });
      return true;
    });
  }

  private banco() {
    if (!this.prisma.ativo) throw new BancoIndisponivel();
    return this.prisma;
  }
}

function feriadoDe(linha: Holiday): FeriadoLocal {
  return { id: linha.id, nome: linha.name, dia: linha.day, mes: linha.month };
}
