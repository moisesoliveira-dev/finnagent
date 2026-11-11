import type { Tema } from "@finnagent/contracts";
import { useEffect } from "react";
import { ler } from "../api/cliente";
import { aplicarTema } from "./tema";

/**
 * Ao abrir o app, o tema da conta vale em todas as telas, e não só quando as Configurações abrem: quem escolheu o
 * escuro no site, ou em outro aparelho, encontra o app escuro. Sem resposta do servidor, fica o último tema guardado.
 */
export function TemaDaConta() {
  useEffect(() => {
    let vivo = true;
    void ler<{ theme?: Tema }>("/api/configuracoes")
      .then((dados) => {
        if (vivo && (dados.theme === "light" || dados.theme === "dark" || dados.theme === "auto")) aplicarTema(dados.theme);
      })
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, []);
  return null;
}
