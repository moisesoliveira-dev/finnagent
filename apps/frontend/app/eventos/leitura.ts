"use client";

import { useEffect, useState } from "react";
import { useToast } from "../../components/ui/toast";

async function ler<T>(caminho: string): Promise<T> {
  const resposta = await fetch(caminho);
  const corpo = (await resposta.json().catch(() => ({}))) as T & { message?: string | string[] };
  if (!resposta.ok) {
    const mensagem = Array.isArray(corpo.message) ? corpo.message[0] : corpo.message;
    throw new Error(mensagem || "O backend não respondeu.");
  }
  return corpo;
}

export type Leitura<T> = { dados: T | null; buscando: boolean; falhou: boolean };

/**
 * Lê `caminho` e relê quando ele ou a `versao` mudam. Enquanto busca, devolve o que já tinha, para a tela
 * esmaecer o conteúdo antigo em vez de piscar o esqueleto. `caminho` null não lê nada.
 */
export function useLeitura<T>(caminho: string | null, versao: number): Leitura<T> {
  const toast = useToast();
  const chave = caminho ? `${caminho}#${versao}` : null;
  const [lida, setLida] = useState<{ chave: string; dados: T } | null>(null);
  const [falha, setFalha] = useState<string | null>(null);

  useEffect(() => {
    if (!caminho || !chave) return;
    let ativo = true;
    ler<T>(caminho)
      .then((dados) => {
        if (ativo) setLida({ chave, dados });
      })
      .catch((error: Error) => {
        if (!ativo) return;
        setFalha(chave);
        toast.erro(error.message);
      });
    return () => {
      ativo = false;
    };
  }, [caminho, chave, toast]);

  return {
    dados: caminho ? (lida?.dados ?? null) : null,
    buscando: chave !== null && lida?.chave !== chave && falha !== chave,
    falhou: chave !== null && falha === chave,
  };
}
