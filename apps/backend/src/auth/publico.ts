import { SetMetadata } from "@nestjs/common";

export const PUBLICO = "rota-publica";

/** Marca a rota como aberta. Todas as outras exigem sessão. */
export const Publico = () => SetMetadata(PUBLICO, true);
