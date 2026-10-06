import type { GruposResposta, Grupo, Sessao } from "@finnagent/contracts";

export const GRUPOS_REPOSITORIO = Symbol("GRUPOS_REPOSITORIO");

export type FalhaDeGrupo = "identificador" | "nome";
export type FalhaDeSessao = "identificador" | "nome" | "grupo-ausente";

export interface GruposRepositorio {
  listar(tenantId: string): Promise<GruposResposta>;
  criarGrupo(
    tenantId: string,
    id: string,
    name: string,
    description: string,
  ): Promise<Grupo | FalhaDeGrupo>;
  atualizarGrupo(
    tenantId: string,
    id: string,
    name: string,
    description: string,
  ): Promise<Grupo | FalhaDeGrupo | "ausente">;
  removerGrupo(tenantId: string, id: string): Promise<boolean>;
  criarSessao(
    tenantId: string,
    id: string,
    groupId: string,
    name: string,
    description: string,
    cents: number,
  ): Promise<Sessao | FalhaDeSessao>;
  atualizarSessao(
    tenantId: string,
    id: string,
    groupId: string,
    name: string,
    description: string,
  ): Promise<Sessao | FalhaDeSessao | "ausente">;
  removerSessao(tenantId: string, id: string): Promise<boolean>;
}
