import { Injectable } from "@nestjs/common";
import { ExtratosService } from "../../extratos/aplicacao/extratos.service.js";
import { FinancasService, MENSAGEM_DE_LANCAMENTO_SINCRONIZADO } from "../../financas/aplicacao/financas.service.js";
import { GruposService } from "../../grupos/aplicacao/grupos.service.js";
import { Conflito } from "../../grupos/dominio/erros.js";
import { MetasService } from "../../metas/aplicacao/metas.service.js";

/**
 * Apagar leva em conta o estado do resto. O que o extrato fez com o lançamento (criou, pagou, lembrou o nome) é
 * desfeito antes, como se a linha nunca tivesse sido lançada; só então o lançamento, a sessão ou o grupo saem.
 * Mora aqui, acima das fatias, porque cruza finanças, grupos, extratos e metas.
 */
@Injectable()
export class ExclusoesService {
  constructor(
    private readonly financas: FinancasService,
    private readonly grupos: GruposService,
    private readonly extratos: ExtratosService,
    private readonly metas: MetasService,
  ) {}

  async lancamento(tenantId: string, id: string) {
    await this.extratos.liberarLinhas(tenantId, { entryIds: [id] }, new Set([id]));
    await this.financas.excluir(tenantId, id);
  }

  async ocorrencia(tenantId: string, id: string, numero: number) {
    try {
      return await this.financas.excluirOcorrencia(tenantId, id, numero);
    } catch (error) {
      // Era a última ocorrência: o lançamento inteiro sai, e as linhas que apontam para ele são soltas antes.
      if (!(error instanceof Conflito) || error.message !== MENSAGEM_DE_LANCAMENTO_SINCRONIZADO) throw error;
      await this.extratos.liberarLinhas(tenantId, { entryIds: [id] }, new Set([id]));
      return this.financas.excluirOcorrencia(tenantId, id, numero);
    }
  }

  async sessao(tenantId: string, id: string) {
    await this.semMeta(tenantId, [id], "Essa sessão guarda a meta");
    await this.extratos.liberarLinhas(tenantId, { sessionId: id });
    await this.grupos.removerSessao(tenantId, id);
    await this.extratos.esquecerAssociacoesDaSessao(tenantId, id);
  }

  async grupo(tenantId: string, id: string) {
    const { sessions } = await this.grupos.listar(tenantId);
    const daqui = sessions.filter((sessao) => sessao.groupId === id).map((sessao) => sessao.id);
    await this.semMeta(tenantId, daqui, "Esse grupo tem a sessão da meta");
    await this.extratos.liberarLinhas(tenantId, { groupId: id });
    await this.grupos.removerGrupo(tenantId, id);
  }

  // A sessão de uma meta guarda o valor separado: apagar só ela deixaria a meta sem onde guardar.
  private async semMeta(tenantId: string, sessionIds: string[], inicio: string) {
    const meta = await this.metas.metaDasSessoes(tenantId, sessionIds);
    if (meta) throw new Conflito(`${inicio} "${meta.name}". Exclua a meta em Metas.`);
  }
}
