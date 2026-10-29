import {
  COMPORTAMENTO_PADRAO,
  type ChamadaDeFerramenta,
  type ComportamentoDoAssistente,
  type ConversaResumo,
  type EventoDoChat,
  type EventoDoPasso,
  type MensagemDoChat,
  type PedidoDePasso,
} from "@finnagent/contracts";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NaoEncontrado, PedidoInvalido } from "../../grupos/dominio/erros.js";
import { SemModelo } from "../dominio/erros.js";
import type { ContextoDoAssistente } from "../portas/contexto-do-assistente.js";
import type { ConversaGravada, ConversasRepositorio, Pendencia } from "../portas/conversas-repositorio.js";
import type { Credencial, ExecutorDeFerramentas, ResultadoDaExecucao } from "../portas/executor-de-ferramentas.js";
import type { MotorDeIa } from "../portas/motor-de-ia.js";
import { AssistenteService } from "./assistente.service.js";
import type { IaService } from "./ia.service.js";

class Conversas implements ConversasRepositorio {
  dados = new Map<string, { tenantId: string; userId: string; resumo: ConversaResumo; pendencia: Pendencia | null; mensagens: MensagemDoChat[] }>();

  async listar(tenantId: string, userId: string) {
    return [...this.dados.values()].filter((item) => item.tenantId === tenantId && item.userId === userId).map((item) => item.resumo);
  }
  async obter(tenantId: string, userId: string, id: string): Promise<ConversaGravada | null> {
    const item = this.dados.get(id);
    if (!item || item.tenantId !== tenantId || item.userId !== userId) return null;
    return structuredClone({ resumo: { ...item.resumo, pendente: item.pendencia !== null }, pendencia: item.pendencia, mensagens: item.mensagens });
  }
  async criar(tenantId: string, userId: string, id: string, title: string) {
    const resumo = { id, title, updatedAt: new Date().toISOString(), pendente: false };
    this.dados.set(id, { tenantId, userId, resumo, pendencia: null, mensagens: [] });
    return resumo;
  }
  async gravarMensagem(_tenantId: string, conversationId: string, mensagem: MensagemDoChat) {
    const item = this.dados.get(conversationId)!;
    const copia = structuredClone(mensagem);
    const indice = item.mensagens.findIndex((atual) => atual.id === mensagem.id);
    if (indice >= 0) item.mensagens[indice] = copia;
    else item.mensagens.push(copia);
  }
  async definirPendencia(_tenantId: string, conversationId: string, pendencia: Pendencia | null) {
    this.dados.get(conversationId)!.pendencia = structuredClone(pendencia);
  }
  async renomear() {
    return null;
  }
  async remover() {
    return false;
  }
  async removerTodas() {
    return 0;
  }
  async limparAntigas() {
    return 0;
  }
}

/** Motor de roteiro: cada passo devolve o próximo da lista e guarda o pedido recebido. */
class Motor implements MotorDeIa {
  pedidos: PedidoDePasso[] = [];
  constructor(private readonly passos: Array<{ textos?: string[]; agente?: string; final: EventoDoPasso }>) {}
  async passo(pedido: PedidoDePasso, aoEvento: (evento: EventoDoPasso) => void) {
    this.pedidos.push(structuredClone(pedido));
    const passo = this.passos.shift();
    if (!passo) return { tipo: "resposta", agente: "coordenador", texto: "fim", notas: [] } as EventoDoPasso;
    if (passo.agente) aoEvento({ tipo: "agente", agente: passo.agente as never });
    for (const delta of passo.textos ?? []) aoEvento({ tipo: "texto", delta });
    return passo.final;
  }
  async testar() {
    return { ok: true, models: [], message: "", ms: 0 };
  }
}

/** Motor que espera até mandarem parar, como um modelo lento. */
class MotorParado extends Motor {
  async passo(pedido: PedidoDePasso, aoEvento: (evento: EventoDoPasso) => void, sinal?: AbortSignal) {
    await new Promise<void>((resolve) => sinal?.addEventListener("abort", () => resolve()));
    return super.passo(pedido, aoEvento);
  }
}

