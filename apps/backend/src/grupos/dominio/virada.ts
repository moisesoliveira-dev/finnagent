import type { ViradaGrupo, ViradaResposta } from "@finnagent/contracts";

export function montarVirada(
  hoje: { year: number; month: number; day: number },
  workflowYear: number,
  decidida: boolean,
  groups: ViradaGrupo[],
): ViradaResposta {
  if (decidida || hoje.year <= workflowYear) return { pendente: false };
  return { pendente: true, year: hoje.year, groups };
}

export function sessoesEncerradas(groups: ViradaGrupo[], groupIds: string[], sessionIds: string[]) {
  const grupos = new Set(groupIds);
  const sessoes = new Set(sessionIds);
  const encerrar: string[] = [];
  for (const group of groups) {
    for (const session of group.sessions) {
      if (!grupos.has(group.id) || !sessoes.has(session.id)) encerrar.push(session.id);
    }
  }
  return encerrar;
}
