import { describe, expect, it } from "vitest";
import { juntarArquivos, paraOPedido, tamanhoDoAnexo, type AnexoPendente } from "./anexos";

const arquivo = (nome: string, bytes: number) => new File([new Uint8Array(bytes)], nome);
const pendente = (nome: string, size = 10): AnexoPendente => ({ name: nome, mediaType: "text/csv", size, content: "AA==" });

describe("anexos do chat", () => {
  it("recusa o que não pode anexar e diz o motivo", async () => {
    expect((await juntarArquivos([arquivo("virus.exe", 10)], [])).erro).toContain("não pode ser anexado");
    expect((await juntarArquivos([arquivo("vazio.csv", 0)], [])).erro).toContain("vazio");
    expect((await juntarArquivos([arquivo("grande.csv", 6 * 1024 * 1024)], [])).erro).toContain("passa de");
  });

  it("segura em 5 arquivos por mensagem e não repete o mesmo", async () => {
    const cinco = ["a", "b", "c", "d", "e"].map((nome) => pendente(`${nome}.csv`));
    const cheio = await juntarArquivos([arquivo("f.csv", 10)], cinco);
    expect(cheio.anexos).toHaveLength(5);
    expect(cheio.erro).toContain("até 5");
    expect((await juntarArquivos([arquivo("a.csv", 10)], cinco)).anexos).toHaveLength(5);
  });

  it("manda no pedido só nome, tipo e conteúdo, e escreve o tamanho", () => {
    expect(paraOPedido([pendente("extrato.csv", 2048)])).toEqual([{ name: "extrato.csv", mediaType: "text/csv", content: "AA==" }]);
    expect(tamanhoDoAnexo(500)).toBe("500 B");
    expect(tamanhoDoAnexo(2048)).toBe("2 KB");
    expect(tamanhoDoAnexo(3 * 1024 * 1024)).toBe("3.0 MB");
  });
});
