"use client";

import { useEffect } from "react";

/**
 * Quando a API responde 401 (sessão vencida ou revogada), leva a pessoa ao login com o caminho
 * atual guardado. A rota da API já apagou o cookie, então o login não rebate de volta.
 */
export function SessaoExpirada() {
  useEffect(() => {
    const original = window.fetch;
    window.fetch = async (...args) => {
      const resposta = await original(...args);
      if (resposta.status === 401) {
        const alvo = args[0];
        const url = new URL(typeof alvo === "string" ? alvo : alvo instanceof URL ? alvo.href : alvo.url, window.location.origin);
        if (url.pathname.startsWith("/api/") && !url.pathname.startsWith("/api/auth/")) {
          const atual = `${window.location.pathname}${window.location.search}`;
          // Navegação completa de propósito: zera o estado da página que perdeu a sessão.
          // eslint-disable-next-line @next/next/no-location-assign-relative-destination
          window.location.assign(`/login?expirou=1&proximo=${encodeURIComponent(atual)}`);
        }
      }
      return resposta;
    };
    return () => {
      window.fetch = original;
    };
  }, []);

  return null;
}
