import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { GRUPO_DA_CONTA, SESSAO_DAS_SOBRAS, sobrasALevar } from "@finnagent/contracts";
import { FinancasService } from "../../financas/aplicacao/financas.service.js";
import { GruposService } from "../../grupos/aplicacao/grupos.service.js";

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/**
 * A sobra de cada mês entra no mês seguinte como um lançamento na sessão "Sobras" do grupo "Conta": entrada quando
 * sobrou, saída quando faltou, no dia 1. O valor é a sobra acumulada até o mês anterior, então cada mês já começa
 * com o que veio de antes. O sistema cria, corrige e apaga esses lançamentos sozinho, sempre que um lançamento muda.
 */
@Injectable()
export class SobrasService {
  constructor(
    private readonly financas: FinancasService,
    private readonly grupos: GruposService,
  ) {}

  async atualizar(tenantId: string) {
    const [{ workflow, entries }, hoje] = await Promise.all([this.financas.listar(tenantId), this.financas.hoje(tenantId)]);
    const levadas = new Map(entries.filter((entry) => entry.carryOf).map((entry) => [entry.carryOf as string, entry]));
    const devidas = sobrasALevar(entries, workflow, hoje);
    let sessionId: string | null = null;
    let mudou = 0;
    for (const { de, para, cents } of devidas) {
      const atual = levadas.get(de);
      levadas.delete(de);
      const certo = atual && atual.cents === cents && atual.date === `${para}-01`;
      if (certo) continue;
      if (atual) await this.financas.excluir(tenantId, atual.id);
      if (cents === 0) {
        if (atual) mudou += 1;
        continue;
      }
      sessionId ??= await this.sessaoDasSobras(tenantId);
      const nomeDoMes = MESES[Number(de.slice(5, 7)) - 1] ?? de;
      await this.financas.registrar(tenantId, {
        id: randomUUID(),
        sessionId,
        name: `${cents > 0 ? "Sobra" : "Falta"} de ${nomeDoMes} de ${de.slice(0, 4)}`,
        description: "",
        justification: "Calculada pelo sistema: o que sobrou de todos os meses até aqui.",
        date: `${para}-01`,
        mode: cents > 0 ? "inflows" : "outflows",
        status: "completed",
        transactionType: "unusual",
        category: "unique",
        priority: "nopriority",
        cents: Math.abs(cents),
        installments: null,
        installmentNumber: null,
        dueDate: null,
        interestRate: null,
        nextDueDate: null,
        recurrence: null,
        recurrenceInterval: null,
        dueRule: null,
        carryOf: de,
      });
      mudou += 1;
    }
    // O mês que deixou de existir (o início do workflow andou para frente) perde a sobra levada.
    for (const sobra of levadas.values()) {
      await this.financas.excluir(tenantId, sobra.id);
      mudou += 1;
    }
    return { mudou };
  }

  private async sessaoDasSobras(tenantId: string) {
    const { groups, sessions } = await this.grupos.listar(tenantId);
    const grupo = groups.find((item) => item.name.toLowerCase() === GRUPO_DA_CONTA.toLowerCase());
    const groupId = grupo?.id ?? (await this.grupos.criarGrupo(tenantId, randomUUID(), GRUPO_DA_CONTA, "As sobras de cada mês e uma sessão por caixinha.")).id;
    const aberta = sessions.find((item) => item.groupId === groupId && item.name.toLowerCase() === SESSAO_DAS_SOBRAS.toLowerCase() && !item.endedAt);
    if (aberta) return aberta.id;
    const sessionId = randomUUID();
    await this.grupos.criarSessao(
      tenantId,
      sessionId,
      { groupId, name: SESSAO_DAS_SOBRAS, description: "", justification: "A sobra de cada mês, levada para o mês seguinte." },
      "acumulo",
    );
    return sessionId;
  }
}
