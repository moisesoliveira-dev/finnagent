"use client";

import { useRef } from "react";
import { proximaMascara } from "./reais";

export function CampoValor({
  id,
  value,
  onChange,
  className,
  required = false,
  placeholder = "0,00",
}: {
  id: string;
  value: string;
  onChange: (valor: string) => void;
  className?: string;
  required?: boolean;
  placeholder?: string;
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
      id={id}
      inputMode="numeric"
      autoComplete="off"
      required={required}
      placeholder={placeholder}
      value={value}
      onChange={(event) => digitar(event.target.value)}
      className={`${className ?? ""} text-right tabular-nums`}
    />
  );
}
