import {
  PREFERENCIAS_DE_NOTIFICACAO_PADRAO,
  type CargaDoPush,
  type DispositivoDeNotificacao,
  type Notificacao,
  type PreferenciasDeNotificacao,
} from "@finnagent/contracts";
import { describe, expect, it } from "vitest";
import type { AuthService } from "../../auth/aplicacao/auth.service.js";
import type { ConfiguracoesRepositorio } from "../../configuracoes/portas/configuracoes-repositorio.js";
import { PedidoInvalido } from "../../grupos/dominio/erros.js";
import type { PedidoDeNotificacao } from "../dominio/avisos.js";
import type { CanalDePush, PushDoNavegador, ResultadoDoPush } from "../portas/canal-de-push.js";
import type {
  DispositivoGravado,
  NotificacaoGravada,
  NotificacoesRepositorio,
  NovaNotificacao,
} from "../portas/notificacoes-repositorio.js";
import { NotificacoesService } from "./notificacoes.service.js";

const TENANT = "00000000-0000-4000-8000-000000000001";

class Memoria implements NotificacoesRepositorio {
  itens: (NotificacaoGravada & { chave: string })[] = [];
  prefs = new Map<string, PreferenciasDeNotificacao>();
  aparelhos: (DispositivoGravado & { userId: string })[] = [];
  eventos: string[] = [];

  async criar(_tenantId: string, novas: NovaNotificacao[]) {
    let criadas = 0;
    for (const nova of novas) {
      if (this.itens.some((item) => item.chave === nova.chave)) continue;
      this.itens.push({ ...nova, criadaEm: new Date().toISOString(), lidaEm: null });
      this.eventos.push(`criar-notificacao:${nova.id}`);
      criadas += 1;
    }
    return criadas;
  }
  async listar(_tenantId: string, userId: string, _antes: Date | null, limite: number): Promise<Notificacao[]> {
    return this.itens.filter((item) => item.userId === userId).slice(0, limite);
  }
  async contarNaoLidas(_tenantId: string, userId: string) {
    return this.itens.filter((item) => item.userId === userId && !item.lidaEm).length;
  }
  async obter(_tenantId: string, id: string) {
    return this.itens.find((item) => item.id === id) ?? null;
  }
  async marcarLida(_tenantId: string, userId: string, id: string) {
    const item = this.itens.find((linha) => linha.id === id && linha.userId === userId);
    if (!item) return false;
    item.lidaEm = new Date().toISOString();
    return true;
  }
  async marcarTodas(_tenantId: string, userId: string) {
    const abertas = this.itens.filter((item) => item.userId === userId && !item.lidaEm);
    for (const item of abertas) item.lidaEm = new Date().toISOString();
    return abertas.length;
  }
  async preferencias(_tenantId: string, userId: string) {
    return this.prefs.get(userId) ?? PREFERENCIAS_DE_NOTIFICACAO_PADRAO;
  }
  async salvarPreferencias(_tenantId: string, userId: string, preferencias: PreferenciasDeNotificacao) {
    this.prefs.set(userId, preferencias);
  }
  async registrarDispositivo(_tenantId: string, userId: string, dispositivo: DispositivoDeNotificacao) {
    const endpoint = dispositivo.tipo === "navegador" ? dispositivo.endpoint : dispositivo.token;
    this.aparelhos = this.aparelhos.filter((item) => item.endpoint !== endpoint);
    this.aparelhos.push({ id: `d${this.aparelhos.length + 1}`, userId, canal: dispositivo.tipo, endpoint, p256dh: "", auth: "", plataforma: "" });
  }
  async removerDispositivo(_tenantId: string, userId: string, endpoint: string) {
    const antes = this.aparelhos.length;
    this.aparelhos = this.aparelhos.filter((item) => !(item.endpoint === endpoint && item.userId === userId));
    return this.aparelhos.length < antes;
  }
  async dispositivos(_tenantId: string, userId: string, canal: "celular" | "navegador") {
    return this.aparelhos.filter((item) => item.userId === userId && item.canal === canal);
  }
  async esquecerDispositivo(_tenantId: string, id: string) {
    this.aparelhos = this.aparelhos.filter((item) => item.id !== id);
  }
}

