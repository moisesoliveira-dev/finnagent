import { describe, expect, it } from "vitest";
import { bytesDoConteudo, lerArquivo } from "./ler-extrato.js";

const ofx = `OFXHEADER:100
<STMTTRN>
<DTPOSTED>20260902
<TRNAMT>2500.00
<MEMO>PIX RECEBIDO
</STMTTRN>
<STMTTRN>
<DTPOSTED>20260903120000
<TRNAMT>-128.40
<NAME>MERCADO CENTRAL
</STMTTRN>
`;

const csv = `Data;Descrição;Valor
02/09/2026;PIX RECEBIDO;2.500,00
03/09/2026;MERCADO CENTRAL;-128,40
;COMPRA SUPERMERCADO;-612,30
09/09/2026;PIX ENVIADO;
12/09/2026;CONTA DE LUZ;abc
`;

describe("leitura de extrato", () => {
  it("lê OFX com entrada e saída", () => {
    const lido = lerArquivo(Buffer.from(ofx), "nubank.ofx", null);
    if (!("leitura" in lido)) throw new Error(lido.message);
    expect(lido.format).toBe("ofx");
    expect(lido.leitura.status).toBe("importado");
    expect(lido.leitura.lines.map((linha) => [linha.date, linha.description, linha.cents])).toEqual([
      ["2026-09-02", "PIX RECEBIDO", 250000],
      ["2026-09-03", "MERCADO CENTRAL", -12840],
    ]);
    expect(lido.leitura.startDate).toBe("2026-09-02");
    expect(lido.leitura.endDate).toBe("2026-09-03");
  });

  it("lê CSV com cabeçalho e separa as linhas com erro", () => {
    const lido = lerArquivo(Buffer.from(csv), "itau.csv", null);
    if (!("leitura" in lido)) throw new Error(lido.message);
    expect(lido.columns).toEqual(["Data", "Descrição", "Valor"]);
    expect(lido.mapping).toEqual({ date: 0, description: 1, amount: 2 });
    expect(lido.leitura.status).toBe("com_erros");
    expect(lido.leitura.lines.map((linha) => linha.error)).toEqual([
      "",
      "",
      "Data inválida",
      "Valor ausente",
      "Valor inválido",
    ]);
    expect(lido.leitura.startDate).toBe("2026-09-02");
    expect(lido.leitura.endDate).toBe("2026-09-12");
  });

  it("falha quando o mapeamento não encontra coluna", () => {
    const lido = lerArquivo(Buffer.from(csv), "itau.csv", { date: 8, description: 8, amount: 8 });
    if (!("leitura" in lido)) throw new Error(lido.message);
    expect(lido.leitura.status).toBe("falhou");
    expect(lido.leitura.message).toBe("Colunas não reconhecidas. Revise o mapeamento e tente de novo.");
  });

  it("recusa OFX sem lançamento e conteúdo que não é arquivo", () => {
    const vazio = lerArquivo(Buffer.from("<OFX></OFX>"), "vazio.ofx", null);
    if (!("leitura" in vazio)) throw new Error(vazio.message);
    expect(vazio.leitura.status).toBe("falhou");
    expect(lerArquivo(Buffer.from("abc"), "notas.txt", null)).toEqual({
      message: "Envie um arquivo OFX ou CSV.",
    });
    expect(bytesDoConteudo("@@@")).toBe("invalido");
  });
});
