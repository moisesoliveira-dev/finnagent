import { useIonAlert, useIonToast } from "@ionic/react";
import { useState } from "react";
import { toque } from "./haptico";

/**
 * Uma ação que grava no servidor: marca o que está ocupado, avisa o resultado no topo e vibra.
 * `confirmar` pergunta antes, para o que apaga ou não tem volta.
 */
export function useAcao() {
  const [avisar] = useIonToast();
  const [perguntar] = useIonAlert();
  const [ocupado, setOcupado] = useState("");

  async function agir(chave: string, fazer: () => Promise<unknown>, sucesso?: string) {
    if (ocupado) return false;
    setOcupado(chave);
    try {
      await fazer();
      toque();
      if (sucesso) void avisar({ message: sucesso, duration: 2200, position: "top" });
      return true;
    } catch (error) {
      toque(true);
      void avisar({ message: error instanceof Error ? error.message : "Não foi possível concluir.", duration: 3200, position: "top", cssClass: "aviso-de-erro" });
      return false;
    } finally {
      setOcupado("");
    }
  }

  function confirmar(titulo: string, texto: string, botao: string, aoConfirmar: () => void) {
    void perguntar({
      header: titulo,
      message: texto,
      buttons: [
        { text: "Cancelar", role: "cancel" },
        { text: botao, role: "destructive", handler: aoConfirmar },
      ],
    });
  }

  return { ocupado, agir, confirmar, avisar: (message: string) => void avisar({ message, duration: 2600, position: "top" }) };
}