class Canal implements PushDoNavegador {
  enviados: { endpoint: string; carga: CargaDoPush }[] = [];
  constructor(
    private readonly ligado = true,
    private readonly resposta: (endpoint: string) => ResultadoDoPush = () => "entregue",
  ) {}
  disponivel() {
    return this.ligado;
  }
  chavePublica() {
    return this.ligado ? "chave" : null;
  }
  async enviar(dispositivo: DispositivoGravado, carga: CargaDoPush) {
    this.enviados.push({ endpoint: dispositivo.endpoint, carga });
    return this.resposta(dispositivo.endpoint);
  }
}

function montar(opcoes: { usuarios?: string[]; celular?: CanalDePush; navegador?: Canal; fuso?: string } = {}) {
  const repositorio = new Memoria();
  const navegador = opcoes.navegador ?? new Canal();
  const celular = opcoes.celular ?? new Canal();
  const usuarios = opcoes.usuarios ?? ["ana", "bia"];
  const auth = {
    listarUsuarios: async () => usuarios.map((id) => ({ id, name: id, email: `${id}@x.com`, role: "membro" as const })),
  } as unknown as AuthService;
  const configuracoes = { obter: async () => ({ timezone: opcoes.fuso ?? "UTC" }) } as unknown as ConfiguracoesRepositorio;
  const servico = new NotificacoesService(repositorio, navegador, celular, configuracoes, auth);
  return { servico, repositorio, navegador, celular };
}

const vencimento: PedidoDeNotificacao = {
  tipo: "vencimentos",
  titulo: "Aluguel",
  texto: "Vence hoje: R$ 1.500,00.",
  destino: { tela: "financas", id: null },
  chave: "vencimento:aluguel:10",
};

