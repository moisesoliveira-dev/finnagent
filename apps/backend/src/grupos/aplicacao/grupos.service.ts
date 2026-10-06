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

  async criarGrupo(
    tenantId: string,
    id: string,
    name: string,
    description: string,
  ): Promise<Grupo> {
    const resultado = await this.grupos.criarGrupo(tenantId, id, name, description);
    if (resultado === "identificador") {
      throw new Conflito("Esse identificador já pertence a outro grupo.");
    }
    if (resultado === "nome") {
      throw new Conflito("Já existe um grupo com esse nome.");
    }
    return resultado;
  }

  async atualizarGrupo(
    tenantId: string,
    id: string,
    name: string,
    description: string,
  ): Promise<Grupo> {
    const resultado = await this.grupos.atualizarGrupo(tenantId, id, name, description);
    if (resultado === "ausente") throw new NaoEncontrado("Grupo não encontrado.");
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
    description: string,
    cents: number,
  ): Promise<Sessao> {
    const resultado = await this.grupos.criarSessao(
      tenantId,
      id,
      groupId,
      name,
      description,
      cents,
    );
    if (resultado === "identificador") {
      throw new Conflito("Esse identificador já pertence a outra sessão.");
    }
    if (resultado === "nome") {
      throw new Conflito("Esse grupo já tem uma sessão com esse nome.");
    }
    if (resultado === "grupo-ausente") {
      throw new NaoEncontrado("Grupo não encontrado.");
    }
    return resultado;
  }

  async atualizarSessao(
    tenantId: string,
    id: string,
    groupId: string,
    name: string,
    description: string,
  ): Promise<Sessao> {
    const resultado = await this.grupos.atualizarSessao(
      tenantId,
      id,
      groupId,
      name,
      description,
    );
    if (resultado === "ausente") throw new NaoEncontrado("Sessão não encontrada.");
    if (resultado === "identificador") {
      throw new Conflito("Esse identificador já pertence a outra sessão.");
    }
    if (resultado === "nome") {
      throw new Conflito("Esse grupo já tem uma sessão com esse nome.");
    }
    if (resultado === "grupo-ausente") {
      throw new NaoEncontrado("Grupo não encontrado.");
    }
    return resultado;
  }

  async removerSessao(tenantId: string, id: string) {
    const removido = await this.grupos.removerSessao(tenantId, id);
    if (!removido) throw new NaoEncontrado("Sessão não encontrada.");
  }
}
