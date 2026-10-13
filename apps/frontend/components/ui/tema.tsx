"use client";

import { useEffect } from "react";
import type { Tema } from "@finnagent/contracts";

let segurando = false;

export function aplicarTema(tema: Tema) {
  const raiz = document.documentElement;
  if (tema === "auto") raiz.removeAttribute("data-theme");
  else raiz.setAttribute("data-theme", tema);
}

export function segurarTema(ativo: boolean) {
  segurando = ativo;
}

export function TemaSalvo() {
  useEffect(() => {
    let vivo = true;
    fetch("/api/configuracoes")
      .then(async (resposta) => {
        if (!resposta.ok || !vivo || segurando) return;
        const dados = (await resposta.json()) as { theme?: Tema };
        if (!vivo || segurando) return;
        if (dados.theme === "light" || dados.theme === "dark" || dados.theme === "auto") {
          aplicarTema(dados.theme);
        }
      })
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, []);
  return null;
}
