import { describe, expect, it } from "vitest";
import { ESPECIALISTAS_IA, FERRAMENTAS_POR_NOME } from "@finnagent/contracts";
import { promptDaConversa, promptDaTriagem, promptDoEspecialista } from "./prompts.js";

const contexto = { hoje: "2026-10-28", usuario: "Ana", fuso: "America/Sao_Paulo" };

describe("valor sempre numa sessão", () => {
  it("todo especialista e a conversa sabem que valor é lançamento numa sessão e que compromisso da agenda não tem valor", () => {
    const prompts = [...ESPECIALISTAS_IA.map((agente) => promptDoEspecialista(agente, contexto, "")), promptDaConversa(contexto, "")];
    for (const prompt of prompts) {
      expect(prompt).toContain("Todo valor em dinheiro é um lançamento e fica numa sessão");
      expect(prompt).toContain("O compromisso da agenda não guarda valor");
    }
  });

  it("finanças pergunta a sessão quando nenhuma combina, em vez de usar a única que existe", () => {
    const prompt = promptDoEspecialista("financas", contexto, "");
    expect(prompt).toContain("Se nenhuma combinar com clareza, ou se mais de uma servir, pergunte qual usar");
    expect(prompt).toContain("Nunca lance numa sessão sem relação com o valor só porque é a única");
    expect(prompt).toContain("você mesmo cria, na mesma resposta");
  });

  it("agenda passa o valor para finanças, e organização devolve para finanças depois de criar a sessão", () => {
    expect(promptDoEspecialista("agenda", contexto, "")).toContain("encaminhe o valor para financas");
    const organizacao = promptDoEspecialista("organizacao", contexto, "");
    expect(organizacao).toContain("use acumulo para fixa, parcela e empréstimo");
    expect(organizacao).toContain("encaminhe para financas lançar o valor");
    expect(organizacao).toContain("sua última ação é sempre encaminhar de volta para financas");
    expect(organizacao).toContain("Não termine com texto nem com resumo antes de o valor estar lançado");
    expect(promptDoEspecialista("financas", contexto, "")).toContain("se ainda resta parte do pedido que é de outro especialista");
  });

  it("todo agente sabe o propósito, a ordem para organizar o financeiro e que só a pessoa aprova a sobra das metas", () => {
    for (const agente of ESPECIALISTAS_IA) {
      const prompt = promptDoEspecialista(agente, contexto, "");
      expect(prompt).toContain("ajudar a pessoa a organizar o financeiro dela no Prumo");
      expect(prompt).toContain("Você nunca aprova a sobra das metas");
    }
    const metas = promptDoEspecialista("metas", contexto, "");
    expect(metas).toContain("quem aprova cada parte é a pessoa");
    expect(metas).toContain("Separar valor sempre pede a confirmação dela");
    expect(promptDaConversa(contexto, "")).toContain("ofereça ajuda para organizar o financeiro");
    expect(promptDaTriagem(contexto)).toContain("Pedido para começar ou organizar o financeiro");
  });

  it("finanças cria o grupo e a sessão ela mesma e nenhum agente encerra só anunciando o que vai fazer", () => {
    const financas = promptDoEspecialista("financas", contexto, "");
    expect(financas).toContain("você mesmo cria, na mesma resposta: criar_grupo");
    expect(financas).toContain("Não encaminhe isso para organizacao");
    for (const agente of ESPECIALISTAS_IA) {
      expect(promptDoEspecialista(agente, contexto, "")).toContain("Nunca encerre só anunciando o que vai fazer");
    }
    expect(FERRAMENTAS_POR_NOME.get("criar_sessao")?.agentes).toContain("financas");
    expect(FERRAMENTAS_POR_NOME.get("criar_grupo")?.agentes).toContain("financas");
  });

  it("quem mexe com dinheiro pensa como consultor e conhece as convenções; agenda e extratos não carregam isso", () => {
    for (const agente of ["financas", "organizacao", "metas", "analise"] as const) {
      const prompt = promptDoEspecialista(agente, contexto, "");
      expect(prompt).toContain("Pense como um consultor financeiro, não como quem só executa");
      expect(prompt).toContain("Meça o efeito: consulte consultar_mes_financeiro");
      expect(prompt).toContain("Pagamento nunca cai em fim de semana ou feriado");
      expect(prompt).toContain("Dinheiro guardado (reserva, investimento, poupança para um objetivo): não é gasto");
    }
    for (const agente of ["agenda", "extratos"] as const) {
      expect(promptDoEspecialista(agente, contexto, "")).not.toContain("Pense como um consultor financeiro");
    }
    expect(promptDoEspecialista("financas", contexto, "")).toContain("a suposição que você fez e o efeito no mês");
  });

  it("a triagem manda valor para finanças mesmo quando a pessoa fala em compromisso", () => {
    expect(promptDaTriagem(contexto)).toContain("é de financas, mesmo que a pessoa chame de compromisso ou lembrete");
  });
});
