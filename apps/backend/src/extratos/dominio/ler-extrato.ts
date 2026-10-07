import { LIMITE_EXTRATO_BYTES, type FormatoExtrato, type LinhaExtrato, type MapeamentoExtrato } from "@finnagent/contracts";

const MENSAGEM_COLUNAS = "Colunas não reconhecidas. Revise o mapeamento e tente de novo.";

export type LeituraExtrato = {
  status: "importado" | "com_erros" | "falhou";
  message: string;
  startDate: string | null;
  endDate: string | null;
  lines: LinhaExtrato[];
};

export type ArquivoLido = {
  format: FormatoExtrato;
  columns: string[];
  mapping: MapeamentoExtrato | null;
  leitura: LeituraExtrato;
};

type LinhaCsv = { line: number; cells: string[] };

export function formatoDoNome(filename: string): FormatoExtrato | null {
  const nome = filename.trim().toLowerCase();
  if (nome.endsWith(".ofx")) return "ofx";
  if (nome.endsWith(".csv")) return "csv";
  return null;
}

export function nomeDoArquivo(filename: string) {
  const base = filename.split(/[/\\]/).pop()?.trim() ?? "";
  return base.slice(0, 180);
}

export function bytesDoConteudo(content: string): Buffer | "grande" | "invalido" {
  const limpo = content.replace(/\s/g, "");
  const maximo = Math.ceil(LIMITE_EXTRATO_BYTES / 3) * 4 + 4;
  if (limpo.length > maximo) return "grande";
  if (!limpo || !/^[A-Za-z0-9+/]+={0,2}$/.test(limpo)) return "invalido";
  const bytes = Buffer.from(limpo, "base64");
  if (bytes.length === 0) return "invalido";
  if (bytes.length > LIMITE_EXTRATO_BYTES) return "grande";
  return bytes;
}

export function lerArquivo(
  bytes: Buffer,
  filename: string,
  mapping: MapeamentoExtrato | null,
): ArquivoLido | { message: string } {
  const format = formatoDoNome(filename);
  if (!format) return { message: "Envie um arquivo OFX ou CSV." };
  const texto = textoDoArquivo(bytes);
  if (format === "ofx") {
    const lines = lerOfx(texto);
    return {
      format,
      columns: [],
      mapping: null,
      leitura: concluir(lines, lines.length ? null : "Não foi possível ler o OFX."),
    };
  }
  const preparado = prepararCsv(texto);
  if (!preparado.data.length) {
    return {
      format,
      columns: preparado.columns,
      mapping,
      leitura: concluir([], MENSAGEM_COLUNAS),
    };
  }
  const escolhido = mapping ?? sugerirMapeamento(preparado.columns);
  if (!colunasReconhecidas(preparado.data, escolhido)) {
    return {
      format,
      columns: preparado.columns,
      mapping: escolhido,
      leitura: concluir([], MENSAGEM_COLUNAS),
    };
  }
  const lines = preparado.data.map((row) => linhaCsv(row, escolhido));
  return { format, columns: preparado.columns, mapping: escolhido, leitura: concluir(lines, null) };
}

function concluir(lines: LinhaExtrato[], falha: string | null): LeituraExtrato {
  if (falha || lines.length === 0) {
    return {
      status: "falhou",
      message: falha ?? "Não foi possível ler o arquivo.",
      startDate: null,
      endDate: null,
      lines: [],
    };
  }
  const datas = lines.flatMap((linha) => (linha.date ? [linha.date] : [])).sort();
  const errorCount = lines.filter((linha) => linha.error).length;
  return {
    status: errorCount ? "com_erros" : "importado",
    message: "",
    startDate: datas[0] ?? null,
    endDate: datas[datas.length - 1] ?? null,
    lines,
  };
}