describe("notificações", () => {
  it("avisa cada usuário da conta uma vez só pelo mesmo fato", async () => {
    const { servico, repositorio } = montar();
    expect(await servico.notificar(TENANT, [vencimento])).toBe(2);
    expect(await servico.notificar(TENANT, [vencimento])).toBe(0);
    expect(repositorio.itens.map((item) => item.chave)).toEqual(["ana:vencimento:aluguel:10", "bia:vencimento:aluguel:10"]);
    expect(repositorio.eventos).toHaveLength(2);
  });

  it("respeita quem desligou o tipo na central e o aviso que é de um usuário só", async () => {
    const { servico, repositorio } = montar();
    await repositorio.salvarPreferencias(TENANT, "bia", {
      ...PREFERENCIAS_DE_NOTIFICACAO_PADRAO,
      canais: { ...PREFERENCIAS_DE_NOTIFICACAO_PADRAO.canais, vencimentos: { central: false, celular: true, navegador: true } },
    });
    await servico.notificar(TENANT, [vencimento, { ...vencimento, tipo: "assistente", chave: "plano", userId: "bia" }]);
    expect(repositorio.itens.map((item) => item.chave)).toEqual(["ana:vencimento:aluguel:10", "bia:plano"]);
  });

  it("conta as não lidas e marca uma ou todas como lidas", async () => {
    const { servico, repositorio } = montar({ usuarios: ["ana"] });
    await servico.notificar(TENANT, [vencimento, { ...vencimento, chave: "outro" }]);
    expect((await servico.listar(TENANT, "ana", undefined)).naoLidas).toBe(2);
    expect(await servico.marcarLida(TENANT, "ana", repositorio.itens[0]!.id)).toEqual({ naoLidas: 1 });
    expect(await servico.marcarTodas(TENANT, "ana")).toEqual({ naoLidas: 0 });
    await expect(servico.marcarLida(TENANT, "bia", repositorio.itens[0]!.id)).rejects.toThrow("não encontrada");
  });

  it("recusa preferência fora do esquema", async () => {
    const { servico } = montar();
    await expect(servico.salvarPreferencias(TENANT, "ana", { canais: {} })).rejects.toBeInstanceOf(PedidoInvalido);
    await expect(servico.salvarPreferencias(TENANT, "sem-login", PREFERENCIAS_DE_NOTIFICACAO_PADRAO)).rejects.toThrow("sem login");
  });

  it("entrega o push nos aparelhos do usuário e esquece o que expirou", async () => {
    const navegador = new Canal(true, (endpoint) => (endpoint.endsWith("velho") ? "expirado" : "entregue"));
    const { servico, repositorio, celular } = montar({ usuarios: ["ana"], navegador });
    await servico.registrarDispositivo(TENANT, "ana", { tipo: "navegador", endpoint: "https://push.example/novo", chaves: { p256dh: "p", auth: "a" } });
    await servico.registrarDispositivo(TENANT, "ana", { tipo: "navegador", endpoint: "https://push.example/velho", chaves: { p256dh: "p", auth: "a" } });
    await servico.registrarDispositivo(TENANT, "ana", { tipo: "celular", token: "token-do-aparelho", plataforma: "android" });
    await servico.notificar(TENANT, [vencimento]);
    await servico.entregar(TENANT, repositorio.itens[0]!.id);
    expect(navegador.enviados.map((item) => item.endpoint)).toEqual(["https://push.example/novo", "https://push.example/velho"]);
    expect((celular as Canal).enviados[0]?.carga).toMatchObject({ titulo: "Aluguel", tela: "financas", alvo: null });
    expect(repositorio.aparelhos.map((item) => item.endpoint)).toEqual(["https://push.example/novo", "token-do-aparelho"]);
  });

  it("não manda push no silêncio, de notificação lida ou atrasada, nem por canal sem serviço", async () => {
    const celular = new Canal(false);
    const { servico, repositorio, navegador } = montar({ usuarios: ["ana"], celular });
    await servico.registrarDispositivo(TENANT, "ana", { tipo: "navegador", endpoint: "https://push.example/a", chaves: { p256dh: "p", auth: "a" } });
    await servico.registrarDispositivo(TENANT, "ana", { tipo: "celular", token: "t", plataforma: "ios" });
    // Uma janela de silêncio em volta da hora de agora (UTC, o fuso da conta no teste).
    const hora = new Date().getUTCHours();
    const inicio = `${String(hora).padStart(2, "0")}:00`;
    const fim = `${String((hora + 1) % 24).padStart(2, "0")}:00`;
    const silencio = { ...PREFERENCIAS_DE_NOTIFICACAO_PADRAO, silencio: { ativo: true, inicio, fim } };
    await repositorio.salvarPreferencias(TENANT, "ana", silencio);
    await servico.notificar(TENANT, [vencimento]);
    const id = repositorio.itens[0]!.id;

    await servico.entregar(TENANT, id);
    expect(navegador.enviados).toEqual([]);

    await repositorio.salvarPreferencias(TENANT, "ana", PREFERENCIAS_DE_NOTIFICACAO_PADRAO);
    await servico.entregar(TENANT, id);
    expect(navegador.enviados).toHaveLength(1);
    expect(celular.enviados).toEqual([]);

    navegador.enviados = [];
    await servico.entregar(TENANT, id, new Date(Date.now() + 2 * 60 * 60 * 1000));
    expect(navegador.enviados).toEqual([]);

    await servico.marcarLida(TENANT, "ana", id);
    await servico.entregar(TENANT, id);
    expect(navegador.enviados).toEqual([]);
  });

  it("informa a chave do navegador e se o celular tem envio", () => {
    expect(montar().servico.canais()).toEqual({ navegador: "chave", celular: true });
    expect(montar({ navegador: new Canal(false), celular: new Canal(false) }).servico.canais()).toEqual({ navegador: null, celular: false });
  });
});
