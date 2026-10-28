"use client";

import { motion } from "motion/react";
import { INFO_DOS_PROVEDORES, type EscolhaDeModelo, type ProvedorConfigurado, type ProvedorIa } from "@finnagent/contracts";
import { campo, cn, focusRing } from "../../../components/ui/cn";
import { mola } from "../../../components/ui/movimento";

const MONOGRAMA: Record<ProvedorIa, { letras: string; tom: string }> = {
  openai: { letras: "OA", tom: "text-ink" },
  anthropic: { letras: "An", tom: "text-pending" },
  google: { letras: "Ge", tom: "text-brand" },
  openai_compativel: { letras: "API", tom: "text-event" },
  ollama: { letras: "Ol", tom: "text-pos" },
};

/** Monograma do provedor. Sem logotipo de marca: só as iniciais, nas cores do tema. */
export function MarcaDoProvedor({ kind, grande = false }: { kind: ProvedorIa; grande?: boolean }) {
  const marca = MONOGRAMA[kind];
  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center border border-line bg-surface-2 font-mono font-semibold",
        grande ? "size-12 text-base" : "size-10 text-sm",
        marca.tom,
      )}
    >
      {marca.letras}
    </span>
  );
}

export function Interruptor({
  id,
  ligado,
  desativado = false,
  descricao,
  onMudar,
}: {
  id: string;
  ligado: boolean;
  desativado?: boolean;
  descricao?: string;
  onMudar: (valor: boolean) => void;
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={ligado}
      aria-describedby={descricao}
      disabled={desativado}
      onClick={() => onMudar(!ligado)}
      className={cn("inline-flex h-10 w-12 shrink-0 items-center", desativado && "opacity-50", focusRing)}
    >
      <span aria-hidden className={cn("relative h-6 w-12 rounded-full border", ligado ? "border-brand bg-brand" : "border-line bg-surface-2")}>
        <motion.span
          className={cn("absolute top-1 left-1 size-4 rounded-full", ligado ? "bg-brand-ink" : "bg-surface")}
          initial={false}
          animate={{ x: ligado ? 24 : 0 }}
          transition={mola}
        />
      </span>
    </button>
  );
}

/** Valor do seletor: "padrao", ou "providerId|modelo". */
export function valorDaEscolha(escolha: EscolhaDeModelo | null | undefined) {
  return escolha ? `${escolha.providerId}|${escolha.model}` : "padrao";
}

export function escolhaDoValor(valor: string): EscolhaDeModelo | null {
  if (valor === "padrao" || !valor.includes("|")) return null;
  const [providerId, ...resto] = valor.split("|");
  return { providerId, model: resto.join("|") };
}

/** Escolha de modelo agrupada por provedor. `rotuloDoPadrao` vazio esconde a opção "usar o padrão". */
export function SeletorDeModelo({
  id,
  provedores,
  valor,
  rotuloDoPadrao,
  desativado,
  filtrar,
  onMudar,
}: {
  id: string;
  provedores: ProvedorConfigurado[];
  valor: EscolhaDeModelo | null | undefined;
  rotuloDoPadrao: string;
  desativado: boolean;
  filtrar?: (provedor: ProvedorConfigurado) => boolean;
  onMudar: (escolha: EscolhaDeModelo | null) => void;
}) {
  const visiveis = provedores.filter((provedor) => provedor.models.length && (filtrar ? filtrar(provedor) : true));
  return (
    <select
      id={id}
      value={valorDaEscolha(valor)}
      disabled={desativado}
      className={cn(campo, "w-full")}
      onChange={(event) => onMudar(escolhaDoValor(event.target.value))}
    >
      {rotuloDoPadrao ? <option value="padrao">{rotuloDoPadrao}</option> : <option value="padrao">Escolha um modelo</option>}
      {visiveis.map((provedor) => (
        <optgroup key={provedor.id} label={`${provedor.label} · ${INFO_DOS_PROVEDORES[provedor.kind].nome}`}>
          {provedor.models.map((modelo) => (
            <option key={modelo} value={`${provedor.id}|${modelo}`}>
              {modelo}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

export function rotuloDaEscolha(escolha: EscolhaDeModelo | null | undefined, provedores: ProvedorConfigurado[]) {
  if (!escolha) return null;
  const provedor = provedores.find((item) => item.id === escolha.providerId);
  return provedor ? `${escolha.model} · ${provedor.label}` : null;
}
