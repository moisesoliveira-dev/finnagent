import { describe, expect, it } from "vitest";
import { sugerirCruzamento, type LancamentoCruzavel } from "./cruzar.js";

const aluguel: LancamentoCruzavel = {
  id: "aluguel",
  description: "Aluguel",
  groupName: "Casa",
  sessionName: "Moradia",
  day: 1,
  cents: -180000,
};

describe("sugestão de cruzamento", () => {
  it("sugere o lançamento com o mesmo valor e o dia próximo", () => {
    const proposta = sugerirCruzamento({ date: "2026-08-02", cents: -180000 }, [aluguel]);
    expect(proposta?.entryId).toBe("aluguel");
  });

  it("não sugere quando há dois lançamentos possíveis ou o valor não bate", () => {
    const outro = { ...aluguel, id: "outro", day: 3 };
    expect(sugerirCruzamento({ date: "2026-08-01", cents: -180000 }, [aluguel, outro])).toBeNull();
    expect(sugerirCruzamento({ date: "2026-08-01", cents: -100 }, [aluguel])).toBeNull();
    expect(sugerirCruzamento({ date: "2026-08-20", cents: -180000 }, [aluguel])).toBeNull();
  });
});
