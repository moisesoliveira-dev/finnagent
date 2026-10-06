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
  ): Promise<Grupo | FalhaDeGrupo>;
  removerGrupo(tenantId: string, id: string): Promise<boolean>;
  criarSessao(
    tenantId: string,
    id: string,
    groupId: string,
    name: string,
    cents: number,
  ): Promise<Sessao | FalhaDeSessao>;
  removerSessao(tenantId: string, id: string): Promise<boolean>;
}
