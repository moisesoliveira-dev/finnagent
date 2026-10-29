import type { NextFunction, Request, Response } from "express";
import { log } from "./log.js";

/**
 * Uma linha por pedido, quando ele termina: método, rota, status e quanto levou. Sem query e sem corpo, para
 * não gravar token nem dado da pessoa. 5xx sai como erro; 4xx, como aviso. Se a conexão cair antes do fim,
 * a linha diz que o pedido foi abandonado.
 */
export function registrarPedidos(req: Request, res: Response, next: NextFunction) {
  const inicio = Date.now();
  const rota = req.originalUrl.split("?")[0];
  res.on("close", () => {
    const dados = { metodo: req.method, rota, status: res.statusCode, ms: Date.now() - inicio };
    if (!res.writableFinished) log.warn({ ...dados, abandonado: true }, "pedido abandonado antes do fim");
    else if (res.statusCode >= 500) log.error(dados, "pedido falhou");
    else if (res.statusCode >= 400) log.warn(dados, "pedido recusado");
    else log.info(dados, "pedido");
  });
  next();
}
