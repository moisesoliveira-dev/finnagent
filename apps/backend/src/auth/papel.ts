import { SetMetadata } from "@nestjs/common";

export const SO_MASTER = "so-master";

/** A rota (ou o controller todo) exige o usuário master da conta. */
export const SoMaster = () => SetMetadata(SO_MASTER, true);
