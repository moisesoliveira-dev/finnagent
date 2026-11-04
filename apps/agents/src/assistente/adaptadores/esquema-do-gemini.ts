import { toJsonSchema } from "@langchain/core/utils/json_schema";

type Esquema = Record<string, unknown>;

/** O caminho de um campo dentro dos argumentos. "*" é cada item de uma lista. */
export type Caminho = string[];

// O Gemini lê um subconjunto do OpenAPI: só estes formatos, sem propertyNames, exclusiveMinimum, const, pattern
// nem objeto sem propriedades. O backend valida os argumentos de novo, então o que sai daqui vira dica no texto.
const FORMATOS: Record<string, ReadonlySet<string>> = {
  string: new Set(["enum", "date-time"]),
  integer: new Set(["int32", "int64"]),
  number: new Set(["float", "double"]),
};

const DICA_DO_FORMATO: Record<string, string> = {
  uuid: "Um id (UUID).",
  date: "Data no formato AAAA-MM-DD.",
  email: "Um e-mail.",
  uri: "Uma URL.",
  url: "Uma URL.",
};

/**
 * Adapta o JSON Schema de uma ferramenta ao que o Gemini aceita. Objeto livre (um registro de chaves
 * quaisquer, como os argumentos de um passo do plano) vira texto com JSON: `emTexto` guarda esses caminhos,
 * para `restaurarJson` devolver o objeto quando o Gemini chamar a ferramenta.
 */
export function esquemaParaGemini(esquema: unknown): { esquema: Esquema; emTexto: Caminho[] } {
  const emTexto: Caminho[] = [];
  return { esquema: limpar(paraObjeto(esquema), [], emTexto), emTexto };
}

function paraObjeto(valor: unknown): Esquema {
  return valor && typeof valor === "object" && !Array.isArray(valor) ? (valor as Esquema) : {};
}

function semNulo(no: Esquema): { no: Esquema; nulo: boolean } {
  let atual = { ...no };
  let nulo = false;
  if (Array.isArray(atual.type)) {
    const tipos = atual.type.filter((tipo) => tipo !== "null");
    nulo = tipos.length !== atual.type.length;
    atual.type = tipos[0];
  }
  if (Array.isArray(atual.anyOf)) {
    const opcoes = atual.anyOf.map(paraObjeto);
    const validas = opcoes.filter((opcao) => opcao.type !== "null");
    nulo = nulo || validas.length !== opcoes.length;
    const { anyOf: _anyOf, ...resto } = atual;
    if (validas.length && validas.every((opcao) => typeof opcao.const === "string")) {
      atual = { ...resto, type: "string", enum: validas.map((opcao) => opcao.const) };
    } else if (validas.length === 1) {
      const unica = validas[0] ?? {};
      atual = { ...unica, ...resto, description: resto.description ?? unica.description };
    } else {
      atual = { ...resto, anyOf: validas };
    }
  }
  return { no: atual, nulo };
}

