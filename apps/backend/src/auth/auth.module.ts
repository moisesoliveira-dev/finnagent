import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { PersistenciaModule } from "../persistencia/persistencia.module.js";
import { PrismaAuthRepositorio } from "./adaptadores/prisma-auth-repositorio.js";
import { AuthService } from "./aplicacao/auth.service.js";
import { AuthController } from "./auth.controller.js";
import { PerfilController } from "./perfil.controller.js";
import { UsuariosController } from "./usuarios.controller.js";
import { AUTH_REPOSITORIO } from "./portas/auth-repositorio.js";
import { SessaoGuard } from "./sessao.guard.js";

@Module({
  imports: [PersistenciaModule],
  controllers: [AuthController, PerfilController, UsuariosController],
  providers: [
    PrismaAuthRepositorio,
    { provide: AUTH_REPOSITORIO, useExisting: PrismaAuthRepositorio },
    AuthService,
    { provide: APP_GUARD, useClass: SessaoGuard },
  ],
})
export class AuthModule {}
