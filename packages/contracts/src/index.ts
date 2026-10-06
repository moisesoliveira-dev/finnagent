export type TenantId = string;

export type Grupo = {
  id: string;
  name: string;
};

export type Sessao = {
  id: string;
  groupId: string;
  name: string;
  cents: number;
};

export type GruposResposta = {
  groups: Grupo[];
  sessions: Sessao[];
};