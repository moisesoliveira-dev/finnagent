import { dataDoWorkflow, interpretarConfiguracao } from "./pedido.js";

const valida = {
  name: "Casa",
  timezone: "America/Sao_Paulo",
  theme: "auto",
  workflowDate: "2026-03-01",
  personalCalendar: true,
  workCalendar: true,
  showEntries: true,
  categorize: "confirmar",
  pendingHours: 24,
  reminder: "1h",
  reminders: true,
  dueAlerts: true,
  emailAlerts: false,
  appAlerts: true,
  history: "1a",
  googleClientId: "",
  googleClientSecret: "",
  limparSegredoGoogle: false,
  googleCalendarPersonal: "",
  googleCalendarWork: "",
  aiModels: [],
  aiModel: "",
  aiApiKey: "",
  limparChaveIa: false,
  vencimentos: { fixa_entrada: "antecipar", fixa_saida: "adiar", parcela: "adiar", emprestimo: "adiar" },
  feriadosNaAgenda: true,
  facultativosNaAgenda: true,
};

describe("configurações", () => {
  it("aceita o início do workflow", () => {
    expect(dataDoWorkflow("2026-03-01")).toEqual({ year: 2026, month: 3, day: 1 });
  });

  it("recusa dia inexistente", () => {
    expect(dataDoWorkflow("2026-02-31")).toBeNull();
    expect(dataDoWorkflow("1999-01-01")).toBeNull();
  });

  it("exige o nome da conta", () => {
    expect(interpretarConfiguracao({ ...valida, name: "  " })).toBe("Informe o nome da conta.");
  });

  it("exige uma data real", () => {
    expect(interpretarConfiguracao({ ...valida, workflowDate: "2026-02-31" })).toBe("Informe uma data válida.");
  });

  it("devolve as preferências quando o pedido é válido", () => {
    expect(interpretarConfiguracao(valida)).toEqual(valida);
  });

  it("guarda os modelos cadastrados e o que fica em uso", () => {
    expect(interpretarConfiguracao({ ...valida, aiModels: [" gpt-4.1 ", "o3-mini"], aiModel: "o3-mini" })).toMatchObject({
      aiModels: ["gpt-4.1", "o3-mini"],
      aiModel: "o3-mini",
    });
  });

  it("recusa modelo que não foi cadastrado", () => {
    expect(interpretarConfiguracao({ ...valida, aiModels: ["gpt-4.1"], aiModel: "o3-mini" })).toBe(
      "Escolha qual modelo usar.",
    );
  });

  it("recusa identificador inválido", () => {
    expect(interpretarConfiguracao({ ...valida, aiModels: ["modelo com espaço"], aiModel: "" })).toBe(
      "Informe um identificador de modelo válido.",
    );
  });
});
