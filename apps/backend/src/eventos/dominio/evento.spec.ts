import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ESQUEMA_FILTRO_DE_EVENTOS,
  ESQUEMA_FILTRO_DO_HISTORICO,
  OPERACOES_DE_EVENTO,
  eventoDaLinha,
  historicoDoEvento,
  type LinhaOutbox,
} from "@finnagent/contracts";
import { describe, expect, it } from "vitest";

function linha(parcial: Partial<LinhaOutbox> & Pick<LinhaOutbox, "id" | "operation">): LinhaOutbox {
  return {
    idempotencyKey: `${parcial.id}:chave`,
    payload: "{}",
    occurredAt: "2026-10-08T09:00:00.000Z",
    publishedAt: "2026-10-08T09:00:01.000Z",
    consumedAt: null,
    ...parcial,
  };
}

describe("evento da outbox", () => {
  it("deriva pendente, processando e concluído, com categoria, origem e agregado", () => {
    const pendente = eventoDaLinha(
      linha({
        id: "a",
        operation: "criar-lancamento",
        publishedAt: null,
        payload: JSON.stringify({ id: "lan-1", valor_centavos: -4500 }),
      }),
    );
    const processando = eventoDaLinha(
      linha({ id: "b", operation: "importar-extrato", payload: JSON.stringify({ statementId: "ext-1" }) }),
    );
    const concluido = eventoDaLinha(
      linha({ id: "c", operation: "criar-compromisso", consumedAt: "2026-10-08T09:00:03.500Z" }),
    );

    expect([pendente, processando, concluido].map((evento) => [evento.status, evento.category, evento.origin])).toEqual([
      ["pendente", "financeiro", "sistema"],
      ["processando", "extratos", "importação"],
      ["concluído", "agenda", "sistema"],
    ]);
    expect(pendente.aggregate).toBe("Lançamento · lan-1");
    expect(pendente.payload).toEqual({ id: "lan-1", valor_centavos: -4500 });
    expect(processando.aggregate).toBe("Extrato · ext-1");
    expect(concluido).toMatchObject({
      publishedAt: "2026-10-08T09:00:01.000Z",
      consumedAt: "2026-10-08T09:00:03.500Z",
      correlationId: null,
      schemaVersion: 1,
    });
  });

  it("só tem histórico depois de consumido, com o tempo entre publicar e consumir", () => {
    expect(historicoDoEvento(eventoDaLinha(linha({ id: "a", operation: "criar-grupo" })))).toEqual([]);
    expect(
      historicoDoEvento(eventoDaLinha(linha({ id: "c", operation: "criar-compromisso", consumedAt: "2026-10-08T09:00:03.500Z" }))),
    ).toEqual([
      {
        eventId: "c",
        eventType: "criar-compromisso",
        consumer: "Publicar outbox",
        result: "sucesso",
        attempt: 1,
        durationMs: 2500,
        occurredAt: "2026-10-08T09:00:03.500Z",
        error: "",
      },
    ]);
  });

  it("mascara segredo, número de conta e dígitos longos, e ignora payload inválido", () => {
    const desconhecido = eventoDaLinha(
      linha({
        id: "s",
        operation: "desconhecida",
        payload: JSON.stringify({ token: "abc", conta: "12345678", nome: "Mercado", valor_centavos: -12840 }),
      }),
    );
    expect(desconhecido.category).toBe("sistema");
    expect(desconhecido.aggregate).toBe("Registro");
    expect(desconhecido.payload).toEqual({ token: "••••", conta: "••••", nome: "Mercado", valor_centavos: -12840 });

    const invalido = eventoDaLinha(linha({ id: "v", operation: "definir-workflow", payload: "não é json" }));
    expect(invalido.payload).toEqual({});
    expect(invalido.aggregate).toBe("Fluxo");

    const cruzamento = eventoDaLinha(
      linha({ id: "x", operation: "cruzar-linha", payload: JSON.stringify({ id: "linha-1", documento: "123456" }) }),
    );
    expect(cruzamento).toMatchObject({ category: "extratos", origin: "sistema", payload: { id: "linha-1", documento: "••••" } });
  });

  it("dá categoria às operações de conta, do assistente, da IA e do extrato", () => {
    const categoria = (operation: string, payload = "{}") => {
      const evento = eventoDaLinha(linha({ id: operation, operation, payload }));
      return [evento.category, evento.aggregate];
    };
    expect(categoria("abrir-sessao", JSON.stringify({ userId: "u-1" }))).toEqual(["conta", "Acesso · u-1"]);
    expect(categoria("trocar-senha")).toEqual(["conta", "Acesso"]);
    expect(categoria("criar-usuario", JSON.stringify({ id: "u-2", tenantId: "t" }))).toEqual(["conta", "Usuário · u-2"]);
    expect(categoria("registrar-mensagem-do-assistente")).toEqual(["agente", "Mensagem"]);
    expect(categoria("criar-conversa")).toEqual(["agente", "Conversa"]);
    expect(categoria("atualizar-provedor-de-ia")).toEqual(["configuracoes", "Provedor de IA"]);
    expect(categoria("pagar-pelo-extrato")).toEqual(["extratos", "Lançamento"]);
    expect(categoria("criar-feriado-local")).toEqual(["financeiro", "Feriado"]);
    expect(categoria("zerar-dados")).toEqual(["configuracoes", "Dados"]);
  });

  it("toda operação que o backend grava na outbox tem categoria", () => {
    const conhecidas = new Set(OPERACOES_DE_EVENTO.map((item) => item.operation));
    const gravadas = new Set<string>();
    const raiz = join(import.meta.dirname, "..", "..");
    for (const arquivo of arquivosTs(raiz)) {
      const texto = readFileSync(arquivo, "utf8");
      for (const chamada of texto.matchAll(/gravarOutbox\(([^;]{0,240})/g)) {
        for (const nome of chamada[1].matchAll(/"([a-z]+(?:-[a-z]+)+)"/g)) gravadas.add(nome[1]);
      }
      for (const nome of texto.matchAll(/operation: "([a-z]+(?:-[a-z]+)+)"/g)) gravadas.add(nome[1]);
    }
    expect(gravadas.size).toBeGreaterThan(20);
    expect([...gravadas].filter((nome) => !conhecidas.has(nome))).toEqual([]);
    expect(OPERACOES_DE_EVENTO.some((item) => item.category === "sistema")).toBe(false);
  });
});

describe("filtros pedidos", () => {
  it("trocam valor inválido pelo padrão, sem erro", () => {
    expect(ESQUEMA_FILTRO_DE_EVENTOS.parse({})).toEqual({ pagina: 1, categoria: null, status: null, q: "", dia: null });
    expect(
      ESQUEMA_FILTRO_DE_EVENTOS.parse({ pagina: "0", categoria: "inventada", status: "x", dia: "2026-02-30", q: 3 }),
    ).toEqual({ pagina: 1, categoria: null, status: null, q: "", dia: null });
    expect(
      ESQUEMA_FILTRO_DE_EVENTOS.parse({ pagina: "3", categoria: "conta", status: "concluído", dia: "2026-10-28", q: "  sessão " }),
    ).toEqual({ pagina: 3, categoria: "conta", status: "concluído", q: "sessão", dia: "2026-10-28" });
    expect(ESQUEMA_FILTRO_DO_HISTORICO.parse({ resultado: "falha", q: "x".repeat(300) })).toMatchObject({
      pagina: 1,
      resultado: "falha",
      q: "x".repeat(120),
    });
  });
});

function* arquivosTs(pasta: string): Generator<string> {
  for (const item of readdirSync(pasta, { withFileTypes: true })) {
    const caminho = join(pasta, item.name);
    if (item.isDirectory()) yield* arquivosTs(caminho);
    else if (item.name.endsWith(".ts") && !item.name.endsWith(".spec.ts")) yield caminho;
  }
}