function textoDoArquivo(bytes: Buffer) {
  const cabeca = bytes.subarray(0, 500).toString("latin1");
  const charset = /CHARSET:(\d+|[\w-]+)/i.exec(cabeca)?.[1]?.toLowerCase();
  if (charset === "1252" || charset === "iso-8859-1" || charset === "latin1") {
    return bytes.toString("latin1");
  }
  return bytes.toString("utf8").replace(/^\uFEFF/, "");
}

function lerOfx(texto: string) {
  const lines: LinhaExtrato[] = [];
  const marcas = texto.matchAll(/<STMTTRN>/gi);
  for (const marca of marcas) {
    const inicio = marca.index ?? 0;
    const resto = texto.slice(inicio + marca[0].length);
    const fimRelativo = resto.search(/<\/STMTTRN>|<STMTTRN>/i);
    const bloco = fimRelativo >= 0 ? resto.slice(0, fimRelativo) : resto;
    const line = texto.slice(0, inicio).split(/\r\n|\n|\r/).length;
    lines.push(linhaDe(line, dataDe(campo(bloco, "DTPOSTED")), campo(bloco, "MEMO") || campo(bloco, "NAME"), campo(bloco, "TRNAMT")));
  }
  return lines;
}

function campo(bloco: string, nome: string) {
  return new RegExp(`<${nome}>([^<\\r\\n]*)`, "i").exec(bloco)?.[1]?.trim() ?? "";
}

function prepararCsv(texto: string) {
  const rows = lerCsv(texto);
  if (!rows.length) return { columns: [] as string[], data: [] as LinhaCsv[] };
  const cabecalho = rows[0].cells.some((cell) => dataDe(cell)) ? null : rows[0];
  const data = cabecalho ? rows.slice(1) : rows;
  const largura = rows.reduce((maximo, row) => Math.max(maximo, row.cells.length), 0);
  const columns = Array.from({ length: largura }, (_, index) => cabecalho?.cells[index]?.trim() || nomeColuna(index));
  return { columns, data };
}

function sugerirMapeamento(columns: string[]): MapeamentoExtrato {
  const indice = (chaves: string[]) =>
    columns.findIndex((nome) => chaves.some((chave) => nome.toLowerCase().includes(chave)));
  const date = indice(["data", "date"]);
  const description = indice(["descri", "histor", "memo", "nome"]);
  const amount = indice(["valor", "amount", "value"]);
  const ultimo = Math.max(columns.length - 1, 0);
  return {
    date: date >= 0 ? date : 0,
    description: description >= 0 ? description : Math.min(1, ultimo),
    amount: amount >= 0 ? amount : Math.min(2, ultimo),
  };
}

function colunasReconhecidas(rows: LinhaCsv[], mapping: MapeamentoExtrato) {
  return rows.some((row) =>
    [mapping.date, mapping.description, mapping.amount].some((index) => (row.cells[index] ?? "").trim() !== ""),
  );
}

function linhaCsv(row: LinhaCsv, mapping: MapeamentoExtrato) {
  return linhaDe(
    row.line,
    dataDe(row.cells[mapping.date] ?? ""),
    (row.cells[mapping.description] ?? "").trim(),
    row.cells[mapping.amount] ?? "",
  );
}

function linhaDe(line: number, date: string | null, description: string, amount: string): LinhaExtrato {
  const valor = centavosDe(amount);
  return {
    line,
    date,
    description,
    cents: date && !valor.error ? valor.cents : null,
    error: date ? valor.error : "Data inválida",
  };
}

