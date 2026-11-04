import { Inject, Injectable } from "@nestjs/common";
import { CONVERSAS_REPOSITORIO, type ConversasRepositorio } from "../portas/conversas-repositorio.js";

/** O que as outras fatias (a importação de extrato) podem pedir do chat: o arquivo que a pessoa anexou. */
@Injectable()
export class AnexosService {
  constructor(@Inject(CONVERSAS_REPOSITORIO) private readonly conversas: ConversasRepositorio) {}

  obter(tenantId: string, id: string) {
    return this.conversas.obterAnexo(tenantId, id);
  }
}
