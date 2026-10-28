import { Injectable } from "@nestjs/common";
import {
  COMPORTAMENTO_PADRAO,
  CRIATIVIDADES,
  FUNCOES_DE_MODELO,
  PASSOS_DO_ASSISTENTE,
  PROVEDORES_IA,
  RETENCOES_DO_CHAT,
  type ConfiguracaoDoAssistente,
  type EscolhaDeModelo,
  type FuncaoDeModelo,
  type PedidoDeProvedor,
} from "@finnagent/contracts";
import type { AiProvider, AiSettings, Prisma } from "@prisma/client";
import { BancoIndisponivel } from "../../grupos/dominio/erros.js";
import { gravarOutbox, marcaDe } from "../../persistencia/gravar-outbox.js";
import { PrismaService } from "../../persistencia/prisma.service.js";
import type { IaRepositorio, ProvedorGravado } from "../portas/ia-repositorio.js";

@Injectable()
export class PrismaIaRepositorio implements IaRepositorio {
  constructor(private readonly prisma: PrismaService) {}

  async listarProvedores(tenantId: string) {
    const linhas = await this.banco().aiProvider.findMany({ where: { tenantId }, orderBy: { createdAt: "asc" } });
    return linhas.map(provedorDe);
  }

  async criarProvedor(tenantId: string, id: string, pedido: PedidoDeProvedor) {
    return this.banco().$transaction(async (tx) => {
      const criado = await tx.aiProvider.create({
        data: {
          id,
          tenantId,
          kind: pedido.kind,
          label: pedido.label,
          apiKey: pedido.limparChave ? "" : pedido.apiKey,
          baseUrl: pedido.baseUrl,
          models: pedido.models,
        },
      });
      const payload = semChave(criado);
      await gravarOutbox(tx, tenantId, "criar-provedor-de-ia", id, payload, marcaDe(payload));
      return provedorDe(criado);
    });
  }

  async atualizarProvedor(tenantId: string, id: string, pedido: PedidoDeProvedor) {
    return this.banco().$transaction(async (tx) => {
      const atual = await tx.aiProvider.findFirst({ where: { id, tenantId } });
      if (!atual) return null;
      const apiKey = pedido.limparChave ? "" : pedido.apiKey || atual.apiKey;
      // Trocar de família invalida a chave antiga: uma chave da OpenAI não serve na Anthropic.
      const chave = pedido.kind === atual.kind ? apiKey : pedido.apiKey;
      await tx.aiProvider.updateMany({
        where: { id, tenantId },
        data: { kind: pedido.kind, label: pedido.label, apiKey: chave, baseUrl: pedido.baseUrl, models: pedido.models },
      });
      const gravado = await tx.aiProvider.findFirstOrThrow({ where: { id, tenantId } });
      const payload = { ...semChave(gravado), chaveTrocada: chave !== atual.apiKey };
      await gravarOutbox(tx, tenantId, "atualizar-provedor-de-ia", id, payload, marcaDe(payload));
      return provedorDe(gravado);
    });
  }

  async removerProvedor(tenantId: string, id: string) {
    return this.banco().$transaction(async (tx) => {
      const apagados = await tx.aiProvider.deleteMany({ where: { id, tenantId } });
      if (apagados.count === 0) return false;
      const ajustes = await tx.aiSettings.findUnique({ where: { tenantId } });
      if (ajustes) {
        const funcoes = funcoesDe(ajustes.roles);
        for (const funcao of FUNCOES_DE_MODELO) if (funcoes[funcao]?.providerId === id) delete funcoes[funcao];
        await tx.aiSettings.update({
          where: { tenantId },
          data: {
            roles: funcoes as Prisma.InputJsonValue,
            ...(ajustes.defaultProviderId === id ? { defaultProviderId: null, defaultModel: "" } : {}),
          },
        });
      }
      await gravarOutbox(tx, tenantId, "remover-provedor-de-ia", id, { id });
      return true;
    });
  }

