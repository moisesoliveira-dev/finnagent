import { Inject, Injectable } from "@nestjs/common";
import { PedidoInvalido } from "../../grupos/dominio/erros.js";
import {
  APLICATIVO,
  VERSAO_DO_PACOTE,
  interpretarPacote,
  renovarIdentificadores,
  resumoDe,
  type ResumoDaImportacao,
} from "../dominio/pacote.js";
import { DADOS_REPOSITORIO, type DadosRepositorio } from "../portas/dados-repositorio.js";

@Injectable()
export class DadosService {
  constructor(@Inject(DADOS_REPOSITORIO) private readonly dados: DadosRepositorio) {}

  async exportar(tenantId: string) {
    return {
      app: APLICATIVO,
      version: VERSAO_DO_PACOTE,
      exportedAt: new Date().toISOString(),
      data: await this.dados.exportar(tenantId),
    };
  }

  async importar(tenantId: string, corpo: unknown): Promise<ResumoDaImportacao> {
    const pacote = interpretarPacote(corpo);
    if (typeof pacote === "string") throw new PedidoInvalido(pacote);
    const dados = renovarIdentificadores(pacote.data);
    const resumo = resumoDe(dados);
    await this.dados.importar(tenantId, dados, resumo);
    return resumo;
  }

  async zerar(tenantId: string) {
    await this.dados.zerar(tenantId);
    return { zerado: true as const };
  }
}
