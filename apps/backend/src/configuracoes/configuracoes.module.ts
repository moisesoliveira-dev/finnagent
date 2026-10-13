import { Module } from "@nestjs/common";
import { PersistenciaModule } from "../persistencia/persistencia.module.js";
import { GoogleOAuthHttp } from "./adaptadores/google-oauth-http.js";
import { PrismaConfiguracoesRepositorio } from "./adaptadores/prisma-configuracoes-repositorio.js";
import { ConfiguracoesService } from "./aplicacao/configuracoes.service.js";
import { ConfiguracoesController } from "./configuracoes.controller.js";
import { CONFIGURACOES_REPOSITORIO } from "./portas/configuracoes-repositorio.js";
import { GOOGLE_OAUTH } from "./portas/google-oauth.js";

@Module({
  imports: [PersistenciaModule],
  controllers: [ConfiguracoesController],
  exports: [CONFIGURACOES_REPOSITORIO],
  providers: [
    PrismaConfiguracoesRepositorio,
    GoogleOAuthHttp,
    { provide: CONFIGURACOES_REPOSITORIO, useExisting: PrismaConfiguracoesRepositorio },
    { provide: GOOGLE_OAUTH, useExisting: GoogleOAuthHttp },
    ConfiguracoesService,
  ],
})
export class ConfiguracoesModule {}
