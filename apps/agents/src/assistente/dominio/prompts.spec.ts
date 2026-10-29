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
    expect(prompt).toContain("Depois de executado, confira com consultar_mes_financeiro");
    expect(prompt).toContain("Hoje é 2026-10-28, no fuso America/Sao_Paulo. Você conversa com Ana.");
  });

  it("pensa como consultor e conhece as convenções do dinheiro", () => {
    expect(prompt).toContain("Pense como um consultor financeiro, não como quem só executa");
    expect(prompt).toContain("o sistema mostra as datas reais e a sobra do mês antes e depois");
    expect(prompt).toContain("Pagamento nunca cai em fim de semana ou feriado");
    expect(prompt).toContain("Dinheiro guardado (reserva, investimento, poupança para um objetivo): não é gasto");
  });

  it("todo valor vai numa sessão que combina, e compromisso da agenda não guarda valor", () => {
    expect(prompt).toContain("Todo valor em dinheiro é um lançamento e fica numa sessão");
    expect(prompt).toContain("O compromisso da agenda não guarda valor");
    expect(prompt).toContain("Nunca use uma sessão sem relação com o valor só porque é a única");
    expect(prompt).toContain('o plano cria o compromisso ligado ao lançamento (entryId "@passo:N")');
  });

  it("trata o extrato pela categoria e exige a escolha quando o valor diverge", () => {
    expect(prompt).toContain("não lance uma série como única");
    expect(prompt).toContain('mande cruzar_linha com valor "extrato" ou "lancamento"');
    expect(prompt).toContain("Não associe extra a saída");
    expect(prompt).toContain("o valor do extrato é o daquele mês");
  });

  it("só propõe a divisão da sobra das metas, e as preferências entram por último", () => {
    expect(prompt).toContain("quem aprova cada parte é a pessoa, na tela de Metas, e você não tem como aprovar");
    expect(prompt).toContain("ofereça ajuda para organizar o financeiro");
    expect(prompt).not.toContain("Preferências da pessoa");
    expect(promptDoConsultor(contexto, "  fale com emojis ").endsWith("Preferências da pessoa (siga quando não conflitar com as regras acima): fale com emojis")).toBe(true);
  });
});
