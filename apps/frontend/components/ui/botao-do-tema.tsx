"use client";

import { useSyncExternalStore } from "react";
import type { Configuracoes, Tema } from "@finnagent/contracts";
import { cn, focusRing } from "./cn";
import { Icone } from "./icone";
import { aplicarTema } from "./tema";

function temaDaPagina(): Tema {
  const valor = document.documentElement.getAttribute("data-theme");
  return valor === "light" || valor === "dark" ? valor : "auto";
}

function assinar(aoMudar: () => void) {
  const observador = new MutationObserver(aoMudar);
  observador.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  const escuro = window.matchMedia("(prefers-color-scheme: dark)");
  escuro.addEventListener("change", aoMudar);
  return () => {
    observador.disconnect();
    escuro.removeEventListener("change", aoMudar);
  };
}

function escuroAgora(): boolean {
  const tema = temaDaPagina();
  if (tema === "dark") return true;
  if (tema === "light") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/**
 * Alterna claro e escuro no canto da tela. Aplica na hora e grava nas configurações, para valer nos outros
 * aparelhos; "automático" continua disponível em Configurações.
 */
export function BotaoDoTema() {
  // No servidor vale "claro", para o HTML não divergir; a hidratação corrige.
  const escuro = useSyncExternalStore(assinar, escuroAgora, () => false);

  async function alternar() {
    const proximo: Tema = escuro ? "light" : "dark";
    aplicarTema(proximo);
    try {
      const resposta = await fetch("/api/configuracoes");
      if (!resposta.ok) return;
      const atual = (await resposta.json()) as Configuracoes;
      await fetch("/api/configuracoes", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...atual, theme: proximo }),
      });
    } catch {
      // Sem gravar, o tema vale só até recarregar; o botão continua funcionando.
    }
  }

  return (
    <button
      type="button"
      aria-label={escuro ? "Mudar para o tema claro" : "Mudar para o tema escuro"}
      title={escuro ? "Tema claro" : "Tema escuro"}
      onClick={() => void alternar()}
      className={cn("inline-flex size-10 shrink-0 items-center justify-center text-ink-2 transition-colors hover:text-ink", focusRing)}
    >
      <Icone name={escuro ? "sol" : "lua"} />
    </button>
  );
}
