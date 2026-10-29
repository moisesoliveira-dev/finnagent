import { randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import {
  APROVAR_PLANO,
  CANCELAR_PLANO,
  ESQUEMA_PERGUNTAR,
  FERRAMENTA_PERGUNTAR,
  FERRAMENTA_PLANO,
  FERRAMENTAS_POR_NOME,
  FERRAMENTAS_QUE_CRIAM,
  temperaturaDa,
  type AcaoDoAssistente,
  type AgenteIa,
  type ChamadaDeFerramenta,
  type ComportamentoDoAssistente,
  type ConversaCompleta,
  type FatosDoPlano,
  type EspecialistaIa,
  type EventoDoChat,
  type EventoDoPasso,
  type MensagemDoChat,
  type MensagemDoModelo,
  type FuncaoDeModelo,
  type ModeloResolvido,
  type ParteDaMensagem,
  type ValorDoMes,
  type PedidoDeMensagem,
  type PerguntaDoAssistente,
} from "@finnagent/contracts";
import { log } from "../../log.js";
import { semOpcaoGenerica } from "../dominio/opcoes.js";
import { NaoEncontrado, PedidoInvalido } from "../../grupos/dominio/erros.js";
import {
  historicoParaOModelo,
  limiteDaRetencao,
  tituloDe,
} from "../dominio/conversa.js";
import { AssistenteIndisponivel, SemModelo } from "../dominio/erros.js";
import { fatosDoPlano, type CruzamentoMedido } from "../dominio/fatos-do-plano.js";
import { preparoDoCruzamento, valorContado } from "../../extratos/dominio/cruzar.js";
import { validarPlano, type PlanoValidado } from "../dominio/plano.js";
import { interpretarMensagem, interpretarTitulo } from "../dominio/pedido.js";
import { CONTEXTO_DO_ASSISTENTE, type Contexto, type ContextoDoAssistente } from "../portas/contexto-do-assistente.js";
import {
  CONVERSAS_REPOSITORIO,
  type ConversasRepositorio,
  type Pendencia,
} from "../portas/conversas-repositorio.js";
import { EXECUTOR_DE_FERRAMENTAS, type ExecutorDeFerramentas } from "../portas/executor-de-ferramentas.js";
import { MOTOR_DE_IA, type MotorDeIa } from "../portas/motor-de-ia.js";
import { REALIDADE_DA_CONTA, type RealidadeDaConta } from "../portas/realidade-da-conta.js";
import { IaService } from "./ia.service.js";

function linhasDoPasso(ferramenta: string, args: Record<string, unknown>) {
  if (ferramenta === "cruzar_linha" || ferramenta === "acumular_linha") {
    const linha = linhaDe(args);
    return linha ? [linha] : [];
  }
  if (ferramenta !== "acumular_linhas" || !Array.isArray(args.items)) return null;
  return args.items.flatMap((item) => {
    const linha = linhaDe(item);
    return linha ? [linha] : [];
  });
}

function linhaDe(valor: unknown) {
  if (!valor || typeof valor !== "object") return null;
  const item = valor as Record<string, unknown>;
  if (typeof item.statementId !== "string" || typeof item.line !== "number") return null;
  const valorMes: ValorDoMes | undefined = item.valor === "extrato" || item.valor === "lancamento" ? item.valor : undefined;
  return {
    statementId: item.statementId,
    line: item.line,
    entryId: typeof item.entryId === "string" ? item.entryId : "",
    valor: valorMes,
  };
}

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
  /** Turnos rodando agora, por conversa. Vive na memória: uma réplica por serviço. */
  private readonly emCurso = new Map<string, AbortController>();
  /** O texto que o turno já escreveu, para a tela mostrar ao voltar enquanto o processo segue vivo. */
  private readonly turnos = new Map<string, Turno>();

  constructor(
    @Inject(CONVERSAS_REPOSITORIO) private readonly conversas: ConversasRepositorio,
    @Inject(MOTOR_DE_IA) private readonly motor: MotorDeIa,
    @Inject(EXECUTOR_DE_FERRAMENTAS) private readonly executor: ExecutorDeFerramentas,
    @Inject(CONTEXTO_DO_ASSISTENTE) private readonly contexto: ContextoDoAssistente,
    private readonly ia: IaService,
    @Inject(REALIDADE_DA_CONTA) private readonly realidade: RealidadeDaConta,
  ) {}

  async listar(tenantId: string, userId: string) {
    const { comportamento } = await this.ia.modelos(tenantId);
    const limite = limiteDaRetencao(comportamento.retencao);
    if (limite) await this.conversas.limparAntigas(tenantId, limite);
    const lista = await this.conversas.listar(tenantId, userId);
    return lista.map((conversa) => ({ ...conversa, emAndamento: this.emCurso.has(conversa.id) }));
  }

  async obter(tenantId: string, userId: string, id: string): Promise<ConversaCompleta> {
    const conversa = await this.conversas.obter(tenantId, userId, id);
    if (!conversa) throw new NaoEncontrado("Conversa não encontrada.");
    const turno = this.turnos.get(id);
    const parcial = turno && turno.partes.length ? turno.mensagem() : null;
    const mensagens = parcial
      ? [...conversa.mensagens.filter((item) => item.id !== parcial.id), parcial]
      : conversa.mensagens;
    return { ...conversa.resumo, emAndamento: this.emCurso.has(id), mensagens };
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
  async conversar(quem: Quem, corpo: unknown, emitir: Emitir) {
    const pedido = interpretarMensagem(corpo);
    if (typeof pedido === "string") throw new PedidoInvalido(pedido);
    // O turno segue no servidor mesmo que a conexão da pessoa caia: só `parar` o interrompe.
    // Dois turnos juntos na mesma conversa repetiriam as ações, então o segundo espera.
    const parar = new AbortController();
    let chave = pedido.conversationId;
    if (chave) {
      if (this.emCurso.has(chave)) throw new PedidoInvalido("O assistente ainda está respondendo nesta conversa.");
      this.emCurso.set(chave, parar);
    }
    try {
      const { modelos, comportamento } = await this.ia.modelos(quem.tenantId);
      if (!modelos.coordenador) throw new SemModelo();
      const contexto = await this.contexto.obter(quem.tenantId, quem.userId);
      const { turno, resposta } = await this.abrirTurno(quem, pedido, emitir);
      if (!chave) {
        chave = turno.conversaId;
        this.emCurso.set(chave, parar);
      }
      this.turnos.set(turno.conversaId, turno);
      await this.rodar(turno, resposta, modelos, comportamento, contexto, quem, emitir, parar.signal);
    } finally {
      if (chave && this.emCurso.get(chave) === parar) this.emCurso.delete(chave);
      if (chave) this.turnos.delete(chave);
    }
  }

  /** Interrompe o turno que está rodando na conversa. Sem turno rodando, não faz nada. */
  async parar(tenantId: string, userId: string, id: string) {
    if (!(await this.conversas.obter(tenantId, userId, id))) throw new NaoEncontrado("Conversa não encontrada.");
    this.emCurso.get(id)?.abort();
  }

  private async rodar(
    turno: Turno,
    resposta: { aguardando: Pendencia["aguardando"]; escolha: string; restantes: ChamadaDeFerramenta[] } | null,
    modelos: Partial<Record<FuncaoDeModelo, ModeloResolvido>>,
    comportamento: ComportamentoDoAssistente,
    contexto: Contexto,
    quem: Quem,
    emitir: Emitir,
    sinal: AbortSignal,
  ) {
    const inicio = Date.now();
    let passos = 0;
    log.info({ conversa: turno.conversaId, tenant: quem.tenantId, retomada: resposta !== null }, "turno do assistente iniciado");
    try {
      if (resposta) await this.aplicarResposta(turno, resposta.aguardando, resposta.escolha, resposta.restantes, quem, contexto, comportamento);
      while (!turno.pendencia) {
        if (passos >= comportamento.maxPassos) {
          turno.novoPasso();
          turno.texto(AVISO_DE_LIMITE);
          break;
        }
        passos += 1;
        const terminou = await this.passo(turno, modelos, comportamento, contexto, quem, sinal);
        if (turno.partes.length) await this.conversas.gravarMensagem(quem.tenantId, turno.conversaId, turno.mensagem());
        if (terminou) break;
      }
    } catch (error) {
      if (sinal.aborted) {
        log.warn({ conversa: turno.conversaId, ms: Date.now() - inicio, passos }, "turno do assistente interrompido");
      } else {
        const mensagem = error instanceof Error ? error.message : "O assistente falhou.";
        log.error(
          { conversa: turno.conversaId, tenant: quem.tenantId, ms: Date.now() - inicio, passos, err: mensagem, causa: causaDe(error) },
          "turno do assistente falhou",
        );
        turno.novoPasso();
        turno.texto(`Não consegui terminar: ${mensagem}`);
        emitir({ tipo: "erro", message: mensagem });
      }
    } finally {
      await this.conversas.gravarMensagem(quem.tenantId, turno.conversaId, turno.mensagem());
      await this.conversas.definirPendencia(quem.tenantId, turno.conversaId, turno.pendencia);
      emitir({ tipo: "fim", mensagem: turno.mensagem() });
      log.info(
        { conversa: turno.conversaId, ms: Date.now() - inicio, passos, aguardando: turno.pendencia?.aguardando.tipo ?? null },
        "turno do assistente encerrado",
      );
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
    const inicioDoPasso = Date.now();
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
    log.info(
      {
        conversa: turno.conversaId,
        ms: Date.now() - inicioDoPasso,
        resultado: final.tipo,
        agente: "agente" in final ? final.agente : null,
        ferramentas: final.tipo === "chamadas" ? final.chamadas.map((item) => item.nome) : undefined,
      },
      "passo do agents",
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

    turno.transcricao.push({ role: "assistant", content: final.texto, agente: final.agente, toolCalls: final.chamadas });
    await this.processar(turno, final.chamadas, quem, contexto, comportamento);
    return false;
  }

  /**
   * As chamadas do modelo, na ordem. Consulta e pergunta rodam direto. O que muda o sistema só entra por um
   * plano: o modelo propõe, a pessoa aprova e o próprio sistema executa os passos. Uma ferramenta de escrita
   * chamada fora do plano é recusada, para o modelo não pular a aprovação.
   */
  private async processar(
    turno: Turno,
    chamadas: ChamadaDeFerramenta[],
    quem: Quem,
    contexto: Contexto,
    _comportamento: ComportamentoDoAssistente,
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
      if (chamada.nome === FERRAMENTA_PLANO) {
        const plano = validarPlano(chamada.args, randomUUID);
        if (typeof plano === "string") {
          log.warn({ conversa: turno.conversaId, motivo: plano }, "plano recusado");
          this.resultado(turno, chamada, `${plano} Nada foi mostrado à pessoa. Corrija e proponha de novo.`);
          continue;
        }
        const fatos = await this.medir(quem.tenantId, plano);
        if (typeof fatos === "string") {
          log.warn({ conversa: turno.conversaId, motivo: fatos }, "plano recusado");
          this.resultado(turno, chamada, `${fatos} Nada foi mostrado à pessoa. Corrija e proponha de novo.`);
          continue;
        }
        log.info(
          { conversa: turno.conversaId, passos: plano.passos.map((item) => item.ferramenta), alertas: fatos.alertas.length },
          "plano proposto",
        );
        this.pausar(
          turno,
          "plano",
          chamada,
          restantes,
          {
            id: chamada.id,
            tipo: "plano",
            texto: plano.objetivo,
            opcoes: [
              { rotulo: APROVAR_PLANO, descricao: "Faz agora todos os passos, na ordem." },
              { rotulo: CANCELAR_PLANO, descricao: "Não faz nada." },
            ],
            resposta: null,
            plano: {
              objetivo: plano.objetivo,
              entendimento: plano.entendimento,
              suposicoes: plano.suposicoes,
              passos: plano.passos.map((item) => ({ ferramenta: item.ferramenta, descricao: item.descricao, destrutiva: item.destrutiva })),
              fatos,
            },
          },
          plano,
        );
        return;
      }
      const ferramenta = FERRAMENTAS_POR_NOME.get(chamada.nome);
      if (!ferramenta) {
        this.resultado(turno, chamada, "Ferramenta desconhecida. Use só as ferramentas oferecidas.");
        continue;
      }
      if (!ferramenta.leitura) {
        log.info({ conversa: turno.conversaId, ferramenta: chamada.nome }, "escrita fora do plano recusada");
        this.resultado(
          turno,
          chamada,
          "Nada foi feito: esta ferramenta muda o sistema e só roda dentro de um plano aprovado. Chame propor_plano com este passo e os outros que o pedido precisa; o sistema mostra à pessoa e executa depois que ela aprovar.",
        );
        continue;
      }
      await this.executar(turno, chamada, quem, contexto);
    }
  }

  /** Os fatos do plano pelo próprio sistema. Recusa o plano quando uma linha do extrato foge da regra. */
  private async medir(tenantId: string, plano: PlanoValidado): Promise<FatosDoPlano | string> {
    try {
      const base = await this.realidade.base(tenantId);
      const cruzamentos = await this.cruzamentosDoPlano(tenantId, plano, base.entries);
      if (typeof cruzamentos === "string") return cruzamentos;
      return fatosDoPlano(plano.passos, base, cruzamentos);
    } catch (error) {
      log.warn({ err: error instanceof Error ? error.message : String(error) }, "não foi possível medir o plano");
      return { mes: null, passos: [], alertas: [] };
    }
  }

  private async cruzamentosDoPlano(
    tenantId: string,
    plano: PlanoValidado,
    entries: Awaited<ReturnType<RealidadeDaConta["base"]>>["entries"],
  ): Promise<CruzamentoMedido[] | string> {
    const medidos: CruzamentoMedido[] = [];
    for (const [indice, passo] of plano.passos.entries()) {
      const numero = indice + 1;
      const linhas = linhasDoPasso(passo.ferramenta, passo.args);
      if (!linhas) continue;
      for (const item of linhas) {
        const linha = await this.realidade.linhaDoExtrato(tenantId, item.statementId, item.line);
        if (!linha) return `Passo ${numero}: a linha ${item.line} do extrato não foi encontrada.`;
        if (linha.entryId) return `Passo ${numero}: a linha ${item.line} já foi cruzada.`;
        if (passo.ferramenta === "cruzar_linha") {
          const entry = entries.find((atual) => atual.id === item.entryId);
          if (!entry) return `Passo ${numero}: o lançamento não está na conta.`;
          const planejado = valorContado(entry, linha.date);
          if (planejado === null) return `Passo ${numero}: esse lançamento não tem ocorrência livre neste mês.`;
          const preparo = preparoDoCruzamento(entry.category, planejado, linha.cents, item.valor);
          if (typeof preparo === "string") return `Passo ${numero}: ${preparo}`;
          medidos.push({
            passo: numero,
            data: linha.date,
            escolhido: preparo.cents,
            planejado,
            entryId: entry.id,
            nome: entry.name || linha.description,
            nota: preparo.nota,
          });
          continue;
        }
        medidos.push({
          passo: numero,
          data: linha.date,
          escolhido: linha.cents,
          planejado: null,
          entryId: null,
          nome: linha.description,
          nota: "Única nova, no valor do extrato.",
        });
      }
    }
    return medidos;
  }

  /** Executa o plano aprovado, passo a passo. Para no primeiro que falha; os seguintes ficam como não feitos. */
  private async executarPlano(turno: Turno, origem: ChamadaDeFerramenta, plano: PlanoValidado, quem: Quem, contexto: Contexto) {
    const relato: string[] = [];
    let falhou = 0;
    for (const [indice, passo] of plano.passos.entries()) {
      const numero = indice + 1;
      const chamada: ChamadaDeFerramenta = {
        id: `${origem.id}:${numero}`,
        nome: passo.ferramenta,
        args: passo.args,
        idGerado: passo.idGerado,
      };
      const rotulo = passo.descricao;
      if (falhou) {
        turno.acao({ id: chamada.id, ferramenta: passo.ferramenta, rotulo, estado: "cancelada", detalhe: `Não feito: o passo ${falhou} falhou.` });
        relato.push(`Passo ${numero} (${passo.ferramenta}): não executado.`);
        continue;
      }
      turno.acao({ id: chamada.id, ferramenta: passo.ferramenta, rotulo, estado: "executando", detalhe: "" });
      const inicio = Date.now();
      const resultado = await this.executor.executar(chamada, { token: quem.token, fuso: contexto.fuso });
      const dados = { conversa: turno.conversaId, passo: numero, ferramenta: passo.ferramenta, ms: Date.now() - inicio };
      if (resultado.ok) log.info(dados, "passo do plano executado");
      else log.warn({ ...dados, detalhe: resultado.detalhe }, "passo do plano falhou");
      turno.acao({
        id: chamada.id,
        ferramenta: passo.ferramenta,
        rotulo,
        estado: resultado.ok ? "feita" : "falhou",
        detalhe: resultado.ok ? "" : resultado.detalhe,
      });
      if (resultado.ok) {
        relato.push(`Passo ${numero} (${passo.ferramenta}): feito${FERRAMENTAS_QUE_CRIAM.has(passo.ferramenta) ? `, id ${passo.idGerado}` : ""}.`);
      } else {
        falhou = numero;
        relato.push(`Passo ${numero} (${passo.ferramenta}): falhou. ${resultado.conteudo}`);
      }
    }
    const cabeca = falhou
      ? `A pessoa aprovou o plano, mas o passo ${falhou} falhou e os seguintes não foram feitos. Explique o que faltou e, se der para corrigir, proponha um plano novo só com o que falta.`
      : "A pessoa aprovou o plano e todos os passos foram feitos.";
    return `${cabeca}\n${relato.join("\n")}\nConfira o mês com consultar_mes_financeiro e diga em até três frases o que foi feito, o que você supôs e o efeito no mês.`;
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
    if (aguardando.tipo === "plano") {
      if (escolha === APROVAR_PLANO && aguardando.plano) {
        this.resultado(turno, aguardando.chamada, await this.executarPlano(turno, aguardando.chamada, aguardando.plano, quem, contexto));
      } else if (escolha === CANCELAR_PLANO) {
        this.resultado(turno, aguardando.chamada, "A pessoa não aprovou o plano e nada foi feito. Não faça isso sem um novo pedido.");
      } else {
        this.resultado(
          turno,
          aguardando.chamada,
          `A pessoa pediu um ajuste no plano: "${escolha}". Nada foi feito. Refaça o plano com o ajuste e proponha de novo com propor_plano.`,
        );
      }
    } else if (aguardando.tipo === "pergunta") {
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
    tipo: "pergunta" | "confirmacao" | "plano",
    chamada: ChamadaDeFerramenta,
    restantes: ChamadaDeFerramenta[],
    pergunta: PerguntaDoAssistente,
    plano?: PlanoValidado,
  ) {
    turno.pergunta(pergunta);
    turno.pendencia = {
      usuarioId: turno.usuarioId,
      mensagemId: turno.mensagemId,
      agente: turno.agente,
      agenteAtivo: turno.agenteAtivo,
      turno: turno.transcricao,
      partes: turno.partes,
      aguardando: plano ? { tipo, chamada, plano } : { tipo, chamada },
      restantes,
    };
  }

  private async executar(turno: Turno, chamada: ChamadaDeFerramenta, quem: Quem, contexto: Contexto) {
    const ferramenta = FERRAMENTAS_POR_NOME.get(chamada.nome);
    const rotulo = rotuloDa(ferramenta?.rotulo, chamada);
    turno.acao({ id: chamada.id, ferramenta: chamada.nome, rotulo, estado: "executando", detalhe: "" });
    const inicio = Date.now();
    const resultado = await this.executor.executar(chamada, { token: quem.token, fuso: contexto.fuso });
    const dados = { conversa: turno.conversaId, ferramenta: chamada.nome, ms: Date.now() - inicio };
    if (resultado.ok) log.info(dados, "ferramenta executada");
    else log.warn({ ...dados, detalhe: resultado.detalhe }, "ferramenta falhou");
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

/** A causa de baixo de um erro de fetch (timeout, conexão recusada), que a mensagem sozinha esconde. */
function causaDe(error: unknown) {
  const causa = error instanceof Error ? (error as { cause?: unknown }).cause : undefined;
  if (causa instanceof Error) return causa.message;
  return typeof causa === "string" ? causa : undefined;
}

/** O rótulo vem do catálogo; se os argumentos vierem tortos, fica o nome da ferramenta. */
function rotuloDa(rotulo: ((args: Record<string, unknown>) => string) | undefined, chamada: ChamadaDeFerramenta) {
  try {
    return rotulo?.(chamada.args) || chamada.nome;
  } catch {
    return chamada.nome;
  }
}
