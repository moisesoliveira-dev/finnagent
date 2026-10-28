import {
  COMPORTAMENTO_PADRAO,
  type ConfiguracaoDoAssistente,
  type PedidoDeProvedor,
  type PedidoDeTesteDoProvedor,
} from "@finnagent/contracts";
import { beforeEach, describe, expect, it } from "vitest";
import { NaoEncontrado, PedidoInvalido } from "../../grupos/dominio/erros.js";
import type { IaRepositorio, ProvedorGravado } from "../portas/ia-repositorio.js";
import type { MotorDeIa } from "../portas/motor-de-ia.js";
import { IaService } from "./ia.service.js";

class Memoria implements IaRepositorio {
  provedores: ProvedorGravado[] = [];
  assistente: ConfiguracaoDoAssistente = { padrao: null, funcoes: {}, comportamento: { ...COMPORTAMENTO_PADRAO } };

  async listarProvedores() {
    return structuredClone(this.provedores);
  }
  async criarProvedor(_tenantId: string, id: string, pedido: PedidoDeProvedor) {
    const provedor: ProvedorGravado = {
      id,
      kind: pedido.kind,
      label: pedido.label,
      baseUrl: pedido.baseUrl,
      models: pedido.models,
      hasKey: Boolean(pedido.apiKey),
      apiKey: pedido.apiKey,
      updatedAt: new Date().toISOString(),
    };
    this.provedores.push(provedor);
    return provedor;
  }
  async atualizarProvedor(_tenantId: string, id: string, pedido: PedidoDeProvedor) {
    const atual = this.provedores.find((item) => item.id === id);
    if (!atual) return null;
    Object.assign(atual, { ...pedido, apiKey: pedido.apiKey || atual.apiKey });
    return atual;
  }
  async removerProvedor(_tenantId: string, id: string) {
    const antes = this.provedores.length;
    this.provedores = this.provedores.filter((item) => item.id !== id);
    return this.provedores.length < antes;
  }
  async obterAssistente() {
    return structuredClone(this.assistente);
  }
  async salvarAssistente(_tenantId: string, configuracao: ConfiguracaoDoAssistente) {
    this.assistente = structuredClone(configuracao);
    return configuracao;
  }
}

class Motor implements MotorDeIa {
  testes: PedidoDeTesteDoProvedor[] = [];
  async passo(): Promise<never> {
    throw new Error("não usado");
  }
  async testar(pedido: PedidoDeTesteDoProvedor) {
    this.testes.push(pedido);
    return { ok: true, models: ["a"], message: "ok", ms: 1 };
  }
}

const openai = { kind: "openai", label: "OpenAI", apiKey: "sk-1", models: ["gpt-a", "gpt-b"] };
const claude = { kind: "anthropic", label: "Claude", apiKey: "ak-1", models: ["claude-x"] };