function limpar(original: Esquema, caminho: Caminho, emTexto: Caminho[]): Esquema {
  const { no, nulo } = semNulo(original);
  const dicas: string[] = typeof no.description === "string" && no.description ? [no.description] : [];
  const saida: Esquema = {};
  let tipo = typeof no.type === "string" ? no.type : undefined;

  if ("const" in no) {
    const valor = no.const;
    if (typeof valor === "string") {
      tipo = "string";
      saida.enum = [valor];
    } else {
      dicas.push(`Sempre ${JSON.stringify(valor)}.`);
    }
  }
  if (tipo) saida.type = tipo;

  const propriedades = paraObjeto(no.properties);
  if (tipo === "object" && Object.keys(propriedades).length === 0) {
    if (caminho.length > 0) {
      emTexto.push(caminho);
      return {
        type: "string",
        description: [...dicas, 'Um objeto JSON escrito como texto, por exemplo {"name": "Mercado"}.'].join(" "),
        ...(nulo ? { nullable: true } : {}),
      };
    }
    return { type: "object", properties: {} };
  }
  if (tipo === "object") {
    saida.properties = Object.fromEntries(
      Object.entries(propriedades).map(([nome, filho]) => [nome, limpar(paraObjeto(filho), [...caminho, nome], emTexto)]),
    );
    const requeridos = Array.isArray(no.required) ? no.required.filter((nome) => typeof nome === "string" && nome in propriedades) : [];
    if (requeridos.length) saida.required = requeridos;
  }
  if (tipo === "array" && no.items) {
    saida.items = limpar(paraObjeto(no.items), [...caminho, "*"], emTexto);
    if (typeof no.minItems === "number") saida.minItems = no.minItems;
    if (typeof no.maxItems === "number") saida.maxItems = no.maxItems;
  }
  if (Array.isArray(no.anyOf)) saida.anyOf = no.anyOf.map((opcao) => limpar(paraObjeto(opcao), caminho, emTexto));

  if (Array.isArray(no.enum)) {
    if (no.enum.every((item) => typeof item === "string")) {
      saida.type = "string";
      saida.enum = no.enum;
    } else {
      dicas.push(`Um destes valores: ${no.enum.map((item) => JSON.stringify(item)).join(", ")}.`);
    }
  }

  if (typeof no.format === "string") {
    if (tipo && FORMATOS[tipo]?.has(no.format)) saida.format = no.format;
    else if (DICA_DO_FORMATO[no.format]) dicas.push(DICA_DO_FORMATO[no.format] as string);
  }

  if (tipo === "integer" || tipo === "number") {
    const inteiro = tipo === "integer";
    if (typeof no.minimum === "number") saida.minimum = no.minimum;
    if (typeof no.maximum === "number") saida.maximum = no.maximum;
    if (typeof no.exclusiveMinimum === "number" && saida.minimum === undefined) {
      if (inteiro) saida.minimum = no.exclusiveMinimum + 1;
      else dicas.push(`Maior que ${no.exclusiveMinimum}.`);
    }
    if (typeof no.exclusiveMaximum === "number" && saida.maximum === undefined) {
      if (inteiro) saida.maximum = no.exclusiveMaximum - 1;
      else dicas.push(`Menor que ${no.exclusiveMaximum}.`);
    }
  }

  if (dicas.length) saida.description = dicas.join(" ");
  if (nulo) saida.nullable = true;
  return saida;
}

/** Devolve como objeto os campos que o Gemini recebeu como texto com JSON. */
export function restaurarJson(args: Record<string, unknown>, caminhos: Caminho[]) {
  const copia = structuredClone(args);
  for (const caminho of caminhos) restaurar(copia, caminho);
  return copia;
}

function restaurar(alvo: unknown, caminho: Caminho) {
  const [passo, ...resto] = caminho;
  if (passo === undefined || !alvo || typeof alvo !== "object") return;
  if (passo === "*") {
    if (Array.isArray(alvo)) for (const item of alvo) restaurar(item, resto);
    return;
  }
  const objeto = alvo as Record<string, unknown>;
  if (resto.length) {
    restaurar(objeto[passo], resto);
    return;
  }
  const valor = objeto[passo];
  if (typeof valor !== "string") return;
  try {
    const lido: unknown = JSON.parse(valor);
    if (lido && typeof lido === "object" && !Array.isArray(lido)) objeto[passo] = lido;
  } catch {
    // Texto que não é JSON fica como veio: o backend recusa e o consultor corrige.
  }
}

/**
 * As ferramentas no formato que o Gemini aceita, já no formato OpenAI que o LangChain repassa sem refazer o
 * esquema. `emTexto` diz, por ferramenta, quais campos voltam como texto.
 */
export function ferramentasDoGemini(ferramentas: { name: string; description: string; schema: unknown }[]) {
  const emTexto = new Map<string, Caminho[]>();
  const tools = ferramentas.map((ferramenta) => {
    const convertido = esquemaParaGemini(toJsonSchema(ferramenta.schema as Parameters<typeof toJsonSchema>[0]));
    if (convertido.emTexto.length) emTexto.set(ferramenta.name, convertido.emTexto);
    return {
      type: "function" as const,
      function: { name: ferramenta.name, description: ferramenta.description, parameters: convertido.esquema },
    };
  });
  return { tools, emTexto };
}
