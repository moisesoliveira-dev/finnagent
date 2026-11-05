"use client";

import { useRef } from "react";
import { proximaMascara } from "./reais";

/**
 * O campo de dinheiro de toda a aplicação: só aceita dígitos e mostra o valor já em reais ("1.234,56"), com os
 * centavos entrando pela direita. Quem lê o valor usa `reaisParaCentavos`; quem preenche usa `centavosParaReais`.
 */
export function CampoValor({
  value,
  onChange,
  className,
  placeholder = "0,00",
  ...resto
}: Omit<React.ComponentProps<"input">, "value" | "onChange" | "type" | "inputMode" | "autoComplete"> & {
  value: string;
  onChange: (valor: string) => void;
}) {
  const campo = useRef<HTMLInputElement>(null);

  function digitar(texto: string) {
    const valor = proximaMascara(value, texto);
    onChange(valor);
    requestAnimationFrame(() => {
      const el = campo.current;
      if (!el) return;
      el.setSelectionRange(valor.length, valor.length);
    });
  }

  return (
    <input
      ref={campo}
      inputMode="numeric"
      autoComplete="off"
      placeholder={placeholder}
      value={value}
      onChange={(event) => digitar(event.target.value)}
      className={`${className ?? ""} text-right tabular-nums`}
      {...resto}
    />
  );
}
