import {
  APROVAR_PLANO,
  CANCELAR_PLANO,
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
import type { RealidadeDaConta } from "../portas/realidade-da-conta.js";
import { CALENDARIO_NACIONAL, PADROES_DE_VENCIMENTO_INICIAIS } from "@finnagent/contracts";
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

/** Escreve e espera, para a leitura da conversa ver o texto antes do fim. */
class MotorQueEscreve extends Motor {
  async passo(pedido: PedidoDePasso, aoEvento: (evento: EventoDoPasso) => void, sinal?: AbortSignal) {
    aoEvento({ tipo: "texto", delta: "Estou olhando." });
    await new Promise<void>((resolve) => sinal?.addEventListener("abort", () => resolve()));
    return super.passo(pedido, aoEvento);
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

const META = "6b0ad7c9-1d51-4d34-9d0b-5a3a1f0a9a01";
const excluirMeta = { id: "c-apagar", nome: "excluir_meta", args: { id: META, resumo: "a meta Viagem" } };

// Uma conta vazia, com os padrões de vencimento iniciais: o plano é medido contra ela.
const realidade: RealidadeDaConta = {
  base: async () => ({ entries: [], hoje: "2026-10-28", padroes: PADROES_DE_VENCIMENTO_INICIAIS, calendario: CALENDARIO_NACIONAL }),
  linhaDoExtrato: async () => null,
};

function plano(passos: Array<{ ferramenta: string; descricao: string; args: Record<string, unknown> }>, id = "p1"): ChamadaDeFerramenta {
  return {
    id,
    nome: "propor_plano",
    args: { objetivo: "Organizar o salário", entendimento: "É renda fixa mensal.", suposicoes: ["Antecipa no fim de semana."], passos },
  };
}

const salario = [
  { ferramenta: "criar_grupo", descricao: "Criar o grupo Renda", args: { name: "Renda" } },
  { ferramenta: "criar_sessao", descricao: "Criar a sessão Salário", args: { groupId: "@passo:1", name: "Salário", kind: "acumulo" } },
  {
    ferramenta: "criar_lancamento",
    descricao: "Lançar o salário todo dia 30",
    args: {
      sessionId: "@passo:2",
      name: "Salário",
      date: "2026-10-30",
      mode: "inflows",
      category: "fixed",
      cents: 300000,
      recurrence: "monthly",
      recurrenceInterval: 1,
      nextDueDate: "2026-10-30",
    },
  },
];

describe("orquestrador do assistente", () => {
  let conversas: Conversas;
  let eventos: EventoDoChat[];
  const emitir = (evento: EventoDoChat) => eventos.push(structuredClone(evento));

  beforeEach(() => {
    conversas = new Conversas();
    eventos = [];
  });

  function servico(motor: MotorDeIa, executor: ExecutorDeFerramentas = new Executor(), config = ia()) {
    return new AssistenteService(conversas, motor, executor, contexto, config, realidade);
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

  it("consulta direto, com o token de quem conversa, e devolve o resultado ao modelo", async () => {
    const executor = new Executor();
    const motor = new Motor([
      { final: chamadas("coordenador", [{ id: "c1", nome: "consultar_metas", args: {} }]) },
      { textos: ["Você tem uma meta."], final: resposta("coordenador", "Você tem uma meta.") },
    ]);
    await servico(motor, executor).conversar(quem, { texto: "quais são minhas metas?" }, emitir);
    expect(executor.chamadas).toEqual([
      { chamada: { id: "c1", nome: "consultar_metas", args: {} }, credencial: { token: "token-da-ana", fuso: "America/Sao_Paulo" } },
    ]);
    expect(motor.pedidos[1].mensagens.at(-1)).toMatchObject({ role: "tool", toolCallId: "c1", content: '{"ok":true}' });
    const acoes = eventos.filter((evento) => evento.tipo === "acao").map((evento) => evento.tipo === "acao" && evento.acao.estado);
    expect(acoes).toEqual(["executando", "feita"]);
  });

  it("recusa escrita fora do plano, mesmo com a confirmação de exclusão desligada", async () => {
    const executor = new Executor();
    const motor = new Motor([
      {
        final: chamadas("coordenador", [
          excluirMeta,
          { id: "c2", nome: "criar_meta", args: { name: "Viagem", targetCents: 1000 } },
          { id: "c3", nome: "salvar_configuracoes", args: {} },
        ]),
      },
      { final: resposta("coordenador", "Vou propor um plano.") },
    ]);
    await servico(motor, executor, ia({ confirmarExclusao: false })).conversar(quem, { texto: "apague e crie" }, emitir);
    expect(executor.chamadas).toHaveLength(0);
    const resultados = motor.pedidos[1].mensagens.filter((item) => item.role === "tool").map((item) => item.content);
    expect(resultados[0]).toContain("só roda dentro de um plano aprovado");
    expect(resultados[1]).toContain("só roda dentro de um plano aprovado");
    expect(resultados[2]).toContain("Ferramenta desconhecida");
  });

  it("mostra o plano com os fatos calculados e só executa depois do Aprovar, na ordem, com os ids encadeados", async () => {
    const executor = new Executor();
    const motor = new Motor([
      { final: chamadas("coordenador", [plano(salario)]) },
      { final: resposta("coordenador", "Pronto: lancei o salário.") },
    ]);
    const assistente = servico(motor, executor);
    await assistente.conversar(quem, { texto: "ganho 3 mil todo dia 30" }, emitir);
    expect(executor.chamadas).toHaveLength(0);
    const id = [...conversas.dados.keys()][0] as string;
    const pendencia = conversas.dados.get(id)?.pendencia;
    expect(pendencia?.aguardando.tipo).toBe("plano");

    const pergunta = eventos.find((evento) => evento.tipo === "pergunta");
    expect(pergunta).toMatchObject({ pergunta: { tipo: "plano", texto: "Organizar o salário" } });
    const fatos = pergunta?.tipo === "pergunta" ? pergunta.pergunta.plano?.fatos : undefined;
    // 30/10/2026 é sexta; 30/11 é segunda; 30/12 é quarta: nenhuma muda. A sobra de outubro sobe 3 mil.
    expect(fatos?.passos[0]).toMatchObject({ passo: 3, valorCents: 300000, recorrente: true });
    expect(fatos?.passos[0]?.datas.map((item) => item.data)).toEqual(["2026-10-30", "2026-11-30", "2026-12-30"]);
    expect(fatos?.mes).toEqual({ ano: 2026, mes: 10, sobraAntesCents: 0, sobraDepoisCents: 300000 });

    await assistente.conversar(quem, { conversationId: id, resposta: { perguntaId: "p1", escolha: APROVAR_PLANO } }, emitir);
    expect(executor.chamadas.map((item) => item.chamada.nome)).toEqual(["criar_grupo", "criar_sessao", "criar_lancamento"]);
    const [grupo, sessao, lancamento] = executor.chamadas.map((item) => item.chamada);
    expect(sessao?.args.groupId).toBe(grupo?.idGerado);
    expect(lancamento?.args.sessionId).toBe(sessao?.idGerado);
    expect(executor.chamadas.every((item) => item.credencial.token === "token-da-ana")).toBe(true);
    const relato = motor.pedidos[1].mensagens.find((item) => item.role === "tool" && item.toolCallId === "p1");
    expect(relato?.content).toContain("todos os passos foram feitos");
    expect(conversas.dados.get(id)?.pendencia).toBeNull();
  });

  it("para no primeiro passo que falha e não faz os seguintes", async () => {
    const executor = new Executor();
    executor.executar = async (chamada, credencial) => {
      executor.chamadas.push({ chamada, credencial });
      return chamada.nome === "criar_sessao"
        ? { ok: false, conteudo: "Erro 409: Esse grupo já tem uma sessão com esse nome.", detalhe: "Nome repetido." }
        : { ok: true, conteudo: '{"ok":true}', detalhe: "" };
    };
    const motor = new Motor([{ final: chamadas("coordenador", [plano(salario)]) }, { final: resposta("coordenador", "Falhou.") }]);
    const assistente = servico(motor, executor);
    await assistente.conversar(quem, { texto: "salário" }, emitir);
    const id = [...conversas.dados.keys()][0] as string;
    await assistente.conversar(quem, { conversationId: id, resposta: { perguntaId: "p1", escolha: APROVAR_PLANO } }, emitir);
    expect(executor.chamadas.map((item) => item.chamada.nome)).toEqual(["criar_grupo", "criar_sessao"]);
    const relato = motor.pedidos[1].mensagens.find((item) => item.role === "tool" && item.toolCallId === "p1")?.content ?? "";
    expect(relato).toContain("o passo 2 falhou");
    expect(relato).toContain("Passo 3 (criar_lancamento): não executado.");
  });

  it("cancelar não executa nada; escrever um ajuste devolve o pedido ao modelo para refazer o plano", async () => {
    const executor = new Executor();
    const motor = new Motor([
      { final: chamadas("coordenador", [plano(salario)]) },
      { final: chamadas("coordenador", [plano(salario, "p2")]) },
      { final: resposta("coordenador", "Tudo bem, não faço.") },
    ]);
    const assistente = servico(motor, executor);
    await assistente.conversar(quem, { texto: "salário" }, emitir);
    const id = [...conversas.dados.keys()][0] as string;
    await assistente.conversar(quem, { conversationId: id, resposta: { perguntaId: "p1", escolha: "O salário cai no 5º dia útil" } }, emitir);
    expect(motor.pedidos[1].mensagens.at(-1)?.content).toContain('pediu um ajuste no plano: "O salário cai no 5º dia útil"');
    expect(conversas.dados.get(id)?.pendencia?.aguardando.chamada.id).toBe("p2");
    await assistente.conversar(quem, { conversationId: id, resposta: { perguntaId: "p2", escolha: CANCELAR_PLANO } }, emitir);
    expect(motor.pedidos[2].mensagens.at(-1)?.content).toContain("não aprovou o plano");
    expect(executor.chamadas).toHaveLength(0);
  });

  it("recusa plano com passo de consulta, ferramenta inventada ou referência a um passo que vem depois", async () => {
    const executor = new Executor();
    const motor = new Motor([
      {
        final: chamadas("coordenador", [
          plano([{ ferramenta: "consultar_metas", descricao: "Ver as metas", args: {} }], "a"),
          plano([{ ferramenta: "mandar_pix", descricao: "Pagar", args: {} }], "b"),
          plano(
            [
              { ferramenta: "criar_sessao", descricao: "Sessão", args: { groupId: "@passo:2", name: "X", kind: "acumulo" } },
              { ferramenta: "criar_grupo", descricao: "Grupo", args: { name: "G" } },
            ],
            "c",
          ),
        ]),
      },
      { final: resposta("coordenador", "Corrijo.") },
    ]);
    await servico(motor, executor).conversar(quem, { texto: "faça" }, emitir);
    const resultados = motor.pedidos[1].mensagens.filter((item) => item.role === "tool").map((item) => item.content);
    expect(resultados[0]).toContain("só consulta");
    expect(resultados[1]).toContain("não existe");
    expect(resultados[2]).toContain("aponta para um passo que ainda não aconteceu");
    expect(eventos.some((evento) => evento.tipo === "pergunta")).toBe(false);
  });

  it("a lista marca a conversa que ainda está respondendo, mesmo sem a tela conectada", async () => {
    const motor = new MotorParado([]);
    const assistente = servico(motor, new Executor());
    const turno = assistente.conversar(quem, { texto: "lance meu salário" }, emitir);
    await new Promise((resolver) => setTimeout(resolver, 10));
    const id = [...conversas.dados.keys()][0] as string;
    const [durante] = await assistente.listar(quem.tenantId, quem.userId);
    expect(durante).toMatchObject({ id, emAndamento: true });
    await assistente.parar(quem.tenantId, quem.userId, id);
    await turno;
    const [depois] = await assistente.listar(quem.tenantId, quem.userId);
    expect(depois?.emAndamento).toBe(false);
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
      { final: chamadas("coordenador", [plano([{ ferramenta: "criar_meta", descricao: "Criar a meta Viagem", args: { name: "Viagem", targetCents: 1000 } }])]) },
      { final: resposta("coordenador", "Criei.") },
      { final: resposta("coordenador", "Você tem 1 meta.") },
    ]);
    const assistente = servico(motor);
    await assistente.conversar(quem, { texto: "crie a meta" }, emitir);
    const id = [...conversas.dados.keys()][0] as string;
    await assistente.conversar(quem, { conversationId: id, resposta: { perguntaId: "p1", escolha: APROVAR_PLANO } }, emitir);
    await assistente.conversar(quem, { conversationId: id, texto: "quantas metas tenho?" }, emitir);
    const ultimo = motor.pedidos[2];
    expect(ultimo.mensagens.map((item) => item.role)).toEqual(["user", "assistant", "user"]);
    expect(ultimo.mensagens[1].content).toContain("(Ações feitas: Criar a meta Viagem.)");
  });

  it("mostra o texto já escrito enquanto o turno segue, e grava ao terminar o passo", async () => {
    const assistente = servico(new MotorQueEscreve());
    const primeiro = assistente.conversar(quem, { texto: "oi" }, emitir);
    await vi.waitFor(() => expect(conversas.dados.size).toBe(1));
    const id = [...conversas.dados.keys()][0] as string;
    await vi.waitFor(async () => {
      const conversa = await assistente.obter("t1", "u1", id);
      expect(conversa.mensagens.at(-1)?.partes).toEqual([{ tipo: "texto", texto: "Estou olhando." }]);
    });
    await assistente.parar("t1", "u1", id);
    await primeiro;
    expect((await assistente.obter("t1", "u1", id)).emAndamento).toBe(false);
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
