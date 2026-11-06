"use client";

import {
  CATEGORIAS_TRANSACAO,
  RECORRENCIAS,
  categoriaSempreEntrada,
  categoriaSempreSaida,
  type CategoriaTransacao,
  type Recorrencia,
  type TipoDaLinha,
} from "@finnagent/contracts";
import { campo, cn } from "../../../components/ui/cn";
import { ROTULO_CATEGORIA, ROTULO_RECORRENCIA } from "../../financas/rotulos";
import { CampoValor } from "../../financas/campo-valor";
import { apenasDigitos, reaisParaCentavos } from "../../financas/reais";

/** O que a pessoa digita para o tipo, antes de virar número. */
export type RascunhoDoTipo = {
  category: CategoriaTransacao;
  installments: string;
  installmentNumber: string;
  counterparty: string;
  principal: string;
  recurrence: Recorrencia;
  recurrenceInterval: string;
};

export const RASCUNHO_UNICO: RascunhoDoTipo = {
  category: "unique",
  installments: "",
  installmentNumber: "1",
  counterparty: "",
  principal: "",
  recurrence: "monthly",
  recurrenceInterval: "1",
};

function numero(texto: string) {
  const valor = Number(texto.replace(",", "."));
  return texto.trim() === "" || !Number.isFinite(valor) ? null : valor;
}

/** O rascunho como o backend recebe. Única não manda nada: é o padrão. */
export function tipoDoRascunho(rascunho: RascunhoDoTipo): TipoDaLinha {
  const { category } = rascunho;
  if (category === "installment") {
    return { category, installments: numero(rascunho.installments), installmentNumber: numero(rascunho.installmentNumber) };
  }
  if (category === "loan") {
    return {
      category,
      installments: numero(rascunho.installments) ?? 1,
      counterparty: rascunho.counterparty.trim(),
      principalCents: reaisParaCentavos(rascunho.principal),
    };
  }
  if (category === "fixed") {
    return { category, recurrence: rascunho.recurrence, recurrenceInterval: numero(rascunho.recurrenceInterval) };
  }
  return { category };
}

/**
 * As categorias que cabem na linha: as que a sessão aceita (`aceitas`; sem sessão, todas) e que combinam com o
 * sinal (extra só em entrada, parcela só em saída).
 */
export function categoriasDaLinha(cents: number, aceitas?: readonly CategoriaTransacao[]) {
  // Única primeiro: é o padrão e o caso mais comum.
  const ordem: readonly CategoriaTransacao[] = ["unique", ...CATEGORIAS_TRANSACAO.filter((categoria) => categoria !== "unique")];
  return ordem.filter((categoria) => {
    if (aceitas && !aceitas.includes(categoria)) return false;
    if (cents < 0 && categoriaSempreEntrada(categoria)) return false;
    if (cents > 0 && categoriaSempreSaida(categoria)) return false;
    return true;
  });
}

/** O rascunho com a categoria que a linha aceita: a que não cabe mais (a sessão mudou) volta a única. */
export function rascunhoAceito(rascunho: RascunhoDoTipo, cents: number, aceitas?: readonly CategoriaTransacao[]): RascunhoDoTipo {
  return categoriasDaLinha(cents, aceitas).includes(rascunho.category) ? rascunho : { ...rascunho, category: "unique" };
}

/**
 * O tipo do lançamento que a linha (ou a parte) vai virar: um seletor e, conforme o tipo, as parcelas, os juros ou
 * a recorrência, na mesma linha. Só dígitos entram nos números.
 */