class Executor implements ExecutorDeFerramentas {
  chamadas: Array<{ chamada: ChamadaDeFerramenta; credencial: Credencial }> = [];
  constructor(private readonly resposta: ResultadoDaExecucao = { ok: true, conteudo: '{"ok":true}', detalhe: "" }) {}
  async executar(chamada: ChamadaDeFerramenta, credencial: Credencial) {
    this.chamadas.push({ chamada, credencial });
    return this.resposta;
  }
}

const contexto: ContextoDoAssistente = {
  obter: async () => ({ hoje: "2026-10-28 (quarta-feira)", usuario: "Ana", fuso: "America/Sao_Paulo" }),
};

const modelo = { kind: "openai" as const, apiKey: "k", baseUrl: "", model: "m" };

function ia(comportamento: Partial<ComportamentoDoAssistente> = {}, semModelo = false) {
  return {
    modelos: async () => ({
      modelos: semModelo ? {} : { coordenador: modelo, metas: modelo, financas: modelo },
      comportamento: { ...COMPORTAMENTO_PADRAO, ...comportamento },
    }),
  } as unknown as IaService;
}

const quem = { tenantId: "t1", userId: "u1", token: "token-da-ana" };

const chamadas = (agente: string, lista: ChamadaDeFerramenta[], texto = ""): EventoDoPasso =>
  ({ tipo: "chamadas", agente, texto, chamadas: lista, notas: [] }) as EventoDoPasso;
const resposta = (agente: string, texto: string): EventoDoPasso => ({ tipo: "resposta", agente, texto, notas: [] }) as EventoDoPasso;

const excluirMeta = { id: "c-apagar", nome: "excluir_meta", args: { id: "6b0ad7c9-1d51-4d34-9d0b-5a3a1f0a9a01", resumo: "a meta Viagem" } };

