"use client";

import { motion } from "motion/react";
import { useState } from "react";
import { APROVAR_PLANO, CANCELAR_PLANO, type PerguntaDoAssistente, type PlanoDoAssistente } from "@finnagent/contracts";
import { Button } from "../../components/ui/button";
import { campo, cn, focusRing } from "../../components/ui/cn";
import { formatarReais } from "../../components/ui/money";
import { ListaAnimada, ItemAnimado, mola } from "../../components/ui/movimento";

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

function data(iso: string) {
  const [ano, mes, dia] = iso.split("-").map(Number) as [number, number, number];
  const semana = SEMANA[new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay()];
  return `${semana} ${String(dia).padStart(2, "0")}/${MESES[mes - 1]}`;
}

/**
 * O plano do consultor: o entendimento, as suposições, os passos e o que o sistema calculou (datas reais, sobra do
 * mês antes e depois, alertas). Nada muda antes do Aprovar; escrever no campo pede um ajuste.
 */
export function CartaoDePlano({
  pergunta,
  plano,
  ativa,
  onResponder,
}: {
  pergunta: PerguntaDoAssistente;
  plano: PlanoDoAssistente;
  ativa: boolean;
  onResponder: (escolha: string) => void;
}) {
  const [ajuste, setAjuste] = useState("");
  const aberta = pergunta.resposta === null;
  const aprovado = pergunta.resposta === APROVAR_PLANO;
  const cancelado = pergunta.resposta === CANCELAR_PLANO;
  const semResposta = pergunta.resposta === "Sem resposta";
  const ajustado = !aberta && !aprovado && !cancelado && !semResposta;
  const fatosPorPasso = new Map(plano.fatos.passos.map((fato) => [fato.passo, fato]));
  const { mes } = plano.fatos;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={mola}
      className={cn("grid gap-4 border p-4", aberta ? "border-brand bg-surface" : "border-line bg-surface")}
    >
      <div className="grid gap-1">
        <p className={cn("etiqueta", aberta ? "text-brand" : "text-ink-2")}>
          {aberta
            ? "Plano para você aprovar"
            : aprovado
              ? "Plano aprovado"
              : cancelado || semResposta
                ? "Plano não executado"
                : "Plano ajustado"}
        </p>
        <p className="font-semibold">{plano.objetivo}</p>
        <p className="text-sm text-ink-2">{plano.entendimento}</p>
      </div>

      {plano.suposicoes.length ? (
        <div className="grid gap-1">
          <p className="etiqueta text-ink-2">O que eu supus</p>
          <ul className="grid gap-1 text-sm">
            {plano.suposicoes.map((item) => (
              <li key={item} className="flex gap-2">
                <span aria-hidden className="mt-2 size-1 shrink-0 bg-pending" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid gap-2">
        <p className="etiqueta text-ink-2">Passos</p>
        <ListaAnimada className="grid gap-2">
          {plano.passos.map((passo, indice) => {
            const fato = fatosPorPasso.get(indice + 1);
            return (
              <ItemAnimado key={`${indice}-${passo.ferramenta}`} className="grid gap-1 border border-line p-3">
                <p className="flex gap-2 text-sm">
                  <span className="etiqueta shrink-0 text-ink-2">{indice + 1}</span>
                  <span className={cn("min-w-0", passo.destrutiva && "text-neg")}>{passo.descricao}</span>
                </p>
                {fato ? (
                  <p className="pl-6 text-xs text-ink-2">
                    <span className={fato.valorCents >= 0 ? "text-pos" : "text-neg"}>{formatarReais(fato.valorCents)}</span>
                    {fato.recorrente ? " por mês" : ""} · {fato.datas.map((item) => (item.data === item.base ? data(item.data) : `${data(item.data)} (em vez de ${data(item.base)}${item.feriado ? `, ${item.feriado}` : ""})`)).join(" · ")}
                  </p>
                ) : null}
              </ItemAnimado>
            );
          })}
        </ListaAnimada>
      </div>

      {mes || plano.fatos.alertas.length ? (
        <div className="grid gap-2 border-t border-line pt-3">
          {mes ? (
            <p className="text-sm">
              <span className="etiqueta text-ink-2">Sobra de {MESES[mes.mes - 1]}/{mes.ano} </span>
              {formatarReais(mes.sobraAntesCents)} → <span className="font-semibold">{formatarReais(mes.sobraDepoisCents)}</span>
            </p>
          ) : null}
          {plano.fatos.alertas.map((alerta) => (
            <p key={alerta} className="border border-pending-line bg-pending-soft px-3 py-2 text-sm text-pending">
              {alerta}
            </p>
          ))}
        </div>
      ) : null}

      {aberta && ativa ? (
        <div className="grid gap-3">
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={() => onResponder(APROVAR_PLANO)}>
              {APROVAR_PLANO}
            </Button>
            <Button variant="quiet" onClick={() => onResponder(CANCELAR_PLANO)}>
              {CANCELAR_PLANO}
            </Button>
          </div>
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (ajuste.trim()) onResponder(ajuste.trim());
            }}
          >
            <label htmlFor={`ajuste-${pergunta.id}`} className="sr-only">
              Pedir um ajuste no plano
            </label>
            <input
              id={`ajuste-${pergunta.id}`}
              value={ajuste}
              maxLength={300}
              placeholder="Quer mudar algo? Escreva o ajuste"
              className={cn(campo, "flex-1", focusRing)}
              onChange={(event) => setAjuste(event.target.value)}
            />
            <Button type="submit" disabled={!ajuste.trim()}>
              Ajustar
            </Button>
          </form>
        </div>
      ) : null}
      {ajustado ? <p className="text-sm text-ink-2">Ajuste pedido: {pergunta.resposta}</p> : null}
    </motion.div>
  );
}
