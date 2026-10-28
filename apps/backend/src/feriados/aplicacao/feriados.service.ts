import { randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { LIMITE_FERIADOS_LOCAIS, criarCalendario, feriadosDoAno, type Feriado, type FeriadoLocal } from "@finnagent/contracts";
import { z } from "zod";
import { Conflito, NaoEncontrado, PedidoInvalido } from "../../grupos/dominio/erros.js";
import { FERIADOS_REPOSITORIO, type FeriadosRepositorio } from "../portas/feriados-repositorio.js";

// 29 de fevereiro vale: em ano não bissexto, o feriado cai no último dia do mês.
const DIAS_NO_MES = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

const pedido = z
  .object({
    nome: z.string().trim().min(1).max(60),
    dia: z.number().int().min(1).max(31),
    mes: z.number().int().min(1).max(12),
  })
  .refine((item) => item.dia <= DIAS_NO_MES[item.mes - 1], { message: "Esse dia não existe nesse mês.", path: ["dia"] });

@Injectable()
export class FeriadosService {
  constructor(@Inject(FERIADOS_REPOSITORIO) private readonly repositorio: FeriadosRepositorio) {}

  locais(tenantId: string) {
    return this.repositorio.listar(tenantId);
  }

  /** O calendário de dias úteis da conta: os nacionais mais os feriados locais cadastrados. */
  async calendario(tenantId: string) {
    return criarCalendario(await this.repositorio.listar(tenantId));
  }

  async doAno(tenantId: string, ano: number): Promise<{ feriados: Feriado[]; locais: FeriadoLocal[] }> {
    const locais = await this.repositorio.listar(tenantId);
    return { feriados: feriadosDoAno(ano, locais), locais };
  }

  async adicionar(tenantId: string, corpo: unknown) {
    const lido = pedido.safeParse(corpo);
    if (!lido.success) {
      const problema = lido.error.issues[0];
      if (problema?.path[0] === "nome") throw new PedidoInvalido("Dê um nome ao feriado.");
      throw new PedidoInvalido(problema?.message === "Esse dia não existe nesse mês." ? problema.message : "Informe o dia e o mês.");
    }
    const atuais = await this.repositorio.listar(tenantId);
    if (atuais.length >= LIMITE_FERIADOS_LOCAIS) {
      throw new PedidoInvalido(`Cadastre até ${LIMITE_FERIADOS_LOCAIS} feriados locais.`);
    }
    const criado = await this.repositorio.criar(tenantId, { id: randomUUID(), ...lido.data });
    if (criado === "repetido") throw new Conflito("Já existe um feriado nesse dia.");
    return criado;
  }

  async remover(tenantId: string, id: string) {
    if (!(await this.repositorio.remover(tenantId, id))) throw new NaoEncontrado("Feriado não encontrado.");
  }
}
