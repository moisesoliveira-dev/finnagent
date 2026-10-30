import { useCallback, useEffect, useRef, useState } from "react";
import { ler } from "./api/cliente";

/**
 * Lê um caminho do BFF. Com `null`, não pede nada. Ignora a resposta de um pedido que já foi trocado por outro.
 * Os dados valem só para o caminho que os pediu: ao trocar de mês, a tela não mostra o mês antigo no lugar do novo.
 */
export function useDados<T>(caminho: string | null) {
  const [guardado, setGuardado] = useState<{ caminho: string; dados: T } | null>(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(Boolean(caminho));
  const ultimo = useRef(0);

  const recarregar = useCallback(async () => {
    if (!caminho) return;
    const id = ++ultimo.current;
    setCarregando(true);
    try {
      const resposta = await ler<T>(caminho);
      if (id !== ultimo.current) return;
      setGuardado({ caminho, dados: resposta });
      setErro("");
    } catch (error) {
      if (id === ultimo.current) setErro(error instanceof Error ? error.message : "Não foi possível carregar.");
    } finally {
      if (id === ultimo.current) setCarregando(false);
    }
  }, [caminho]);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  const dados = guardado && guardado.caminho === caminho ? guardado.dados : null;
  return { dados, erro, carregando, recarregar };
}