describe("orquestrador do assistente", () => {
  let conversas: Conversas;
  let eventos: EventoDoChat[];
  const emitir = (evento: EventoDoChat) => eventos.push(structuredClone(evento));

  beforeEach(() => {
    conversas = new Conversas();
    eventos = [];
  });

  function servico(motor: MotorDeIa, executor: ExecutorDeFerramentas = new Executor(), config = ia()) {
    return new AssistenteService(conversas, motor, executor, contexto, config);
  }

  function ultimaMensagem() {
    const conversa = [...conversas.dados.values()][0];
    return conversa.mensagens[conversa.mensagens.length - 1];
  }

  it("responde em streaming e guarda a conversa, a mensagem da pessoa e a do assistente", async () => {
    const motor = new Motor([{ agente: "coordenador", textos: ["Oi, ", "Ana!"], final: resposta("coordenador", "Oi, Ana!") }]);
    await servico(motor).conversar(quem, { texto: "oi" }, emitir);
    expect(eventos.map((evento) => evento.tipo)).toEqual(["conversa", "inicio", "agente", "texto", "texto", "fim"]);
    const conversa = [...conversas.dados.values()][0];
    expect(conversa.resumo.title).toBe("oi");
    expect(conversa.mensagens.map((item) => item.role)).toEqual(["user", "assistant"]);
    expect(ultimaMensagem().partes).toEqual([{ tipo: "texto", texto: "Oi, Ana!" }]);
    expect(motor.pedidos[0].contexto.usuario).toBe("Ana");
    expect(motor.pedidos[0]).not.toHaveProperty("modelos.leitor");
  });

  it("executa a ferramenta com o token de quem conversa e devolve o resultado ao modelo", async () => {
    const executor = new Executor();
    const motor = new Motor([
      { agente: "metas", final: chamadas("metas", [{ id: "c1", nome: "criar_meta", args: { name: "Viagem", targetCents: 500000 } }]) },
      { textos: ["Criei a meta."], final: resposta("metas", "Criei a meta.") },
    ]);
    await servico(motor, executor).conversar(quem, { texto: "crie a meta viagem de 5 mil" }, emitir);
    expect(executor.chamadas).toEqual([
      { chamada: { id: "c1", nome: "criar_meta", args: { name: "Viagem", targetCents: 500000 } }, credencial: { token: "token-da-ana", fuso: "America/Sao_Paulo" } },
    ]);
    expect(motor.pedidos[1].agenteAtivo).toBe("metas");
    expect(motor.pedidos[1].mensagens.at(-1)).toMatchObject({ role: "tool", toolCallId: "c1", content: '{"ok":true}' });
    const acoes = eventos.filter((evento) => evento.tipo === "acao").map((evento) => evento.tipo === "acao" && evento.acao.estado);
    expect(acoes).toEqual(["executando", "feita"]);
    expect(ultimaMensagem().partes.map((parte) => parte.tipo)).toEqual(["agente", "acao", "texto"]);
  });

  it("pede confirmação antes de apagar e só apaga depois do Confirmar", async () => {
    const executor = new Executor();
    const motor = new Motor([
      { agente: "metas", final: chamadas("metas", [excluirMeta]) },
      { textos: ["Apaguei a meta Viagem."], final: resposta("metas", "Apaguei a meta Viagem.") },
    ]);
    const assistente = servico(motor, executor);
    await assistente.conversar(quem, { texto: "apague a meta viagem" }, emitir);
    expect(executor.chamadas).toHaveLength(0);
    const pergunta = eventos.find((evento) => evento.tipo === "pergunta");
    expect(pergunta).toMatchObject({ pergunta: { id: "c-apagar", tipo: "confirmacao", texto: "Apagar a meta Viagem?" } });
    const conversa = [...conversas.dados.values()][0];
    expect(conversa.pendencia?.aguardando.chamada.nome).toBe("excluir_meta");

    eventos = [];
    await assistente.conversar(quem, { conversationId: conversa.resumo.id, resposta: { perguntaId: "c-apagar", escolha: "Confirmar" } }, emitir);
    expect(executor.chamadas.map((item) => item.chamada.nome)).toEqual(["excluir_meta"]);
    expect(conversas.dados.get(conversa.resumo.id)?.pendencia).toBeNull();
    const mensagem = ultimaMensagem();
    expect(conversas.dados.get(conversa.resumo.id)?.mensagens).toHaveLength(2);
    const parte = mensagem.partes.find((item) => item.tipo === "pergunta");
    expect(parte?.tipo === "pergunta" && parte.pergunta.resposta).toBe("Confirmar");
    expect(mensagem.partes.some((item) => item.tipo === "acao" && item.acao.estado === "feita")).toBe(true);
  });

  it("não apaga quando a pessoa cancela, e avisa o modelo para não insistir", async () => {
    const executor = new Executor();
    const motor = new Motor([
      { agente: "metas", final: chamadas("metas", [excluirMeta]) },
      { final: resposta("metas", "Tudo bem, não apaguei.") },
    ]);
    const assistente = servico(motor, executor);
    await assistente.conversar(quem, { texto: "apague a meta" }, emitir);
    const id = [...conversas.dados.keys()][0];
    await assistente.conversar(quem, { conversationId: id, resposta: { perguntaId: "c-apagar", escolha: "Cancelar" } }, emitir);
    expect(executor.chamadas).toHaveLength(0);
    expect(motor.pedidos[1].mensagens.at(-1)).toMatchObject({ role: "tool", content: expect.stringContaining("não confirmou") });
    expect(ultimaMensagem().partes.some((item) => item.tipo === "acao" && item.acao.estado === "cancelada")).toBe(true);
  });

  it("apaga direto quando o comportamento dispensa a confirmação", async () => {
    const executor = new Executor();
    const motor = new Motor([{ final: chamadas("metas", [excluirMeta]) }, { final: resposta("metas", "Apaguei.") }]);
    await servico(motor, executor, ia({ confirmarExclusao: false })).conversar(quem, { texto: "apague" }, emitir);
    expect(executor.chamadas.map((item) => item.chamada.nome)).toEqual(["excluir_meta"]);
  });

  it("faz a pergunta com opções e devolve a escolha como resultado", async () => {
    const perguntar = { id: "p1", nome: "perguntar", args: { pergunta: "Em qual sessão?", opcoes: [{ rotulo: "Casa" }, { rotulo: "Lazer" }] } };
    const motor = new Motor([{ final: chamadas("financas", [perguntar]) }, { final: resposta("financas", "Lancei em Lazer.") }]);
    const assistente = servico(motor);
    await assistente.conversar(quem, { texto: "lance 50 de cinema" }, emitir);
    expect(eventos.find((evento) => evento.tipo === "pergunta")).toMatchObject({
      pergunta: { tipo: "pergunta", texto: "Em qual sessão?", opcoes: [{ rotulo: "Casa" }, { rotulo: "Lazer" }] },
    });
    const id = [...conversas.dados.keys()][0];
    await assistente.conversar(quem, { conversationId: id, resposta: { perguntaId: "p1", escolha: "Lazer" } }, emitir);
    expect(motor.pedidos[1].mensagens.at(-1)).toMatchObject({ role: "tool", toolCallId: "p1", content: "A pessoa respondeu: Lazer" });
  });

  it("encerra a pergunta sem resposta quando a pessoa escreve outra coisa", async () => {
    const perguntar = { id: "p1", nome: "perguntar", args: { pergunta: "Qual?", opcoes: [{ rotulo: "A" }, { rotulo: "B" }] } };
    const motor = new Motor([{ final: chamadas("financas", [perguntar]) }, { final: resposta("coordenador", "Certo.") }]);
    const assistente = servico(motor);
    await assistente.conversar(quem, { texto: "lance algo" }, emitir);
    const id = [...conversas.dados.keys()][0];
    await assistente.conversar(quem, { conversationId: id, texto: "deixa pra lá" }, emitir);
    const conversa = conversas.dados.get(id)!;
    expect(conversa.pendencia).toBeNull();
    const antiga = conversa.mensagens[1].partes.find((item) => item.tipo === "pergunta");
    expect(antiga?.tipo === "pergunta" && antiga.pergunta.resposta).toBe("Sem resposta");
    expect(motor.pedidos[1].mensagens.some((item) => item.role === "tool")).toBe(false);
  });

  it("não executa ferramenta de outro especialista nem ferramenta fora do catálogo", async () => {
    const executor = new Executor();
    const motor = new Motor([
      {
        final: chamadas("metas", [
          { id: "x1", nome: "criar_lancamento", args: {} },
          { id: "x2", nome: "salvar_configuracoes", args: {} },
          { id: "x3", nome: "alterar_senha", args: {} },
        ]),
      },
      { final: resposta("metas", "Não posso.") },
    ]);
    await servico(motor, executor).conversar(quem, { texto: "mude minha senha" }, emitir);
    expect(executor.chamadas).toHaveLength(0);
    const resultados = motor.pedidos[1].mensagens.filter((item) => item.role === "tool").map((item) => item.content);
    expect(resultados[0]).toContain("não é deste especialista");
    expect(resultados[1]).toContain("Ferramenta desconhecida");
    expect(resultados[2]).toContain("Ferramenta desconhecida");
  });

  it("para no limite de passos por mensagem", async () => {
    const executor = new Executor();
    const ler = () => ({ final: chamadas("metas", [{ id: crypto.randomUUID(), nome: "consultar_metas", args: {} }]) });
    const motor = new Motor([ler(), ler(), ler(), ler(), ler(), ler()]);
    await servico(motor, executor, ia({ maxPassos: 4 })).conversar(quem, { texto: "fique lendo" }, emitir);
    expect(motor.pedidos).toHaveLength(4);
    const texto = ultimaMensagem().partes.filter((parte) => parte.tipo === "texto").map((parte) => parte.tipo === "texto" && parte.texto).join("");
    expect(texto).toContain("Parei aqui para não fazer coisas demais");
  });

  it("transforma erro do modelo em aviso, sem perder o que já foi feito", async () => {
    const motor = new Motor([{ final: { tipo: "erro", message: "O provedor recusou a chave." } }]);
    await servico(motor).conversar(quem, { texto: "oi" }, emitir);
    expect(eventos).toContainEqual({ tipo: "erro", message: "O provedor recusou a chave." });
    expect(eventos.at(-1)?.tipo).toBe("fim");
    expect(ultimaMensagem().partes).toEqual([{ tipo: "texto", texto: "Não consegui terminar: O provedor recusou a chave." }]);
  });

  it("recusa antes de começar: sem modelo, resposta repetida e conversa de outra pessoa", async () => {
    await expect(servico(new Motor([]), new Executor(), ia({}, true)).conversar(quem, { texto: "oi" }, emitir)).rejects.toBeInstanceOf(SemModelo);
    await expect(servico(new Motor([])).conversar(quem, { texto: "" }, emitir)).rejects.toBeInstanceOf(PedidoInvalido);

    await servico(new Motor([{ final: resposta("coordenador", "oi") }])).conversar(quem, { texto: "oi" }, emitir);
    const id = [...conversas.dados.keys()][0];
    await expect(
      servico(new Motor([])).conversar(quem, { conversationId: id, resposta: { perguntaId: "x", escolha: "A" } }, emitir),
    ).rejects.toBeInstanceOf(PedidoInvalido);
    await expect(
      servico(new Motor([])).conversar({ ...quem, userId: "outro" }, { conversationId: id, texto: "oi" }, emitir),
    ).rejects.toBeInstanceOf(NaoEncontrado);
    expect(eventos.filter((evento) => evento.tipo === "erro")).toHaveLength(0);
  });

  it("leva o histórico anterior como texto, com as ações resumidas", async () => {
    const motor = new Motor([
      { final: chamadas("metas", [{ id: "c1", nome: "criar_meta", args: { name: "Viagem", targetCents: 1000 } }]) },
      { final: resposta("metas", "Criei.") },
      { final: resposta("metas", "Você tem 1 meta.") },
    ]);
    const assistente = servico(motor);
    await assistente.conversar(quem, { texto: "crie a meta" }, emitir);
    const id = [...conversas.dados.keys()][0];
    await assistente.conversar(quem, { conversationId: id, texto: "quantas metas tenho?" }, emitir);
    const ultimo = motor.pedidos[2];
    expect(ultimo.agenteAtivo).toBeNull();
    expect(ultimo.mensagens.map((item) => item.role)).toEqual(["user", "assistant", "user"]);
    expect(ultimo.mensagens[1].content).toContain("(Ações feitas: Criou a meta “Viagem”.)");
  });

  it("marca a conversa como em andamento, recusa um segundo turno e para quando mandam parar", async () => {
    const assistente = servico(new MotorParado([{ final: resposta("coordenador", "pronto") }]));
    const primeiro = assistente.conversar(quem, { texto: "oi" }, emitir);
    await vi.waitFor(() => expect(conversas.dados.size).toBe(1));
    const id = [...conversas.dados.keys()][0];
    await vi.waitFor(async () => expect((await assistente.obter("t1", "u1", id)).emAndamento).toBe(true));

    await expect(assistente.conversar(quem, { conversationId: id, texto: "de novo" }, emitir)).rejects.toBeInstanceOf(PedidoInvalido);
    await expect(assistente.parar("t1", "outro", id)).rejects.toBeInstanceOf(NaoEncontrado);

    await assistente.parar("t1", "u1", id);
    await primeiro;
    expect((await assistente.obter("t1", "u1", id)).emAndamento).toBe(false);
    expect(eventos.at(-1)?.tipo).toBe("fim");
    expect(conversas.dados.get(id)?.mensagens.map((item) => item.role)).toEqual(["user", "assistant"]);
  });
});
