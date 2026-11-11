import type { Tema } from "@finnagent/contracts";
import { useEffect, useState } from "react";

const CHAVE = "prumo.tema";
const EVENTO = "prumo-tema";

/** A escolha guardada neste aparelho, para o app abrir já no tema certo, antes de falar com o servidor. */
export function temaGuardado(): Tema {
  try {
    const valor = localStorage.getItem(CHAVE);
    return valor === "light" || valor === "dark" ? valor : "auto";
  } catch {
    return "auto";
  }
}

/**
 * Aplica o tema: claro e escuro fixam o visual; automático deixa o do celular valer. É a mesma preferência do site
 * (`theme` nas configurações), então o que se escolhe aqui e lá é uma coisa só.
 */
export function aplicarTema(tema: Tema) {
  const raiz = document.documentElement;
  if (tema === "auto") raiz.removeAttribute("data-theme");
  else raiz.setAttribute("data-theme", tema);
  try {
    localStorage.setItem(CHAVE, tema);
  } catch {
    // Sem armazenamento, o tema só vale até fechar o app.
  }
  window.dispatchEvent(new Event(EVENTO));
}

/** O tema que está valendo agora, já resolvido: o do celular quando a escolha é automática. */
function estaEscuro() {
  const escolha = document.documentElement.getAttribute("data-theme");
  if (escolha === "dark") return true;
  if (escolha === "light") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/** Para o que não é CSS (a imagem da marca, por exemplo) acompanhar o tema escolhido e o do celular. */
export function useTemaEscuro() {
  const [escuro, setEscuro] = useState(estaEscuro);
  useEffect(() => {
    const atualizar = () => setEscuro(estaEscuro());
    const sistema = window.matchMedia("(prefers-color-scheme: dark)");
    window.addEventListener(EVENTO, atualizar);
    sistema.addEventListener("change", atualizar);
    return () => {
      window.removeEventListener(EVENTO, atualizar);
      sistema.removeEventListener("change", atualizar);
    };
  }, []);
  return escuro;
}