export function TipoDaLinhaCampos({
  rotulo,
  cents,
  aceitas,
  valor,
  onChange,
  disabled = false,
  className,
}: {
  /** De quem é o tipo, para o leitor de tela: "Tipo do lançamento de MERCADO". */
  rotulo: string;
  cents: number;
  /** As categorias que a sessão escolhida aceita. Sem sessão, todas. */
  aceitas?: readonly CategoriaTransacao[];
  valor: RascunhoDoTipo;
  onChange: (valor: RascunhoDoTipo) => void;
  disabled?: boolean;
  className?: string;
}) {
  const opcoes = categoriasDaLinha(cents, aceitas);
  // Sessão que só aceita um tipo: não há o que escolher.
  if (opcoes.length <= 1) return null;
  const parcelada = valor.category === "installment";
  const curto = cn(campo, "w-16 text-right");
  return (
    <div className={cn("flex min-w-0 flex-wrap items-center gap-2", className)}>
      <span className="etiqueta text-ink-2">Tipo</span>
      <select
        className={cn(campo, "min-w-0")}
        aria-label={rotulo}
        disabled={disabled}
        value={valor.category}
        onChange={(event) => onChange({ ...valor, category: event.target.value as CategoriaTransacao })}
      >
        {opcoes.map((categoria) => (
          <option key={categoria} value={categoria}>
            {ROTULO_CATEGORIA[categoria]}
          </option>
        ))}
      </select>
      {parcelada ? (
        <>
          <span className="etiqueta text-ink-2">Parcela</span>
          <input
            className={curto}
            aria-label={`Parcela atual de ${rotulo}`}
            inputMode="numeric"
            disabled={disabled}
            value={valor.installmentNumber}
            onChange={(event) => onChange({ ...valor, installmentNumber: apenasDigitos(event.target.value, 3) })}
          />
          <span className="etiqueta text-ink-2">de</span>
          <input
            className={curto}
            aria-label={`Total de parcelas de ${rotulo}`}
            inputMode="numeric"
            placeholder="12"
            disabled={disabled}
            value={valor.installments}
            onChange={(event) => onChange({ ...valor, installments: apenasDigitos(event.target.value, 3) })}
          />
        </>
      ) : null}
      {valor.category === "loan" ? (
        <>
          <span className="etiqueta text-ink-2">Pessoa</span>
          <input
            className={cn(campo, "min-w-0 flex-1")}
            aria-label={`Pessoa de ${rotulo}`}
            placeholder="De quem é"
            maxLength={80}
            disabled={disabled}
            value={valor.counterparty}
            onChange={(event) => onChange({ ...valor, counterparty: event.target.value })}
          />
          <span className="etiqueta text-ink-2">Total</span>
          <CampoValor
            className={cn(campo, "w-24")}
            aria-label={`Total combinado de ${rotulo}`}
            disabled={disabled}
            value={valor.principal}
            onChange={(principal) => onChange({ ...valor, principal })}
          />
          <span className="etiqueta text-ink-2">em</span>
          <input
            className={curto}
            aria-label={`Parcelas combinadas de ${rotulo}`}
            inputMode="numeric"
            placeholder="1"
            disabled={disabled}
            value={valor.installments}
            onChange={(event) => onChange({ ...valor, installments: apenasDigitos(event.target.value, 3) })}
          />
        </>
      ) : null}
      {valor.category === "fixed" ? (
        <>
          <span className="etiqueta text-ink-2">Repete</span>
          <select
            className={cn(campo, "min-w-0")}
            aria-label={`Recorrência de ${rotulo}`}
            disabled={disabled}
            value={valor.recurrence}
            onChange={(event) => onChange({ ...valor, recurrence: event.target.value as Recorrencia })}
          >
            {RECORRENCIAS.map((recorrencia) => (
              <option key={recorrencia} value={recorrencia}>
                {ROTULO_RECORRENCIA[recorrencia]}
              </option>
            ))}
          </select>
          <span className="etiqueta text-ink-2">A cada</span>
          <input
            className={curto}
            aria-label={`Intervalo da recorrência de ${rotulo}`}
            inputMode="numeric"
            disabled={disabled}
            value={valor.recurrenceInterval}
            onChange={(event) => onChange({ ...valor, recurrenceInterval: apenasDigitos(event.target.value, 2) })}
          />
        </>
      ) : null}
    </div>
  );
}
