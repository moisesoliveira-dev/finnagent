import type { Tarefa } from "@finnagent/contracts";

/** O que muda ao marcar ou reabrir uma tarefa, considerando os ancestrais e os descendentes. */
export type MudancaDeConclusao = { id: string; doneOn: string | null };

/** Os ids dos descendentes de uma tarefa, em qualquer profundidade. */
export function descendentes(arvore: Tarefa[], id: string): string[] {
  const filhos = arvore.filter((item) => item.parentId === id).map((item) => item.id);
  return filhos.flatMap((filho) => [filho, ...descendentes(arvore, filho)]);
}

/** Os ids dos ancestrais, do pai até a raiz. */
export function ancestrais(arvore: Tarefa[], id: string): string[] {
  const lista: string[] = [];
  let atual = arvore.find((item) => item.id === id);
  while (atual?.parentId) {
    const pai = atual.parentId;
    if (lista.includes(pai)) break;
    lista.push(pai);
    atual = arvore.find((item) => item.id === pai);
  }
  return lista;
}

/**
 * Marcar uma atividade marca as subatividades abertas junto, em qualquer profundidade. Marcar a última
 * subatividade aberta fecha a atividade, e isso sobe enquanto cada ancestral ficar sem filha aberta. Reabrir uma
 * tarefa reabre os ancestrais fechados; as filhas ficam como estão.
 * `arvore` é a família inteira: a raiz e todos os descendentes dela.
 */
export function mudancasAoConcluir(arvore: Tarefa[], id: string, doneOn: string | null): MudancaDeConclusao[] {
  const alvo = arvore.find((item) => item.id === id);
  if (!alvo) return [];
  const mudancas: MudancaDeConclusao[] = [{ id, doneOn }];
  const estado = new Map(arvore.map((item) => [item.id, item.doneOn]));
  estado.set(id, doneOn);
  if (doneOn) {
    for (const filho of descendentes(arvore, id)) {
      if (!estado.get(filho)) {
        mudancas.push({ id: filho, doneOn });
        estado.set(filho, doneOn);
      }
    }
    for (const pai of ancestrais(arvore, id)) {
      const filhas = arvore.filter((item) => item.parentId === pai);
      if (estado.get(pai) || !filhas.every((filha) => estado.get(filha.id))) break;
      mudancas.push({ id: pai, doneOn });
      estado.set(pai, doneOn);
    }
  } else {
    for (const pai of ancestrais(arvore, id)) {
      if (!estado.get(pai)) continue;
      mudancas.push({ id: pai, doneOn: null });
      estado.set(pai, null);
    }
  }
  return mudancas;
}

/** Uma tarefa não pode entrar dentro de si mesma nem de uma descendente. */
export function podeMover(arvore: Tarefa[], id: string, parentId: string | null) {
  if (parentId === null) return true;
  if (parentId === id) return false;
  return !descendentes(arvore, id).includes(parentId);
}

/**
 * A ordem das irmãs depois de mover: a tarefa sai de onde está e entra antes de `beforeId`, ou no fim. Devolve os
 * ids na ordem nova, para renumerar as posições.
 */
export function ordemDepoisDeMover(irmasEmOrdem: string[], id: string, beforeId: string | null): string[] {
  const sem = irmasEmOrdem.filter((item) => item !== id);
  if (!beforeId || !sem.includes(beforeId)) return [...sem, id];
  const indice = sem.indexOf(beforeId);
  return [...sem.slice(0, indice), id, ...sem.slice(indice)];
}