describe("configuração de IA", () => {
  let repositorio: Memoria;
  let motor: Motor;
  let servico: IaService;

  beforeEach(() => {
    repositorio = new Memoria();
    motor = new Motor();
    servico = new IaService(repositorio, motor);
  });

  it("nunca devolve a chave para a tela e diz se a pessoa pode editar", async () => {
    await servico.criarProvedor("t", openai);
    const configuracao = await servico.obter("t", "membro");
    expect(JSON.stringify(configuracao)).not.toContain("sk-1");
    expect(configuracao.provedores[0]).toMatchObject({ label: "OpenAI", hasKey: true });
    expect(configuracao.podeEditar).toBe(false);
    expect((await servico.obter("t", "master")).podeEditar).toBe(true);
  });

  it("o primeiro provedor com modelo vira o padrão de todos os agentes", async () => {
    const criado = await servico.criarProvedor("t", openai);
    expect(repositorio.assistente.padrao).toEqual({ providerId: criado.id, model: "gpt-a" });
    const { modelos } = await servico.modelos("t");
    expect(modelos.coordenador).toEqual({ kind: "openai", apiKey: "sk-1", baseUrl: "", model: "gpt-a" });
    expect(modelos.financas?.model).toBe("gpt-a");
  });

  it("exige chave onde o provedor pede e URL nos compatíveis", async () => {
    await expect(servico.criarProvedor("t", { ...openai, apiKey: "" })).rejects.toBeInstanceOf(PedidoInvalido);
    await expect(servico.criarProvedor("t", { kind: "openai_compativel", label: "OpenRouter", models: [] })).rejects.toThrow(
      "Informe a URL do provedor.",
    );
    const ollama = await servico.criarProvedor("t", { kind: "ollama", label: "Local", baseUrl: "http://host.docker.internal:11434/v1/", models: ["llama3.1:8b"] });
    expect(ollama.baseUrl).toBe("http://host.docker.internal:11434/v1");
  });

  it("cada agente pode ter o próprio modelo; sem escolha, usa o padrão", async () => {
    const a = await servico.criarProvedor("t", openai);
    const c = await servico.criarProvedor("t", claude);
    await servico.salvarAssistente("t", {
      padrao: { providerId: a.id, model: "gpt-b" },
      funcoes: { analise: { providerId: c.id, model: "claude-x" } },
      comportamento: COMPORTAMENTO_PADRAO,
    });
    const { modelos } = await servico.modelos("t");
    expect(modelos.analise).toMatchObject({ kind: "anthropic", model: "claude-x" });
    expect(modelos.agenda).toMatchObject({ kind: "openai", model: "gpt-b" });
  });

  it("recusa modelo não cadastrado e leitura de extrato em provedor que não lê arquivo", async () => {
    const a = await servico.criarProvedor("t", openai);
    const c = await servico.criarProvedor("t", claude);
    await expect(
      servico.salvarAssistente("t", { padrao: { providerId: a.id, model: "outro" }, funcoes: {}, comportamento: COMPORTAMENTO_PADRAO }),
    ).rejects.toThrow("Cadastre o modelo outro");
    await expect(
      servico.salvarAssistente("t", {
        padrao: null,
        funcoes: { leitor: { providerId: c.id, model: "claude-x" } },
        comportamento: COMPORTAMENTO_PADRAO,
      }),
    ).rejects.toThrow("A leitura de extratos ainda não funciona com Anthropic.");
  });

  it("a leitura de extrato só usa provedor que lê arquivo", async () => {
    await servico.criarProvedor("t", claude);
    expect(await servico.modeloDaLeitura("t")).toBeNull();
    const a = await servico.criarProvedor("t", openai);
    await servico.salvarAssistente("t", {
      padrao: repositorio.assistente.padrao,
      funcoes: { leitor: { providerId: a.id, model: "gpt-a" } },
      comportamento: COMPORTAMENTO_PADRAO,
    });
    expect(await servico.modeloDaLeitura("t")).toMatchObject({ kind: "openai", model: "gpt-a" });
  });

  it("modelo removido da lista sai das escolhas que o usavam", async () => {
    const a = await servico.criarProvedor("t", openai);
    await servico.atualizarProvedor("t", a.id, { ...openai, apiKey: "", models: ["gpt-b"] });
    expect(repositorio.assistente.padrao).toBeNull();
    await expect(servico.atualizarProvedor("t", "00000000-0000-4000-8000-000000000009", openai)).rejects.toBeInstanceOf(NaoEncontrado);
  });

  it("testa com a chave salva quando o formulário não traz chave nova, mas não leva a chave para outro tipo", async () => {
    const a = await servico.criarProvedor("t", openai);
    await servico.testar("t", { kind: "openai", apiKey: "", baseUrl: "", providerId: a.id });
    await servico.testar("t", { kind: "anthropic", apiKey: "", baseUrl: "", providerId: a.id });
    expect(motor.testes.map((item) => item.apiKey)).toEqual(["sk-1", ""]);
  });
});