  async obterAssistente(tenantId: string) {
    const ajustes = await this.banco().aiSettings.findUnique({ where: { tenantId } });
    return assistenteDe(ajustes);
  }

  async salvarAssistente(tenantId: string, configuracao: ConfiguracaoDoAssistente) {
    return this.banco().$transaction(async (tx) => {
      const dados = {
        defaultProviderId: configuracao.padrao?.providerId ?? null,
        defaultModel: configuracao.padrao?.model ?? "",
        roles: configuracao.funcoes as Prisma.InputJsonValue,
        confirmDeletes: configuracao.comportamento.confirmarExclusao,
        maxSteps: configuracao.comportamento.maxPassos,
        creativity: configuracao.comportamento.criatividade,
        instructions: configuracao.comportamento.instrucoes,
        retention: configuracao.comportamento.retencao,
      };
      const gravado = await tx.aiSettings.upsert({ where: { tenantId }, create: { tenantId, ...dados }, update: dados });
      // As instruções podem ter dado pessoal: o evento só diz se existem.
      const payload = { ...configuracao, comportamento: { ...configuracao.comportamento, instrucoes: Boolean(configuracao.comportamento.instrucoes) } };
      await gravarOutbox(tx, tenantId, "salvar-assistente-de-ia", tenantId, payload, marcaDe(payload));
      return assistenteDe(gravado);
    });
  }

  private banco() {
    if (!this.prisma.ativo) throw new BancoIndisponivel();
    return this.prisma;
  }
}

function provedorDe(linha: AiProvider): ProvedorGravado {
  return {
    id: linha.id,
    kind: PROVEDORES_IA.find((item) => item === linha.kind) ?? "openai",
    label: linha.label,
    baseUrl: linha.baseUrl,
    models: linha.models,
    hasKey: Boolean(linha.apiKey),
    apiKey: linha.apiKey,
    updatedAt: linha.updatedAt.toISOString(),
  };
}

function semChave(linha: AiProvider) {
  return { id: linha.id, kind: linha.kind, label: linha.label, baseUrl: linha.baseUrl, models: linha.models, temChave: Boolean(linha.apiKey) };
}

function escolhaDe(valor: unknown): EscolhaDeModelo | null {
  if (!valor || typeof valor !== "object") return null;
  const { providerId, model } = valor as Record<string, unknown>;
  return typeof providerId === "string" && typeof model === "string" && providerId && model ? { providerId, model } : null;
}

function funcoesDe(valor: unknown) {
  const funcoes: Partial<Record<FuncaoDeModelo, EscolhaDeModelo | null>> = {};
  if (!valor || typeof valor !== "object") return funcoes;
  for (const funcao of FUNCOES_DE_MODELO) {
    const escolha = escolhaDe((valor as Record<string, unknown>)[funcao]);
    if (escolha) funcoes[funcao] = escolha;
  }
  return funcoes;
}

function assistenteDe(linha: AiSettings | null): ConfiguracaoDoAssistente {
  if (!linha) return { padrao: null, funcoes: {}, comportamento: { ...COMPORTAMENTO_PADRAO } };
  return {
    padrao: linha.defaultProviderId && linha.defaultModel ? { providerId: linha.defaultProviderId, model: linha.defaultModel } : null,
    funcoes: funcoesDe(linha.roles),
    comportamento: {
      confirmarExclusao: linha.confirmDeletes,
      maxPassos: PASSOS_DO_ASSISTENTE.find((item) => item === linha.maxSteps) ?? COMPORTAMENTO_PADRAO.maxPassos,
      criatividade: CRIATIVIDADES.find((item) => item === linha.creativity) ?? COMPORTAMENTO_PADRAO.criatividade,
      instrucoes: linha.instructions,
      retencao: RETENCOES_DO_CHAT.find((item) => item === linha.retention) ?? COMPORTAMENTO_PADRAO.retencao,
    },
  };
}
