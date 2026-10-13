import { Injectable } from "@nestjs/common";
import type { LinhaExtrato, PedidoOrganizarExtrato } from "@finnagent/contracts";
import { z } from "zod";
import { AgenteIndisponivel, PedidoInvalido } from "../dominio/erros.js";
import type { OrganizadorDeExtrato } from "../portas/organizador-de-extrato.js";

const linha = z.object({
  line: z.number().int(),
  date: z.string().nullable(),
  description: z.string(),
  cents: z.number().int().nullable(),
  error: z.string(),
});

@Injectable()
export class HttpOrganizadorDeExtrato implements OrganizadorDeExtrato {
  async organizar(pedido: PedidoOrganizarExtrato): Promise<LinhaExtrato[]> {
    const base = process.env.AGENTS_URL;
    if (!base) throw new AgenteIndisponivel();
    let resposta: Response;
    try {
      resposta = await fetch(new URL("/extratos/organizar", base), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(pedido),
        signal: AbortSignal.timeout(120_000),
      });
    } catch {
      throw new AgenteIndisponivel();
    }
    if (resposta.status === 400) {
      const corpo = (await resposta.json().catch(() => null)) as { message?: string } | null;
      throw new PedidoInvalido(corpo?.message || "Envie uma imagem ou um PDF do extrato.");
    }
    if (!resposta.ok) throw new AgenteIndisponivel();
    const lido = z.object({ lines: z.array(linha) }).safeParse(await resposta.json());
    if (!lido.success) throw new AgenteIndisponivel();
    return lido.data.lines;
  }
}
