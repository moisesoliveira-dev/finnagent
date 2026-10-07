export type LancamentoCruzavel = {
  id: string;
  description: string;
  groupName: string;
  sessionName: string;
  day: number;
  cents: number;
};

export type PropostaCruzamento = {
  entryId: string;
  description: string;
  groupName: string;
  sessionName: string;
  day: number;
  cents: number;
};

export function sugerirCruzamento(
  linha: { date: string; cents: number },
  lancamentos: LancamentoCruzavel[],
): PropostaCruzamento | null {
  const dia = Number(linha.date.slice(8, 10));
  const proximos = lancamentos.filter(
    (item) => item.cents === linha.cents && Math.abs(item.day - dia) <= 3,
  );
  if (proximos.length !== 1) return null;
  const escolhido = proximos[0];
  return {
    entryId: escolhido.id,
    description: escolhido.description,
    groupName: escolhido.groupName,
    sessionName: escolhido.sessionName,
    day: escolhido.day,
    cents: escolhido.cents,
  };
}
