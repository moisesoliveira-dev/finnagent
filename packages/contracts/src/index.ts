export type TenantId = string;

export type Grupo = {
  id: string;
  name: string;
  description: string;
};

export type Sessao = {
  id: string;
  groupId: string;
  name: string;
  description: string;
  cents: number;
};

export type GruposResposta = {
  groups: Grupo[];
  sessions: Sessao[];
};