import { Injectable } from "@nestjs/common";
import { ClienteGoogle, FalhaGoogle } from "../../agenda/adaptadores/cliente-google.js";
import { FalhaOAuth, type CredenciaisGoogle, type GoogleOAuth, type TrocaCodigo } from "../portas/google-oauth.js";

@Injectable()
export class GoogleOAuthHttp implements GoogleOAuth {
  private readonly cliente = new ClienteGoogle();

  trocarCodigo(pedido: TrocaCodigo) {
    return this.traduzir(() => this.cliente.trocarCodigo(pedido));
  }

  accessToken(pedido: CredenciaisGoogle) {
    return this.traduzir(() => this.cliente.accessToken(pedido));
  }

  agendas(accessToken: string) {
    return this.traduzir(() => this.cliente.agendas(accessToken));
  }

  private async traduzir<T>(chamada: () => Promise<T>) {
    try {
      return await chamada();
    } catch (error) {
      if (error instanceof FalhaGoogle) throw new FalhaOAuth();
      throw error;
    }
  }
}
