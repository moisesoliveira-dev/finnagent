export const GOOGLE_OAUTH = Symbol("GOOGLE_OAUTH");

export type TrocaCodigo = {
  clientId: string;
  clientSecret: string;
  code: string;
  redirectUri: string;
};

export type CredenciaisGoogle = {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
};

export type AgendaRemota = {
  id: string;
  name: string;
  primary: boolean;
};

export class FalhaOAuth extends Error {
  constructor() {
    super("Não foi possível falar com o Google Calendar.");
  }
}

export interface GoogleOAuth {
  trocarCodigo(pedido: TrocaCodigo): Promise<{ accessToken: string; refreshToken: string }>;
  accessToken(pedido: CredenciaisGoogle): Promise<string>;
  agendas(accessToken: string): Promise<AgendaRemota[]>;
}
