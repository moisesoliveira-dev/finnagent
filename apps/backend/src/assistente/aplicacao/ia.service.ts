import { randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import {
  FUNCOES_DE_MODELO,
  INFO_DOS_PROVEDORES,
  type ConfiguracaoDeIa,
  type ConfiguracaoDoAssistente,
  type EscolhaDeModelo,
  type FuncaoDeModelo,
  type ModeloResolvido,
  type PapelDoUsuario,
  type ProvedorConfigurado,
  type ResultadoDoTeste,
} from "@finnagent/contracts";
import { NaoEncontrado, PedidoInvalido } from "../../grupos/dominio/erros.js";
import { interpretarAssistente, interpretarProvedor, interpretarTeste } from "../dominio/pedido.js";
import { IA_REPOSITORIO, type IaRepositorio, type ProvedorGravado } from "../portas/ia-repositorio.js";
import { MOTOR_DE_IA, type MotorDeIa } from "../portas/motor-de-ia.js";

function publico({ apiKey: _chave, ...provedor }: ProvedorGravado): ProvedorConfigurado {
  return provedor;
}

@Injectable()
export class IaService {
  constructor(
    @Inject(IA_REPOSITORIO) private readonly repositorio: IaRepositorio,
    @Inject(MOTOR_DE_IA) private readonly motor: MotorDeIa,
  ) {}

  async obter(tenantId: string, papel: PapelDoUsuario | undefined): Promise<ConfiguracaoDeIa> {
    const [provedores, assistente] = await Promise.all([
      this.repositorio.listarProvedores(tenantId),
      this.repositorio.obterAssistente(tenantId),
    ]);
    return { provedores: provedores.map(publico), assistente, podeEditar: papel === "master" };
  }

  async criarProvedor(tenantId: string, corpo: unknown) {
    const pedido = interpretarProvedor(corpo);
    if (typeof pedido === "string") throw new PedidoInvalido(pedido);
    if (INFO_DOS_PROVEDORES[pedido.kind].precisaChave && pedido.kind !== "openai_compativel" && !pedido.apiKey) {
      throw new PedidoInvalido("Informe a chave do provedor.");
    }
    const criado = await this.repositorio.criarProvedor(tenantId, randomUUID(), pedido);
    // O primeiro provedor com modelo já vira o padrão: o assistente funciona sem passo extra.
    const assistente = await this.repositorio.obterAssistente(tenantId);
    if (!assistente.padrao && criado.models[0]) {
      await this.repositorio.salvarAssistente(tenantId, { ...assistente, padrao: { providerId: criado.id, model: criado.models[0] } });
    }
    return publico(criado);
  }

  async atualizarProvedor(tenantId: string, id: string, corpo: unknown) {
    const pedido = interpretarProvedor(corpo);
    if (typeof pedido === "string") throw new PedidoInvalido(pedido);
    const atualizado = await this.repositorio.atualizarProvedor(tenantId, id, pedido);
    if (!atualizado) throw new NaoEncontrado("Provedor não encontrado.");
    // Modelo que saiu da lista sai também das escolhas que o usavam.
    const assistente = await this.repositorio.obterAssistente(tenantId);
    const limpo = semModelosAusentes(assistente, atualizado);
    if (limpo !== assistente) await this.repositorio.salvarAssistente(tenantId, limpo);
    return publico(atualizado);
  }

  async removerProvedor(tenantId: string, id: string) {
    if (!(await this.repositorio.removerProvedor(tenantId, id))) throw new NaoEncontrado("Provedor não encontrado.");
  }

  /** Testa com o que veio no formulário; sem chave nova, usa a chave já salva do provedor. */
  async testar(tenantId: string, corpo: unknown): Promise<ResultadoDoTeste> {
    const pedido = interpretarTeste(corpo);
    if (typeof pedido === "string") throw new PedidoInvalido(pedido);
    let apiKey = pedido.apiKey;
    if (!apiKey && pedido.providerId) {
      const salvo = (await this.repositorio.listarProvedores(tenantId)).find((item) => item.id === pedido.providerId);
      if (!salvo) throw new NaoEncontrado("Provedor não encontrado.");
      apiKey = salvo.kind === pedido.kind ? salvo.apiKey : "";
    }
    return this.motor.testar({ kind: pedido.kind, apiKey, baseUrl: pedido.baseUrl, model: "" });
  }

  async salvarAssistente(tenantId: string, corpo: unknown) {
    const pedido = interpretarAssistente(corpo);
    if (typeof pedido === "string") throw new PedidoInvalido(pedido);
    const provedores = await this.repositorio.listarProvedores(tenantId);
    const conferir = (escolha: EscolhaDeModelo | null | undefined, rotulo: string) => {
      if (!escolha) return;
      const provedor = provedores.find((item) => item.id === escolha.providerId);
      if (!provedor) throw new PedidoInvalido(`O provedor escolhido para ${rotulo} não existe mais.`);
      if (!provedor.models.includes(escolha.model)) {
        throw new PedidoInvalido(`Cadastre o modelo ${escolha.model} no provedor ${provedor.label} antes de usá-lo.`);
      }
    };
    conferir(pedido.padrao, "o padrão");
    for (const funcao of FUNCOES_DE_MODELO) conferir(pedido.funcoes[funcao], funcao);
    const leitor = pedido.funcoes.leitor;
    if (leitor) {
      const provedor = provedores.find((item) => item.id === leitor.providerId);
      if (provedor && !INFO_DOS_PROVEDORES[provedor.kind].leExtratos) {
        throw new PedidoInvalido(`A leitura de extratos ainda não funciona com ${INFO_DOS_PROVEDORES[provedor.kind].nome}.`);
      }
    }
    return this.repositorio.salvarAssistente(tenantId, pedido);
  }

  /** O modelo de cada função, já com a chave. Função sem escolha própria usa o padrão. */
  async modelos(tenantId: string) {
    const [provedores, assistente] = await Promise.all([
      this.repositorio.listarProvedores(tenantId),
      this.repositorio.obterAssistente(tenantId),
    ]);
    const resolver = (escolha: EscolhaDeModelo | null | undefined): ModeloResolvido | undefined => {
      const provedor = escolha ? provedores.find((item) => item.id === escolha.providerId) : undefined;
      if (!escolha || !provedor) return undefined;
      return { kind: provedor.kind, apiKey: provedor.apiKey, baseUrl: provedor.baseUrl, model: escolha.model };
    };
    const modelos: Partial<Record<FuncaoDeModelo, ModeloResolvido>> = {};
    for (const funcao of FUNCOES_DE_MODELO) {
      const resolvido = resolver(assistente.funcoes[funcao] ?? assistente.padrao);
      if (resolvido) modelos[funcao] = resolvido;
    }
    return { modelos, comportamento: assistente.comportamento };
  }

  /** O modelo da leitura de extrato, se for de um provedor que lê arquivo. */
  async modeloDaLeitura(tenantId: string) {
    const { modelos } = await this.modelos(tenantId);
    const leitor = modelos.leitor;
    return leitor && INFO_DOS_PROVEDORES[leitor.kind].leExtratos ? leitor : null;
  }
}

function semModelosAusentes(assistente: ConfiguracaoDoAssistente, provedor: ProvedorGravado): ConfiguracaoDoAssistente {
  const sumiu = (escolha: EscolhaDeModelo | null | undefined) =>
    Boolean(escolha && escolha.providerId === provedor.id && !provedor.models.includes(escolha.model));
  let mudou = false;
  const funcoes = { ...assistente.funcoes };
  for (const funcao of FUNCOES_DE_MODELO) {
    if (sumiu(funcoes[funcao])) {
      delete funcoes[funcao];
      mudou = true;
    }
  }
  const padrao = sumiu(assistente.padrao) ? null : assistente.padrao;
  if (padrao !== assistente.padrao) mudou = true;
  return mudou ? { ...assistente, padrao, funcoes } : assistente;
}
