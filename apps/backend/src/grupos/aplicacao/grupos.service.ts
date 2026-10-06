import { Inject, Injectable } from "@nestjs/common";
import type { Grupo, Sessao } from "@finnagent/contracts";
import { Conflito, NaoEncontrado } from "../dominio/erros.js";
import {
  GRUPOS_REPOSITORIO,
  type GruposRepositorio,
} from "../portas/grupos-repositorio.js";

@Injectable()
export class GruposService {
  constructor(
    @Inject(GRUPOS_REPOSITORIO) private readonly grupos: GruposRepositorio,
  ) {}

  listar(tenantId: string) {
    return this.grupos.listar(tenantId);
  }

  async criarGrupo(tenantId: string, id: string, name: string): Promise<Grupo> {
    const resultado = await this.grupos.criarGrupo(tenantId, id, name);
    if (resultado === "identificador") {
      throw new Conflito("Esse identificador já pertence a outro grupo.");
    }
    if (resultado === "nome") {
      throw new Conflito("Já existe um grupo com esse nome.");
    }
    return resultado;
  }

  async removerGrupo(tenantId: string, id: string) {
    const removido = await this.grupos.removerGrupo(tenantId, id);
    if (!removido) throw new NaoEncontrado("Grupo não encontrado.");
  }

  async criarSessao(
    tenantId: string,
    id: string,
    groupId: string,
    name: string,
    cents: number,
  ): Promise<Sessao> {
    const resultado = await this.grupos.criarSessao(
      tenantId,
      id,
      groupId,
      name,
      cents,
    );
    if (resultado === "identificador") {
      throw new Conflito("Esse identificador já pertence a outra sessão.");
    }
    if (resultado === "nome") {
      throw new Conflito("Esse grupo já tem uma sessão com esse nome.");
    }
    if (resultado === "grupo-ausente") {
      throw new NaoEncontrado("Crie um grupo antes da sessão.");
    }
    return resultado;
  }

  async removerSessao(tenantId: string, id: string) {
    const removido = await this.grupos.removerSessao(tenantId, id);
    if (!removido) throw new NaoEncontrado("Sessão não encontrada.");
  }
}
