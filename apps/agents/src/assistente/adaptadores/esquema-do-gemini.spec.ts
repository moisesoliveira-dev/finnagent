import { toJsonSchema } from "@langchain/core/utils/json_schema";
import { ESQUEMA_PERGUNTAR, ESQUEMA_PLANO, FERRAMENTA_PERGUNTAR, FERRAMENTA_PLANO, FERRAMENTAS_DO_ASSISTENTE } from "@finnagent/contracts";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { esquemaParaGemini, ferramentasDoGemini, restaurarJson } from "./esquema-do-gemini.js";

const TODAS = [
  ...FERRAMENTAS_DO_ASSISTENTE.map((item) => ({ name: item.nome, description: item.descricao, schema: item.esquema })),
  { name: FERRAMENTA_PERGUNTAR, description: "Pergunta.", schema: ESQUEMA_PERGUNTAR },
  { name: FERRAMENTA_PLANO, description: "Plano.", schema: ESQUEMA_PLANO },
];

// O que o Schema do Gemini (subconjunto do OpenAPI) lê. Qualquer outra chave pode fazer a API recusar o pedido.
const CHAVES = new Set(["type", "format", "description", "nullable", "enum", "properties", "required", "items", "minItems", "maxItems", "minimum", "maximum", "anyOf"]);

function chavesDe(no: unknown, achadas: Set<string>) {
  if (!no || typeof no !== "object") return;
  for (const [chave, valor] of Object.entries(no)) {
    achadas.add(chave);
    if (chave === "properties") for (const filho of Object.values(valor as object)) chavesDe(filho, achadas);
    else if (chave === "items") chavesDe(valor, achadas);
    else if (chave === "anyOf") for (const filho of valor as unknown[]) chavesDe(filho, achadas);
  }
}

function objetosSemPropriedades(no: unknown, caminho = ""): string[] {
  if (!no || typeof no !== "object") return [];
  const atual = no as Record<string, unknown>;
  const aqui = atual.type === "object" && caminho && !Object.keys((atual.properties as object) ?? {}).length ? [caminho] : [];
  const filhos = Object.entries((atual.properties as Record<string, unknown>) ?? {}).flatMap(([nome, filho]) =>
    objetosSemPropriedades(filho, `${caminho}.${nome}`),
  );
  return [...aqui, ...filhos, ...(atual.items ? objetosSemPropriedades(atual.items, `${caminho}[]`) : [])];
}

describe("esquema das ferramentas para o Gemini", () => {
  const { tools, emTexto } = ferramentasDoGemini(TODAS);

  it("converte todas as ferramentas do assistente", () => {
    expect(tools).toHaveLength(TODAS.length);
    expect(tools.length).toBeGreaterThan(50);
  });

  it("não deixa nenhuma chave que o Gemini recusa, nem objeto sem propriedades dentro dos argumentos", () => {
    const achadas = new Set<string>();
    for (const tool of tools) chavesDe(tool.function.parameters, achadas);
    expect([...achadas].filter((chave) => !CHAVES.has(chave))).toEqual([]);
    expect(tools.flatMap((tool) => objetosSemPropriedades(tool.function.parameters).map((c) => `${tool.function.name}${c}`))).toEqual([]);
    const texto = JSON.stringify(tools);
    for (const proibida of ["propertyNames", "exclusiveMinimum", '"uuid"', "additionalProperties", "$ref", "$schema", "pattern", "const"]) {
      expect(texto, proibida).not.toContain(proibida);
    }
  });

  it("os argumentos de cada passo do plano vão como texto com JSON e voltam como objeto", () => {
    expect(emTexto.get(FERRAMENTA_PLANO)).toEqual([["passos", "*", "args"]]);
    const plano = { objetivo: "x", passos: [{ ferramenta: "criar_grupo", descricao: "Criar", args: '{"name":"Casa"}' }] };
    expect(restaurarJson(plano, emTexto.get(FERRAMENTA_PLANO) ?? [])).toEqual({
      objetivo: "x",
      passos: [{ ferramenta: "criar_grupo", descricao: "Criar", args: { name: "Casa" } }],
    });
    expect(restaurarJson({ passos: [{ args: "não é json" }] }, [["passos", "*", "args"]])).toEqual({ passos: [{ args: "não é json" }] });
  });

  it("troca o mínimo exclusivo do inteiro pelo mínimo, o uuid por uma dica e o nulo por nullable", () => {
    const { esquema } = esquemaParaGemini(
      toJsonSchema(
        z.object({
          cents: z.number().int().positive(),
          id: z.uuid(),
          nota: z.string().nullable(),
          tipo: z.union([z.literal("a"), z.literal("b")]),
        }),
      ),
    );
    expect(esquema).toMatchObject({
      type: "object",
      properties: {
        cents: { type: "integer", minimum: 1 },
        id: { type: "string", description: "Um id (UUID)." },
        nota: { type: "string", nullable: true },
        tipo: { type: "string", enum: ["a", "b"] },
      },
    });
  });
});
