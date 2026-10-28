import { Injectable } from "@nestjs/common";
import type { EventoDoPasso, PedidoDePasso, PedidoDeTesteDoProvedor, ResultadoDoTeste } from "@finnagent/contracts";
import { AssistenteIndisponivel } from "../dominio/erros.js";
import type { MotorDeIa } from "../portas/motor-de-ia.js";

/** Cliente do agents. O passo vem em NDJSON: uma linha JSON por evento, enquanto o modelo escreve. */
@Injectable()
export class MotorHttp implements MotorDeIa {
  async passo(pedido: PedidoDePasso, aoEvento: (evento: EventoDoPasso) => void, sinal: AbortSignal) {
    const resposta = await this.chamar("/assistente/passo", pedido, sinal);
    if (!resposta.ok || !resposta.body) {
      const corpo = (await resposta.json().catch(() => null)) as { message?: string } | null;
      throw new AssistenteIndisponivel(corpo?.message);
    }
    let final: EventoDoPasso | null = null;
    const leitor = resposta.body.pipeThrough(new TextDecoderStream()).getReader();
    let resto = "";
    for (;;) {
      const { value, done } = await leitor.read();
      if (done) break;
      resto += value;
      const linhas = resto.split("\n");
      resto = linhas.pop() ?? "";
      for (const linha of linhas) {
        if (!linha.trim()) continue;
        const evento = JSON.parse(linha) as EventoDoPasso;
        if (evento.tipo === "texto" || evento.tipo === "agente") aoEvento(evento);
        else final = evento;
      }
    }
    if (resto.trim()) final = JSON.parse(resto) as EventoDoPasso;
    return final ?? { tipo: "erro", message: "O assistente parou no meio da resposta." };
  }

  async testar(pedido: PedidoDeTesteDoProvedor): Promise<ResultadoDoTeste> {
    const resposta = await this.chamar("/provedores/testar", pedido, AbortSignal.timeout(30_000));
    const corpo = (await resposta.json().catch(() => null)) as ResultadoDoTeste | { message?: string } | null;
    if (resposta.ok && corpo && "ok" in corpo) return corpo;
    return { ok: false, models: [], message: (corpo as { message?: string } | null)?.message ?? "Não foi possível testar.", ms: 0 };
  }

  private async chamar(caminho: string, corpo: unknown, sinal: AbortSignal) {
    const base = process.env.AGENTS_URL;
    if (!base) throw new AssistenteIndisponivel();
    try {
      return await fetch(new URL(caminho, base), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(corpo),
        signal: sinal,
      });
    } catch (error) {
      if (sinal.aborted) throw error;
      throw new AssistenteIndisponivel();
    }
  }
}
