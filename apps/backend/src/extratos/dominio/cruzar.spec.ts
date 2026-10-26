import { describe, expect, it } from "vitest";
import type { Lancamento, Ocorrencia } from "@finnagent/contracts";
import {
  candidatosDaLinha,
  cruzaveisDoMes,
  propostaDaLinha,
  type LancamentoCruzavel,
} from "./cruzar.js";

const aluguel: LancamentoCruzavel = {
  entryId: "aluguel",
  description: "Aluguel",
  groupName: "Casa",
  sessionName: "Moradia",
  sessionId: "moradia",
  day: 1,
  cents: -180000,
  vagas: 1,
};

function ocorrencia(number: number, dueDate: string, status: Ocorrencia["status"] = "pending"): Ocorrencia {
  return { number, dueDate, plannedCents: -5000, paidCents: null, paidOn: null, status };
}

function lancamento(id: string, occurrences: Ocorrencia[]) {
  return {
    id,
    name: id,
    description: "",
    groupName: "Casa",
    sessionName: "Moradia",
    sessionId: "moradia",
    occurrences,
  } as unknown as Lancamento;
}

describe("candidatos do cruzamento", () => {
  it("lista só o mesmo sinal, com o valor exato primeiro e depois o dia mais perto", () => {
    const luz = { ...aluguel, entryId: "luz", description: "Luz", day: 2, cents: -20000 };
    const salario = { ...aluguel, entryId: "salario", description: "Salário", cents: 500000 };
    const outro = { ...aluguel, entryId: "outro", description: "Outro", day: 20 };
    const lista = candidatosDaLinha({ date: "2026-08-02", cents: -180000 }, [luz, salario, outro, aluguel]);
    expect(lista.map((item) => item.entryId)).toEqual(["aluguel", "outro", "luz"]);
  });

  it("tira o lançamento que já ocupou as ocorrências do mês", () => {
    const lista = candidatosDaLinha({ date: "2026-08-02", cents: -180000 }, [{ ...aluguel, vagas: 0 }]);
    expect(lista).toEqual([]);
  });

  it("conta as vagas pelas ocorrências do mês já cruzadas", () => {
    const entries = [
      lancamento("mercado", [ocorrencia(1, "2026-08-05"), ocorrencia(2, "2026-08-20"), ocorrencia(3, "2026-09-05")]),
      lancamento("cancelado", [ocorrencia(1, "2026-08-05", "cancelled")]),
    ];
    const lista = cruzaveisDoMes(entries, ["mercado", null], 2026, 8);
    expect(lista).toHaveLength(1);
    expect(lista[0]).toMatchObject({ entryId: "mercado", vagas: 1, day: 5, cents: -5000 });
  });
});

describe("proposta do cruzamento", () => {
  it("propõe o lançamento com o mesmo valor e o dia próximo", () => {
    const proposta = propostaDaLinha({ date: "2026-08-02", cents: -180000 }, [aluguel], undefined);
    expect(proposta).toMatchObject({ source: "valor", suggestion: { entryId: "aluguel" } });
  });

  it("não propõe quando há dois lançamentos possíveis ou o valor não bate", () => {
    const outro = { ...aluguel, entryId: "outro", day: 3 };
    expect(propostaDaLinha({ date: "2026-08-01", cents: -180000 }, [aluguel, outro], undefined)).toBeNull();
    expect(propostaDaLinha({ date: "2026-08-01", cents: -100 }, [aluguel], undefined)).toBeNull();
    expect(propostaDaLinha({ date: "2026-08-20", cents: -180000 }, [aluguel], undefined)).toBeNull();
  });

  it("prefere o lançamento lembrado pelo nome, mesmo com valor diferente", () => {
    const luz = { ...aluguel, entryId: "luz", description: "Luz", cents: -20000 };
    const proposta = propostaDaLinha({ date: "2026-08-01", cents: -18000 }, [aluguel, luz], {
      entryId: "luz",
      sessionId: "moradia",
    });
    expect(proposta).toMatchObject({ source: "nome", suggestion: { entryId: "luz" } });
  });

  it("cai no valor quando o lançamento lembrado não está livre no mês", () => {
    const proposta = propostaDaLinha({ date: "2026-08-01", cents: -180000 }, [aluguel], {
      entryId: "luz",
      sessionId: "moradia",
    });
    expect(proposta?.source).toBe("valor");
  });
});
