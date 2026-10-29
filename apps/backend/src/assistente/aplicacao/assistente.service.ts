import { randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import {
  ESQUEMA_PERGUNTAR,
  FERRAMENTA_PERGUNTAR,
  FERRAMENTAS_POR_NOME,
  temperaturaDa,
  type AcaoDoAssistente,
  type AgenteIa,
  type ChamadaDeFerramenta,
  type ComportamentoDoAssistente,
  type ConversaCompleta,
  type EspecialistaIa,
  type EventoDoChat,
  type EventoDoPasso,
  type MensagemDoChat,
  type MensagemDoModelo,
  type FuncaoDeModelo,
  type ModeloResolvido,
  type ParteDaMensagem,
  type PedidoDeMensagem,
  type PerguntaDoAssistente,
} from "@finnagent/contracts";
import { semOpcaoGenerica } from "../dominio/opcoes.js";
import { NaoEncontrado, PedidoInvalido } from "../../grupos/dominio/erros.js";
import {
  historicoParaOModelo,
  limiteDaRetencao,
  perguntaDeConfirmacao,
  tituloDe,
} from "../dominio/conversa.js";
import { AssistenteIndisponivel, SemModelo } from "../dominio/erros.js";
import { interpretarMensagem, interpretarTitulo } from "../dominio/pedido.js";
import { CONTEXTO_DO_ASSISTENTE, type Contexto, type ContextoDoAssistente } from "../portas/contexto-do-assistente.js";
import {
  CONVERSAS_REPOSITORIO,
  type ConversasRepositorio,
  type Pendencia,
} from "../portas/conversas-repositorio.js";
import { EXECUTOR_DE_FERRAMENTAS, type ExecutorDeFerramentas } from "../portas/executor-de-ferramentas.js";
import { MOTOR_DE_IA, type MotorDeIa } from "../portas/motor-de-ia.js";
import { IaService } from "./ia.service.js";

export type Emitir = (evento: EventoDoChat) => void;

export type Quem = { tenantId: string; userId: string; token: string };

const AVISO_DE_LIMITE = "Parei aqui para não fazer coisas demais de uma vez. Diga se devo continuar.";

/** O turno em andamento: o que a tela vê (partes) e o que o modelo vê (transcrição). */
class Turno {
  agente: AgenteIa | null;
  agenteAtivo: EspecialistaIa | null;
  pendencia: Pendencia | null = null;
  private blocoNovo = false;

  constructor(
    readonly conversaId: string,
    readonly usuarioId: string,
    readonly mensagemId: string,
    readonly createdAt: string,
    readonly historico: MensagemDoModelo[],
    readonly transcricao: MensagemDoModelo[],
    readonly partes: ParteDaMensagem[],
    agente: AgenteIa | null,
    agenteAtivo: EspecialistaIa | null,
    private readonly emitir: Emitir,
  ) {
    this.agente = agente;
    this.agenteAtivo = agenteAtivo;
  }

  novoPasso() {
    this.blocoNovo = true;
  }

  texto(delta: string) {
    const ultima = this.partes[this.partes.length - 1];
    let pedaco = delta;
    if (this.blocoNovo && ultima?.tipo === "texto" && ultima.texto.trim()) pedaco = `\n\n${delta}`;
    this.blocoNovo = false;
    if (ultima?.tipo === "texto") ultima.texto += pedaco;
    else this.partes.push({ tipo: "texto", texto: pedaco });
    this.emitir({ tipo: "texto", delta: pedaco });
  }

  trocarDeAgente(agente: AgenteIa) {
    this.emitir({ tipo: "agente", agente });
    if (agente === "coordenador" || agente === this.agente) return;
    this.agente = agente;
    this.partes.push({ tipo: "agente", agente });
  }

  acao(acao: AcaoDoAssistente) {
    const existente = this.partes.find((parte) => parte.tipo === "acao" && parte.acao.id === acao.id);
    if (existente && existente.tipo === "acao") existente.acao = acao;
    else this.partes.push({ tipo: "acao", acao });
    this.emitir({ tipo: "acao", acao });
  }

  pergunta(pergunta: PerguntaDoAssistente) {
    this.partes.push({ tipo: "pergunta", pergunta });
    this.emitir({ tipo: "pergunta", pergunta });
  }

  responder(perguntaId: string, escolha: string) {
    for (const parte of this.partes) {
      if (parte.tipo === "pergunta" && parte.pergunta.id === perguntaId) parte.pergunta = { ...parte.pergunta, resposta: escolha };
    }
    this.emitir({ tipo: "resposta", perguntaId, escolha });
  }

  mensagem(): MensagemDoChat {
    return { id: this.mensagemId, role: "assistant", partes: this.partes, agente: this.agente, createdAt: this.createdAt };
  }
}

@Injectable()
export class AssistenteService {
  constructor(
    @Inject(CONVERSAS_REPOSITORIO) private readonly conversas: ConversasRepositorio,
    @Inject(MOTOR_DE_IA) private readonly motor: MotorDeIa,
    @Inject(EXECUTOR_DE_FERRAMENTAS) private readonly executor: ExecutorDeFerramentas,
    @Inject(CONTEXTO_DO_ASSISTENTE) private readonly contexto: ContextoDoAssistente,
    private readonly ia: IaService,
  ) {}

  async listar(tenantId: string, userId: string) {
    const { comportamento } = await this.ia.modelos(tenantId);
    const limite = limiteDaRetencao(comportamento.retencao);
    if (limite) await this.conversas.limparAntigas(tenantId, limite);
    return this.conversas.listar(tenantId, userId);
  }

  async obter(tenantId: string, userId: string, id: string): Promise<ConversaCompleta> {
    const conversa = await this.conversas.obter(tenantId, userId, id);
    if (!conversa) throw new NaoEncontrado("Conversa não encontrada.");
    return { ...conversa.resumo, mensagens: conversa.mensagens };
  }

  async renomear(tenantId: string, userId: string, id: string, corpo: unknown) {
    const titulo = interpretarTitulo(corpo);
    if (titulo.startsWith("Dê um título")) throw new PedidoInvalido(titulo);
    const resumo = await this.conversas.renomear(tenantId, userId, id, titulo);
    if (!resumo) throw new NaoEncontrado("Conversa não encontrada.");
    return resumo;
  }

  async remover(tenantId: string, userId: string, id: string) {
    if (!(await this.conversas.remover(tenantId, userId, id))) throw new NaoEncontrado("Conversa não encontrada.");
  }

  removerTodas(tenantId: string, userId: string) {
    return this.conversas.removerTodas(tenantId, userId);
  }

  /**
   * Um turno de conversa. Erros antes do primeiro evento (pedido inválido, sem modelo, conversa de outro)
   * saem como exceção, para virar status HTTP; depois disso, saem como evento de erro.
   */
  async conversar(quem: Quem, corpo: unknown, emitir: Emitir, sinal: AbortSignal) {
    const pedido = interpretarMensagem(corpo);
    if (typeof pedido === "string") throw new PedidoInvalido(pedido);
    const { modelos, comportamento } = await this.ia.modelos(quem.tenantId);
    if (!modelos.coordenador) throw new SemModelo();
    const contexto = await this.contexto.obter(quem.tenantId, quem.userId);
    const { turno, resposta } = await this.abrirTurno(quem, pedido, emitir);

    try {
      if (resposta) await this.aplicarResposta(turno, resposta.aguardando, resposta.escolha, resposta.restantes, quem, contexto, comportamento);
      let passos = 0;
      while (!turno.pendencia) {
        if (passos >= comportamento.maxPassos) {
          turno.novoPasso();
          turno.texto(AVISO_DE_LIMITE);
          break;
        }
        passos += 1;
        const terminou = await this.passo(turno, modelos, comportamento, contexto, quem, sinal);
        if (terminou) break;
      }
    } catch (error) {
      if (!sinal.aborted) {
        const mensagem = error instanceof Error ? error.message : "O assistente falhou.";
        turno.novoPasso();
        turno.texto(`Não consegui terminar: ${mensagem}`);
        emitir({ tipo: "erro", message: mensagem });
      }
    } finally {
      await this.conversas.gravarMensagem(quem.tenantId, turno.conversaId, turno.mensagem());
      await this.conversas.definirPendencia(quem.tenantId, turno.conversaId, turno.pendencia);
      emitir({ tipo: "fim", mensagem: turno.mensagem() });
    }
  }

  private async abrirTurno(quem: Quem, pedido: PedidoDeMensagem, emitir: Emitir) {
    let conversa = pedido.conversationId ? await this.conversas.obter(quem.tenantId, quem.userId, pedido.conversationId) : null;
    if (pedido.conversationId && !conversa) throw new NaoEncontrado("Conversa não encontrada.");

    if (pedido.resposta) {
      const pendencia = conversa?.pendencia;
      if (!conversa || !pendencia || pendencia.aguardando.chamada.id !== pedido.resposta.perguntaId) {
        throw new PedidoInvalido("Essa pergunta já foi respondida.");
      }
      const anteriores = conversa.mensagens.filter((item) => item.id !== pendencia.usuarioId && item.id !== pendencia.mensagemId);
      const original = conversa.mensagens.find((item) => item.id === pendencia.mensagemId);
      const turno = new Turno(
        conversa.resumo.id,
        pendencia.usuarioId,
        pendencia.mensagemId,
        original?.createdAt ?? new Date().toISOString(),
        historicoParaOModelo(anteriores),
        pendencia.turno,
        pendencia.partes,
        pendencia.agente,
        pendencia.agenteAtivo,
        emitir,
      );
      emitir({ tipo: "inicio", usuario: null, assistenteId: turno.mensagemId });
      return {
        turno,
        resposta: { aguardando: pendencia.aguardando, escolha: pedido.resposta.escolha, restantes: pendencia.restantes },
      };
    }

    const texto = pedido.texto ?? "";
    if (!conversa) {
      const resumo = await this.conversas.criar(quem.tenantId, quem.userId, randomUUID(), tituloDe(texto));
      emitir({ tipo: "conversa", conversa: resumo });
      conversa = { resumo, pendencia: null, mensagens: [] };
    } else if (conversa.pendencia) {
      await this.encerrarPendencia(quem.tenantId, conversa.resumo.id, conversa.pendencia, conversa.mensagens);
    }
    const agora = new Date().toISOString();
    const usuario: MensagemDoChat = {
      id: randomUUID(),
      role: "user",
      partes: [{ tipo: "texto", texto }],
      agente: null,
      createdAt: agora,
    };
    await this.conversas.gravarMensagem(quem.tenantId, conversa.resumo.id, usuario);
    const turno = new Turno(
      conversa.resumo.id,
      usuario.id,
      randomUUID(),
      new Date(Date.now() + 1).toISOString(),
      historicoParaOModelo(conversa.mensagens),
      [{ role: "user", content: texto }],
      [],
      null,
      null,
      emitir,
    );
    emitir({ tipo: "inicio", usuario, assistenteId: turno.mensagemId });
    return { turno, resposta: null };
  }

  /** A pessoa escreveu outra coisa em vez de responder: a pergunta fica sem resposta e o turno fecha. */
  private async encerrarPendencia(tenantId: string, conversaId: string, pendencia: Pendencia, mensagens: MensagemDoChat[]) {
    const mensagem = mensagens.find((item) => item.id === pendencia.mensagemId);
    if (mensagem) {
      const partes = mensagem.partes.map((parte) =>
        parte.tipo === "pergunta" && parte.pergunta.resposta === null
          ? { ...parte, pergunta: { ...parte.pergunta, resposta: "Sem resposta" } }
          : parte,
      );
      await this.conversas.gravarMensagem(tenantId, conversaId, { ...mensagem, partes });
    }
    await this.conversas.definirPendencia(tenantId, conversaId, null);
  }

  /** Um passo do agents. Devolve true quando o turno acabou. */
  private async passo(
    turno: Turno,
    modelos: Partial<Record<FuncaoDeModelo, ModeloResolvido>>,
    comportamento: ComportamentoDoAssistente,
    contexto: Contexto,
    quem: Quem,
    sinal: AbortSignal,
  ) {
    turno.novoPasso();
    const { leitor: _leitor, ...dosAgentes } = modelos;
    const final: EventoDoPasso = await this.motor.passo(
      {
        modelos: dosAgentes,
        temperatura: temperaturaDa(comportamento.criatividade),
        instrucoes: comportamento.instrucoes,
        contexto,
        mensagens: [...turno.historico, ...turno.transcricao],
        agenteAtivo: turno.agenteAtivo,
      },
      (evento) => {
        if (evento.tipo === "texto") turno.texto(evento.delta);
        if (evento.tipo === "agente") turno.trocarDeAgente(evento.agente);
      },
      sinal,
    );
    if (final.tipo === "erro") throw new AssistenteIndisponivel(final.message);
    if (final.tipo === "agente" || final.tipo === "texto") return false;
    for (const nota of final.notas) turno.transcricao.push({ role: "assistant", content: nota, agente: null });

    if (final.tipo === "resposta") {
      if (!turno.agente) turno.agente = final.agente;
      if (!turno.partes.some((parte) => parte.tipo === "texto") && !final.texto.trim()) turno.texto("Pronto.");
      turno.transcricao.push({ role: "assistant", content: final.texto, agente: final.agente });
      return true;
    }

    turno.agenteAtivo = final.agente;
    turno.transcricao.push({ role: "assistant", content: final.texto, agente: final.agente, toolCalls: final.chamadas });
    await this.processar(turno, final.chamadas, quem, contexto, comportamento);
    return false;
  }

  /** Executa as chamadas na ordem; para na primeira pergunta ou confirmação e guarda o resto. */
  private async processar(
    turno: Turno,
    chamadas: ChamadaDeFerramenta[],
    quem: Quem,
    contexto: Contexto,
    comportamento: ComportamentoDoAssistente,
  ) {
    for (const [indice, chamada] of chamadas.entries()) {
      const restantes = chamadas.slice(indice + 1);
      if (chamada.nome === FERRAMENTA_PERGUNTAR) {
        const lido = ESQUEMA_PERGUNTAR.safeParse(chamada.args);
        const opcoes = lido.success ? semOpcaoGenerica(lido.data.opcoes) : [];
        if (!lido.success || opcoes.length < 2) {
          this.resultado(turno, chamada, "Pergunta inválida: mande a pergunta e de 2 a 6 opções concretas, sem botão \"Outra resposta\": a tela já tem esse campo.");
          continue;
        }
        this.pausar(turno, "pergunta", chamada, restantes, {
          id: chamada.id,
          tipo: "pergunta",
          texto: lido.data.pergunta,
          opcoes,
          resposta: null,
        });
        return;
      }
      const ferramenta = FERRAMENTAS_POR_NOME.get(chamada.nome);
      if (!ferramenta) {
        this.resultado(turno, chamada, "Ferramenta desconhecida. Use só as ferramentas oferecidas.");
        continue;
      }
      if (turno.agenteAtivo && !ferramenta.agentes.includes(turno.agenteAtivo)) {
        this.resultado(turno, chamada, "Essa ferramenta não é deste especialista. Use encaminhar.");
        continue;
      }
      if (ferramenta.destrutiva && comportamento.confirmarExclusao) {
        const args = ferramenta.esquema.safeParse(chamada.args);
        if (!args.success) {
          await this.executar(turno, chamada, quem, contexto);
          continue;
        }
        this.pausar(turno, "confirmacao", chamada, restantes, perguntaDeConfirmacao(ferramenta, args.data, chamada.id));
        return;
      }
      await this.executar(turno, chamada, quem, contexto);
    }
  }

  private async aplicarResposta(
    turno: Turno,
    aguardando: Pendencia["aguardando"],
    escolha: string,
    restantes: ChamadaDeFerramenta[],
    quem: Quem,
    contexto: Contexto,
    comportamento: ComportamentoDoAssistente,
  ) {
    turno.responder(aguardando.chamada.id, escolha);
    if (aguardando.tipo === "pergunta") {
      this.resultado(turno, aguardando.chamada, `A pessoa respondeu: ${escolha}`);
    } else if (escolha === "Confirmar") {
      await this.executar(turno, aguardando.chamada, quem, contexto);
    } else {
      const ferramenta = FERRAMENTAS_POR_NOME.get(aguardando.chamada.nome);
      turno.acao({
        id: aguardando.chamada.id,
        ferramenta: aguardando.chamada.nome,
        rotulo: rotuloDa(ferramenta?.rotulo, aguardando.chamada),
        estado: "cancelada",
        detalhe: "Você não confirmou.",
      });
      const complemento = escolha === "Cancelar" ? "" : ` e respondeu: ${escolha}`;
      this.resultado(turno, aguardando.chamada, `A pessoa não confirmou${complemento}. Não faça isso sem um novo pedido.`);
    }
    await this.processar(turno, restantes, quem, contexto, comportamento);
  }

  private pausar(
    turno: Turno,
    tipo: "pergunta" | "confirmacao",
    chamada: ChamadaDeFerramenta,
    restantes: ChamadaDeFerramenta[],
    pergunta: PerguntaDoAssistente,
  ) {
    turno.pergunta(pergunta);
    turno.pendencia = {
      usuarioId: turno.usuarioId,
      mensagemId: turno.mensagemId,
      agente: turno.agente,
      agenteAtivo: turno.agenteAtivo,
      turno: turno.transcricao,
      partes: turno.partes,
      aguardando: { tipo, chamada },
      restantes,
    };
  }

  private async executar(turno: Turno, chamada: ChamadaDeFerramenta, quem: Quem, contexto: Contexto) {
    const ferramenta = FERRAMENTAS_POR_NOME.get(chamada.nome);
    const rotulo = rotuloDa(ferramenta?.rotulo, chamada);
    turno.acao({ id: chamada.id, ferramenta: chamada.nome, rotulo, estado: "executando", detalhe: "" });
    const resultado = await this.executor.executar(chamada, { token: quem.token, fuso: contexto.fuso });
    turno.acao({
      id: chamada.id,
      ferramenta: chamada.nome,
      rotulo,
      estado: resultado.ok ? "feita" : "falhou",
      detalhe: resultado.ok ? "" : resultado.detalhe,
    });
    this.resultado(turno, chamada, resultado.conteudo);
  }

  private resultado(turno: Turno, chamada: ChamadaDeFerramenta, conteudo: string) {
    turno.transcricao.push({ role: "tool", toolCallId: chamada.id, nome: chamada.nome, content: conteudo, agente: turno.agenteAtivo });
  }
}

/** O rótulo vem do catálogo; se os argumentos vierem tortos, fica o nome da ferramenta. */
function rotuloDa(rotulo: ((args: Record<string, unknown>) => string) | undefined, chamada: ChamadaDeFerramenta) {
  try {
    return rotulo?.(chamada.args) || chamada.nome;
  } catch {
    return chamada.nome;
  }
}
