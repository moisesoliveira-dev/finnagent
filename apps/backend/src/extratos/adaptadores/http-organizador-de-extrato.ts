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
    if (!resposta.ok) {
      const corpo = (await resposta.json().catch(() => null)) as { message?: string } | null;
      const mensagem = mensagemRecebida(corpo?.message);
      if (resposta.status === 400) throw new PedidoInvalido(mensagem);
      throw new AgenteIndisponivel(mensagem);
    }
    const lido = z.object({ lines: z.array(linha) }).safeParse(await resposta.json());
    if (!lido.success) throw new AgenteIndisponivel();
    return lido.data.lines;
  }
}

function mensagemRecebida(valor: unknown) {
  if (typeof valor !== "string") return "A leitura do extrato não está disponível.";
  const limpo = valor.replace(/sk-[A-Za-z0-9_-]+/g, "").trim().slice(0, 300);
  return limpo || "A leitura do extrato não está disponível.";
}
