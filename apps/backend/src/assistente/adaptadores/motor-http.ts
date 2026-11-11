import { Injectable } from "@nestjs/common";
import type { EventoDoPasso, PedidoDePasso, PedidoDeTesteDoProvedor, ResultadoDoTeste } from "@finnagent/contracts";
import { log } from "../../log.js";
import { AssistenteIndisponivel, ConexaoComOAgentsCaiu, SemConexaoComOAgents } from "../dominio/erros.js";
import type { MotorDeIa } from "../portas/motor-de-ia.js";

/**
 * Quanto se espera antes de cada nova tentativa quando a conexão com o agents cai antes de qualquer resposta: o
 * serviço pode estar reiniciando. São duas tentativas a mais, no máximo.
 */
const ESPERAS_ENTRE_TENTATIVAS_MS = [3_000, 8_000];

/** Cliente do agents. O passo vem em NDJSON: uma linha JSON por evento, enquanto o modelo escreve. */
@Injectable()
export class MotorHttp implements MotorDeIa {
  /** Só os testes trocam. */
  esperas = ESPERAS_ENTRE_TENTATIVAS_MS;

  /**
   * Um passo, com nova tentativa quando a conexão cai antes de o agents dizer qualquer coisa. Repetir é seguro: o
   * passo só pede as ferramentas, que o backend executa depois. Se algo já saiu para a pessoa (o texto começou), não
   * repete, para não duplicar o que ela viu.
   */
  async passo(pedido: PedidoDePasso, aoEvento: (evento: EventoDoPasso) => void, sinal: AbortSignal) {
    let repassou = false;
    const repassar = (evento: EventoDoPasso) => {
      repassou = true;
      aoEvento(evento);
    };
    for (let tentativa = 0; ; tentativa++) {
      try {
        return await this.umPasso(pedido, repassar, sinal);
      } catch (error) {
        if (sinal.aborted) throw error;
        const caiu = error instanceof SemConexaoComOAgents || error instanceof ConexaoComOAgentsCaiu;
        const espera = this.esperas[tentativa];
        if (!caiu || repassou || espera === undefined) throw error;
        log.warn({ tentativa: tentativa + 1, esperaMs: espera, motivo: error.message }, "a conexão com o agents caiu antes da resposta: tentando de novo");
        await new Promise((resolver) => setTimeout(resolver, espera));
        if (sinal.aborted) throw error;
      }
    }
  }

  private async umPasso(pedido: PedidoDePasso, aoEvento: (evento: EventoDoPasso) => void, sinal: AbortSignal) {
    const resposta = await this.chamar("/assistente/passo", pedido, sinal);
    if (!resposta.ok || !resposta.body) {
      const corpo = (await resposta.json().catch(() => null)) as { message?: string } | null;
      log.error({ status: resposta.status, resposta: corpo?.message }, "o agents recusou o passo");
      throw new AssistenteIndisponivel(corpo?.message);
    }
    let final: EventoDoPasso | null = null;
    const leitor = resposta.body.pipeThrough(new TextDecoderStream()).getReader();
    let resto = "";
    for (;;) {
      let lido: ReadableStreamReadResult<string>;
      try {
        lido = await leitor.read();
      } catch (error) {
        if (sinal.aborted) throw error;
        // "terminated" é o que o fetch diz quando a conexão cai no meio da resposta (o agents reiniciou, por exemplo).
        log.warn(
          { err: error instanceof Error ? error.message : String(error), causa: (error as { cause?: { message?: string } }).cause?.message },
          "a conexão com o agents caiu no meio do passo",
        );
        throw new ConexaoComOAgentsCaiu();
      }
      const { value, done } = lido;
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
    if (!final) log.error("o agents fechou a resposta sem o evento final");
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
      log.error(
        { caminho, err: error instanceof Error ? error.message : String(error), causa: (error as { cause?: { message?: string } }).cause?.message },
        "não foi possível falar com o agents",
      );
      // A conexão foi aberta e caiu (o agents reiniciou) ou nem abriu (parado): a mensagem para a pessoa é diferente.
      const causa = (error as { cause?: { message?: string; code?: string } }).cause;
      const caiu = causa?.code === "UND_ERR_SOCKET" || causa?.code === "ECONNRESET" || /other side closed|socket hang up/i.test(causa?.message ?? "");
      throw caiu ? new ConexaoComOAgentsCaiu() : new SemConexaoComOAgents();
    }
  }
}
