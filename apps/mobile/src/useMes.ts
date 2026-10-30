import { useCallback, useState } from "react";
import { mesDeHoje, type Mes } from "./api/formato";

/** O mês na tela e para que lado ele andou: a troca desliza para a direção da navegação. */
export function useMes() {
  const [estado, setEstado] = useState<{ mes: Mes; direcao: number }>(() => ({ mes: mesDeHoje(), direcao: 1 }));
  const mudar = useCallback((proximo: Mes) => {
    setEstado((atual) => ({
      mes: proximo,
      direcao: proximo.ano * 12 + proximo.mes >= atual.mes.ano * 12 + atual.mes.mes ? 1 : -1,
    }));
  }, []);
  return { mes: estado.mes, direcao: estado.direcao, mudar };
}
