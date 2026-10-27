"use client";

import { SENHA_MAXIMA } from "@finnagent/contracts";
import { useState } from "react";
import { campo, cn, focusRing } from "../ui/cn";

export function CampoDeSenha({
  id,
  rotulo,
  children,
  autoComplete,
  value,
  invalido,
  descricao,
  inputRef,
  onChange,
}: {
  id: string;
  rotulo: string;
  children?: React.ReactNode;
  autoComplete: "current-password" | "new-password";
  value: string;
  invalido: boolean;
  descricao?: string;
  inputRef?: React.Ref<HTMLInputElement>;
  onChange: (valor: string) => void;
}) {
  const [visivel, setVisivel] = useState(false);
  const [capsLock, setCapsLock] = useState(false);

  return (
    <div className="grid gap-2">
      <label htmlFor={id} className="text-sm font-medium">
        {rotulo}
      </label>
      <div className="relative">
        <input
          id={id}
          ref={inputRef}
          name="password"
          type={visivel ? "text" : "password"}
          value={value}
          autoComplete={autoComplete}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          maxLength={SENHA_MAXIMA}
          aria-invalid={invalido}
          aria-describedby={descricao}
          className={cn(campo, "w-full pr-12")}
          onChange={(event) => onChange(event.target.value)}
          onKeyUp={(event) => setCapsLock(event.getModifierState("CapsLock"))}
          onBlur={() => setCapsLock(false)}
        />
        <button
          type="button"
          aria-pressed={visivel}
          aria-controls={id}
          className={cn(
            "etiqueta absolute inset-y-0 right-0 flex min-w-10 items-center justify-center px-3 text-ink-2 transition-colors hover:text-ink",
            focusRing,
          )}
          onClick={() => setVisivel((atual) => !atual)}
        >
          {visivel ? "Ocultar" : "Mostrar"}
        </button>
      </div>
      {capsLock ? (
        <p role="status" className="text-sm text-pending">
          Caps Lock está ligado.
        </p>
      ) : null}
      {children}
    </div>
  );
}
