import {
  FUSO_PADRAO,
  FUSOS_AGENDA,
  RETENCOES,
  STATUS_EVENTO,
  type Retencao,
  type StatusEvento,
  type VolumeDeEventosNoDia,
} from "@finnagent/contracts";

export type Contagem = { chave: string; total: number };
export type ContagemNoDia = { dia: string; status: string; total: number };

/** O fuso da conta, se for um dos que o Prumo usa; senão, o padrão. O banco recebe só nomes conhecidos. */
export function fusoDaConta(valor: string | null | undefined) {
  return FUSOS_AGENDA.find((fuso) => fuso === valor) ?? FUSO_PADRAO;
}

export function retencaoDaConta(valor: string | null | undefined): Retencao {
  return RETENCOES.find((item) => item === valor) ?? "sempre";
}

/** O primeiro instante que a retenção ainda mostra; null quando mostra tudo. */
export function inicioDaRetencao(retencao: Retencao, agora: Date) {
  if (retencao === "sempre") return null;
  const limite = new Date(agora);
  if (retencao === "90d") limite.setUTCDate(limite.getUTCDate() - 90);
  else limite.setUTCFullYear(limite.getUTCFullYear() - 1);
  return limite;
}

/** Os `quantos` dias que terminam em `hoje` (AAAA-MM-DD), do mais antigo ao mais novo. */
export function diasAte(hoje: string, quantos: number) {
  const [ano, mes, dia] = hoje.split("-").map(Number);
  return Array.from({ length: quantos }, (_, indice) =>
    new Date(Date.UTC(ano, mes - 1, dia - (quantos - 1 - indice))).toISOString().slice(0, 10),
  );
}

/** A página pedida, dentro do que existe: depois da última vira a última; sem nada, a primeira. */
export function paginaNoLimite(pedida: number, total: number, tamanho: number) {
  const ultima = Math.max(1, Math.ceil(total / tamanho));
  return Math.min(Math.max(1, pedida), ultima);
}

/** Uma contagem por chave conhecida, com zero nas que o banco não trouxe. Chave desconhecida fica de fora. */
export function contarPor<T extends string>(chaves: readonly T[], linhas: Contagem[]): Record<T, number> {
  const contagem = Object.fromEntries(chaves.map((chave) => [chave, 0])) as Record<T, number>;
  for (const linha of linhas) {
    if (linha.chave in contagem) contagem[linha.chave as T] += linha.total;
  }
  return contagem;
}

/** O volume de cada dia da janela, com zero nos dias sem evento. */
export function montarVolume(dias: string[], linhas: ContagemNoDia[]): VolumeDeEventosNoDia[] {
  const porDia = new Map(dias.map((date) => [date, { date, total: 0, status: contarPor(STATUS_EVENTO, []) }]));
  for (const linha of linhas) {
    const dia = porDia.get(linha.dia);
    if (!dia || !(linha.status in dia.status)) continue;
    dia.status[linha.status as StatusEvento] += linha.total;
    dia.total += linha.total;
  }
  return [...porDia.values()];
}
