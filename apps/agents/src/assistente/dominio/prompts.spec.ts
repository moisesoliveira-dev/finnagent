import { describe, expect, it } from "vitest";
import { promptDoConsultor } from "./prompts.js";

const contexto = { hoje: "2026-10-28", usuario: "Ana", fuso: "America/Sao_Paulo" };
const prompt = promptDoConsultor(contexto, "");

describe("prompt do consultor", () => {
  it("trabalha em ciclo: entende, pergunta o que muda o caminho, propõe o plano e confere depois", () => {
    expect(prompt).toContain("ajudar a pessoa a organizar o financeiro dela no Prumo");
    expect(prompt).toContain("pela ferramenta propor_plano");
    expect(prompt).toContain("Nunca chame direto uma ferramenta que muda o sistema: o sistema recusa");
    expect(prompt).toContain('escreva "@passo:N"');
    expect(prompt).toContain("Depois de executado, o resultado traz o que cada passo devolveu");
    // O que muda a cada chamada fica no fim, para o prefixo fixo entrar no cache do provedor.
    expect(prompt.indexOf("Hoje é 2026-10-28")).toBeGreaterThan(prompt.indexOf("Responda sempre em português"));
    expect(prompt).toContain("Hoje é 2026-10-28, no fuso America/Sao_Paulo. Você conversa com Ana.");
  });

  it("pensa como consultor e conhece as convenções do dinheiro", () => {
    expect(prompt).toContain("Pense como um consultor financeiro, não como quem só executa");
    expect(prompt).toContain("O cartão calcula datas e sobra; você explica esses números, não inventa outro.");
    expect(prompt).toContain("Pagamento nunca cai em fim de semana ou feriado");
    expect(prompt).toContain("Dinheiro guardado (reserva, investimento, poupança para um objetivo): não é gasto");
  });

  it("todo valor vai numa sessão que combina, e compromisso da agenda não guarda valor", () => {
    expect(prompt).toContain("Todo valor em dinheiro é um lançamento e fica numa sessão");
    expect(prompt).toContain("O compromisso da agenda não guarda valor");
    expect(prompt).toContain("Nunca use uma sessão sem relação com o valor só porque é a única");
    expect(prompt).toContain('o plano cria o compromisso ligado ao lançamento (entryId "@passo:N")');
  });

  it("conhece como uma mudança mexe na outra", () => {
    expect(prompt).toContain("Você conhece os fluxos e as regras deste sistema");
    expect(prompt).toContain("Como uma mudança mexe na outra");
    expect(prompt).toContain("Editar valor, data ou regra muda só o que ainda está pendente");
    expect(prompt).toContain("a taxa não é somada de novo");
    expect(prompt).toContain("já incluso em outro não entra de novo");
    expect(prompt).toContain("qualquer sessão do grupo Metas, não aceita fixa, parcela nem empréstimo");
    expect(prompt).toContain("Cancelar a fixa num mês, ou pagar pelo extrato, mexe só naquele mês");
    expect(prompt).toContain("Sessão de valor guarda uma única viva");
    expect(prompt).toContain("Separar valor para uma meta cria uma saída única");
    expect(prompt).toContain("Ligar ou mover o compromisso não muda o lançamento");
    expect(prompt).toContain("nomeie o que mais muda");
  });

  it("trata o extrato pela categoria e exige a escolha quando o valor diverge", () => {
    expect(prompt).toContain("não lance uma série como única");
    expect(prompt).toContain('mande cruzar_linha com valor "extrato" ou "lancamento"');
    expect(prompt).toContain("Não associe extra a saída");
    expect(prompt).toContain("o valor do extrato é o daquele mês");
  });

  it("só propõe a divisão da sobra das metas, e as preferências entram por último", () => {
    expect(prompt).toContain("cada parte só é separada quando a pessoa aprova");
    expect(prompt).toContain("ofereça ajuda para organizar o financeiro");
    expect(prompt).not.toContain("Preferências da pessoa");
    // As preferências entram depois das regras; só a linha do dia (que muda sempre) vem depois delas, pelo cache.
    const comPreferencias = promptDoConsultor(contexto, "  fale com emojis ");
    expect(comPreferencias).toContain("Preferências da pessoa (siga quando não conflitar com as regras acima): fale com emojis\n\nHoje é 2026-10-28");
    expect(comPreferencias.indexOf("Preferências da pessoa")).toBeGreaterThan(comPreferencias.indexOf("Responda sempre em português"));
  });

  it("lê a conferência inteira numa chamada antes de propor e conta o que sobrou depois de lançar", () => {
    const texto = promptDoConsultor(contexto, "");
    expect(texto).toContain("consultar_conferencia com todas true");
    expect(texto).toContain("nunca a partir de uma página só");
    expect(texto).toContain("Mês citado sem ano é o do ano atual");
    expect(texto).toContain("failed lista as que não entraram com o motivo");
    expect(texto).toContain("Nunca diga que lançou tudo sem conferir esses números");
    expect(texto).toContain("Só diga que terminou quando failed está vazio e remaining é zero");
  });

  it("alcança as telas da pessoa e sabe o que fica de fora", () => {
    expect(prompt).toContain("Você alcança tudo o que a pessoa faz nas telas de Hoje, Finanças, Contas");
    expect(prompt).toContain("Fora do seu alcance ficam só perfil, senha, sessões de acesso, usuários, os provedores de IA");
    expect(prompt).toContain("consultar_contas lista todas");
    expect(prompt).toContain("ignorar_linhas tira da conferência");
    expect(prompt).toContain("desfazer_pagamento desfaz um registrado à mão");
    expect(prompt).toContain("consultar_notificacoes");
  });
});
