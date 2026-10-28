import type { FeriadoLocal } from "@finnagent/contracts";
import { describe, expect, it } from "vitest";
import { Conflito, NaoEncontrado, PedidoInvalido } from "../../grupos/dominio/erros.js";
import type { FeriadosRepositorio } from "../portas/feriados-repositorio.js";
import { FeriadosService } from "./feriados.service.js";

class Memoria implements FeriadosRepositorio {
  lista: FeriadoLocal[] = [];
  async listar() {
    return [...this.lista];
  }
  async criar(_tenantId: string, feriado: FeriadoLocal) {
    if (this.lista.some((item) => item.dia === feriado.dia && item.mes === feriado.mes)) return "repetido" as const;
    this.lista.push(feriado);
    return feriado;
  }
  async remover(_tenantId: string, id: string) {
    const antes = this.lista.length;
    this.lista = this.lista.filter((item) => item.id !== id);
    return this.lista.length < antes;
  }
}

describe("feriados locais", () => {
  it("cadastra e passa a contar no calendário da conta", async () => {
    const servico = new FeriadosService(new Memoria());
    await servico.adicionar("t", { nome: "Aniversário da cidade", dia: 25, mes: 1 });
    const calendario = await servico.calendario("t");
    expect(calendario.ehUtil("2027-01-25", "bancaria")).toBe(false);
    const { feriados, locais } = await servico.doAno("t", 2027);
    expect(locais).toHaveLength(1);
    expect(feriados.find((item) => item.data === "2027-01-25")).toMatchObject({ tipo: "local", nome: "Aniversário da cidade" });
  });

  it("aceita 29 de fevereiro e recusa dia que não existe no mês", async () => {
    const servico = new FeriadosService(new Memoria());
    await expect(servico.adicionar("t", { nome: "Bissexto", dia: 29, mes: 2 })).resolves.toMatchObject({ dia: 29 });
    await expect(servico.adicionar("t", { nome: "Não existe", dia: 31, mes: 4 })).rejects.toThrow("Esse dia não existe nesse mês.");
    await expect(servico.adicionar("t", { nome: "", dia: 1, mes: 4 })).rejects.toThrow("Dê um nome ao feriado.");
    await expect(servico.adicionar("t", { nome: "Sem mês", dia: 1 })).rejects.toBeInstanceOf(PedidoInvalido);
  });

  it("recusa dois feriados no mesmo dia e respeita o limite", async () => {
    const memoria = new Memoria();
    const servico = new FeriadosService(memoria);
    await servico.adicionar("t", { nome: "A", dia: 9, mes: 7 });
    await expect(servico.adicionar("t", { nome: "B", dia: 9, mes: 7 })).rejects.toBeInstanceOf(Conflito);
    memoria.lista = Array.from({ length: 40 }, (_, indice) => ({ id: String(indice), nome: "x", dia: (indice % 28) + 1, mes: Math.floor(indice / 28) + 1 }));
    await expect(servico.adicionar("t", { nome: "Demais", dia: 1, mes: 12 })).rejects.toThrow("Cadastre até 40 feriados locais.");
  });

  it("remove, e avisa quando não existe", async () => {
    const memoria = new Memoria();
    const servico = new FeriadosService(memoria);
    const criado = await servico.adicionar("t", { nome: "A", dia: 9, mes: 7 });
    await servico.remover("t", criado.id);
    expect(memoria.lista).toHaveLength(0);
    await expect(servico.remover("t", criado.id)).rejects.toBeInstanceOf(NaoEncontrado);
  });
});
