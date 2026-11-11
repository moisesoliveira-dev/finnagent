"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "./toast";

/** Quanto tempo o "Desfazer" vale antes de o servidor ser chamado de verdade. */
const ESPERA_MS = 6000;

type Pendente = { chave: string; apagar: () => Promise<unknown>; timer: number };

/**
 * Apagar com "Desfazer", sem o servidor saber de nada até o prazo acabar: o item some da tela na hora e a exclusão só
 * é enviada depois de alguns segundos. "Desfazer" cancela e o item volta. Um por vez: apagar outro envia o anterior já.
 * Sair da tela ou esconder a aba também envia, para a exclusão não se perder.
 *
 * `aoTerminar` recarrega os dados depois do envio (e traz o item de volta se o servidor recusou).
 */
export function useApagarComDesfazer(aoTerminar: () => Promise<unknown>) {
  const toast = useToast();
  const [ocultos, setOcultos] = useState<string[]>([]);
  const pendente = useRef<Pendente | null>(null);
  const terminar = useRef(aoTerminar);
  terminar.current = aoTerminar;

  const enviar = useCallback(
    async (atual: Pendente) => {
      try {
        await atual.apagar();
      } catch (error) {
        toast.erro(error instanceof Error ? error.message : "Não foi possível apagar.");
      } finally {
        await terminar.current();
        setOcultos((lista) => lista.filter((chave) => chave !== atual.chave));
      }
    },
    [toast],
  );

  /** Envia agora o que está esperando o prazo. */
  const descarregar = useCallback(() => {
    const atual = pendente.current;
    if (!atual) return;
    pendente.current = null;
    window.clearTimeout(atual.timer);
    void enviar(atual);
  }, [enviar]);

  const desfazer = useCallback((chave: string) => {
    const atual = pendente.current;
    if (!atual || atual.chave !== chave) return;
    window.clearTimeout(atual.timer);
    pendente.current = null;
    setOcultos((lista) => lista.filter((item) => item !== chave));
  }, []);

  useEffect(() => {
    const aoEsconder = () => {
      if (document.visibilityState === "hidden") descarregar();
    };
    document.addEventListener("visibilitychange", aoEsconder);
    return () => {
      document.removeEventListener("visibilitychange", aoEsconder);
      descarregar();
    };
  }, [descarregar]);

  /** Tira `chave` da tela e avisa com "Desfazer". `acao` é a chamada que apaga de verdade. */
  const apagar = useCallback(
    (chave: string, mensagem: string, acao: () => Promise<unknown>) => {
      descarregar();
      setOcultos((lista) => [...lista, chave]);
      pendente.current = { chave, apagar: acao, timer: window.setTimeout(descarregar, ESPERA_MS) };
      toast.desfazer(mensagem, () => desfazer(chave));
    },
    [descarregar, desfazer, toast],
  );

  return { ocultos, apagar };
}