function lerCsv(texto: string) {
  const fonte = texto.replace(/^\uFEFF/, "");
  const delimitador = delimitadorDe(fonte);
  const rows: LinhaCsv[] = [];
  let cells: string[] = [];
  let cell = "";
  let quoted = false;
  let line = 1;
  let inicio = 1;
  const fechar = () => {
    cells.push(cell);
    if (cells.some((item) => item.trim() !== "")) rows.push({ line: inicio, cells });
    cells = [];
    cell = "";
    inicio = line;
  };
  for (let index = 0; index < fonte.length; index += 1) {
    const char = fonte[index];
    if (quoted) {
      if (char === '"') {
        if (fonte[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else quoted = false;
      } else cell += char;
      continue;
    }
    if (char === '"') {
      quoted = true;
      continue;
    }
    if (char === delimitador) {
      cells.push(cell);
      cell = "";
      continue;
    }
    if (char === "\n" || char === "\r") {
      if (char === "\r" && fonte[index + 1] === "\n") index += 1;
      line += 1;
      fechar();
      continue;
    }
    cell += char;
  }
  cells.push(cell);
  if (cells.some((item) => item.trim() !== "")) rows.push({ line: inicio, cells });
  return rows;
}

function delimitadorDe(texto: string) {
  const primeira = texto.split(/\r\n|\n|\r/, 1)[0] ?? "";
  const virgulas = primeira.split(",").length;
  const pontos = primeira.split(";").length;
  return pontos > virgulas ? ";" : ",";
}

function nomeColuna(index: number) {
  let resto = index;
  let nome = "";
  do {
    nome = String.fromCharCode(65 + (resto % 26)) + nome;
    resto = Math.floor(resto / 26) - 1;
  } while (resto >= 0);
  return `Coluna ${nome}`;
}

function dataDe(valor: string) {
  const texto = valor.trim();
  if (/^\d{8}/.test(texto) && !texto.includes("/") && !texto.includes("-")) {
    return dataValida(texto.slice(0, 4), texto.slice(4, 6), texto.slice(6, 8));
  }
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(texto);
  if (iso) return dataValida(iso[1], iso[2], iso[3]);
  const br = /^(\d{2})[\/\-.](\d{2})[\/\-.](\d{4})$/.exec(texto);
  if (br) return dataValida(br[3], br[2], br[1]);
  return null;
}

function dataValida(ano: string, mes: string, dia: string) {
  const year = Number(ano);
  const month = Number(mes);
  const day = Number(dia);
  if (month < 1 || month > 12 || day < 1) return null;
  if (day > new Date(year, month, 0).getDate()) return null;
  return `${ano}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function centavosDe(valor: string) {
  const texto = valor.trim();
  if (!texto) return { cents: null, error: "Valor ausente" };
  let negativo = false;
  let limpo = texto.replace(/\s/g, "").replace(/^R\$/i, "");
  if (limpo.startsWith("(") && limpo.endsWith(")")) {
    negativo = true;
    limpo = limpo.slice(1, -1);
  }
  if (limpo.startsWith("-") || limpo.startsWith("−")) {
    negativo = true;
    limpo = limpo.slice(1);
  } else if (limpo.startsWith("+")) limpo = limpo.slice(1);
  if (!limpo) return { cents: null, error: "Valor ausente" };
  const virgula = limpo.lastIndexOf(",");
  const ponto = limpo.lastIndexOf(".");
  let normal = limpo;
  if (virgula >= 0 && ponto >= 0) {
    normal = virgula > ponto ? limpo.replace(/\./g, "").replace(",", ".") : limpo.replace(/,/g, "");
  } else if (virgula >= 0) normal = limpo.replace(",", ".");
  else if ((limpo.match(/\./g) ?? []).length > 1) normal = limpo.replace(/\./g, "");
  if (!/^\d+(\.\d+)?$/.test(normal)) return { cents: null, error: "Valor inválido" };
  const [inteiro, fracao = ""] = normal.split(".");
  let cents = Number(inteiro) * 100 + Number(fracao.padEnd(2, "0").slice(0, 2));
  if (fracao[2] && fracao[2] >= "5") cents += 1;
  if (!Number.isSafeInteger(cents) || cents > 2_000_000_000) return { cents: null, error: "Valor inválido" };
  return { cents: negativo && cents !== 0 ? -cents : cents, error: "" };
}
