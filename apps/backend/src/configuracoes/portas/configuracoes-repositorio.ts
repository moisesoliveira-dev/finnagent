import type { Preferencias } from "@finnagent/contracts";

export const CONFIGURACOES_REPOSITORIO = Symbol("CONFIGURACOES_REPOSITORIO");

export type DataDoWorkflow = {
  year: number;
  month: number;
  day: number;
};

export type ConfiguracaoGravada = Preferencias & {
  googleSecretConfigured: boolean;
  googleConnected: boolean;
  googleAccount: string;
  aiKeyConfigured: boolean;
};

export type Segredos = {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  oauthState: string;
  aiApiKey: string;
  aiModel: string;
};

export interface ConfiguracoesRepositorio {
  obter(tenantId: string): Promise<ConfiguracaoGravada>;
  salvar(tenantId: string, preferencias: Preferencias, data: DataDoWorkflow): Promise<ConfiguracaoGravada>;
  segredos(tenantId: string): Promise<Segredos | null>;
  guardarEstado(tenantId: string, state: string): Promise<void>;
  concluirConexao(tenantId: string, refreshToken: string, account: string): Promise<void>;
  desconectar(tenantId: string): Promise<void>;
}
