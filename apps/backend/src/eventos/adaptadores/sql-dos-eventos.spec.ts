import type { FiltroDeEventos } from "@finnagent/contracts";
import { describe, expect, it } from "vitest";
import { condicoes, escaparLike, eventosDoTenant, ondeNoHistorico } from "./sql-dos-eventos.js";

const semFiltro: FiltroDeEventos = { pagina: 1, categoria: null, status: null, q: "", dia: null };

describe("SQL dos eventos", () => {
  it("sem filtro não tem WHERE", () => {
    expect(condicoes(semFiltro).sql).toBe("");
  });

  it("cada contagem tira o próprio filtro e mantém os outros", () => {
    const filtro = { ...semFiltro, categoria: "agenda", status: "concluído", dia: "2026-10-28" } as const;
    expect(condicoes(filtro).values).toEqual(["agenda", "concluído", "2026-10-28"]);
    expect(condicoes(filtro, { ignorar: "categoria" }).values).toEqual(["concluído", "2026-10-28"]);
    expect(condicoes(filtro, { ignorar: "status" }).values).toEqual(["agenda", "2026-10-28"]);
    expect(condicoes(filtro, { ignorar: "dia", desde: "2026-09-29" }).values).toEqual(["agenda", "concluído", "2026-09-29"]);
    expect(condicoes(filtro, { ignorar: "dia", desde: "2026-09-29" }).sql).toContain("dia >= ?::date");
  });

  it("busca no texto da tela com o LIKE escapado; o id só entra quando o texto parece id", () => {
    const texto = condicoes({ ...semFiltro, q: "50%_Off" });
    expect(texto.sql).toContain("lower(operation || ' ' || agregado || ' ' || origem) LIKE ?");
    expect(texto.sql).not.toContain("payload");
    expect(texto.values).toEqual(["%50\\%\\_off%"]);
    expect(escaparLike("a\\b")).toBe("a\\\\b");

    const id = condicoes({ ...semFiltro, q: "5fe79bad-53" });
    expect(id.values).toEqual([
      "%5fe79bad-53%",
      "5fe79bad-53%",
      '%"id":"5fe79bad-53%',
      '%"statementId":"5fe79bad-53%',
      '%"userId":"5fe79bad-53%',
    ]);
  });

  it("aspas na busca não deixam o padrão passar do id para os campos mascarados", () => {
    const { sql, values } = condicoes({ ...semFiltro, q: '5fe79bad","conta":"1' });
    expect(sql).not.toContain("payload");
    expect(sql).not.toContain("id ILIKE");
    expect(values).toEqual(['%5fe79bad","conta":"1%']);
  });

  it("todo evento sai filtrado pelo tenant, e o fuso entra como parâmetro", () => {
    const consulta = eventosDoTenant("tenant-1", "America/Manaus", condicoes(semFiltro));
    expect(consulta.sql).toContain("WHERE o.tenant_id = ?");
    expect(consulta.values).toContain("tenant-1");
    expect(consulta.values).toContain("America/Manaus");
    expect(consulta.sql).not.toContain("America/Manaus");
  });

  it("o histórico filtra o tenant, a retenção e o tipo", () => {
    const { sql, values } = ondeNoHistorico("tenant-1", "lanc", new Date("2026-07-30T12:00:00.000Z"));
    expect(sql).toBe(
      "WHERE c.tenant_id = ? AND c.consumed_at >= (?::timestamptz AT TIME ZONE 'UTC') AND lower(o.operation) LIKE ?",
    );
    expect(values).toEqual(["tenant-1", "2026-07-30T12:00:00.000Z", "%lanc%"]);
    expect(ondeNoHistorico("tenant-1", "", null).values).toEqual(["tenant-1"]);
  });
});
