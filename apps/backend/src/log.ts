import pino from "pino";

// Um JSON por linha na saída padrão: é o que o Railway guarda e deixa filtrar. O nível vem de LOG_LEVEL.
export const log = pino({ level: process.env.LOG_LEVEL || "info" });
