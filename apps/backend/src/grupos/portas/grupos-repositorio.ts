import type { GruposResposta, Grupo, Sessao, TipoSessao, ViradaResposta } from "@finnagent/contracts";

export const GRUPOS_REPOSITORIO = Symbol("GRUPOS_REPOSITORIO");

export type FalhaDeGrupo = "identificador" | "nome";
export type FalhaDeSessao = "identificador" | "nome" | "grupo-ausente";

export type DadosDaSessao = {
  groupId: string;
  name: string;
  description: string;
  justification: string;
  /** Acúmulo: o teto de saídas por mês. null tira o limite; ausente mantém o que está. */
  limitCents?: number | null;
};

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
    dados: DadosDaSessao,
    kind: TipoSessao,
    cents: number,
    startedAt: string,
  ): Promise<Sessao | FalhaDeSessao>;
  /** Com `kind`, troca o tipo da sessão. "tipo": a sessão tem lançamentos que o novo tipo não aceita. */
  atualizarSessao(
    tenantId: string,
    id: string,
    dados: DadosDaSessao,
    kind?: TipoSessao,
  ): Promise<Sessao | FalhaDeSessao | "ausente" | "tipo">;
  removerSessao(tenantId: string, id: string, endedAt: string): Promise<boolean>;
  /** A ordem dos grupos: todos os ids do tenant, na ordem nova. "diferente": a lista não é a dos grupos que existem. */
  reordenarGrupos(tenantId: string, ids: string[]): Promise<"ok" | "diferente">;
  /** A ordem das sessões de um grupo: todos os ids dele (ativas e encerradas), na ordem nova. */
  reordenarSessoes(tenantId: string, groupId: string, ids: string[]): Promise<"ok" | "diferente" | "grupo-ausente">;
  consultarVirada(tenantId: string): Promise<ViradaResposta>;
  permanecer(
    tenantId: string,
    year: number,
    groupIds: string[],
    sessionIds: string[],
  ): Promise<void>;
}
