"use client";

import type { ReactNode } from "react";
import type { DetalheDoEvento } from "@finnagent/contracts";
import { Button } from "../../components/ui/button";
import { cn } from "../../components/ui/cn";
import { useToast } from "../../components/ui/toast";
import { dataHora, intervalo } from "./formato";
import { Ponto, TOM_DO_STATUS } from "./status";

export function DetalheDoEventoVista({
  detalhe,
  categoria,
  idDoTitulo,
  acoes,
}: {
  detalhe: DetalheDoEvento;
  categoria: string;
  idDoTitulo: string;
  acoes?: ReactNode;
}) {
  const toast = useToast();
  const { event: evento, timezone: fuso } = detalhe;
  const consumo = detalhe.history[0];
  const passos = [
    { nome: "Registrado na outbox", quando: evento.occurredAt, nota: "" },
    { nome: "Publicado na fila", quando: evento.publishedAt, nota: "" },
    {
      nome: "Processado",
      quando: evento.consumedAt,
      nota: consumo ? `${consumo.consumer} · tentativa ${consumo.attempt}` : "",
    },
  ];
  const payload = JSON.stringify(evento.payload, null, 2);
  const dados: Array<[string, string, boolean]> = [
    ["Id", evento.id, true],
    ["Chave de idempotência", evento.idempotencyKey, true],
    ["Versão do schema", String(evento.schemaVersion), false],
    ["Correlação", evento.correlationId ?? "—", true],
    ["Causado por", evento.causationId ?? "—", true],
  ];

  async function copiar() {
    try {
      await navigator.clipboard.writeText(payload);
      toast.sucesso("Payload copiado.");
    } catch {
      toast.erro("Não foi possível copiar.");
    }
  }

  return (
    <article aria-labelledby={idDoTitulo} className="grid min-w-0 gap-6">
      <header className="grid min-w-0 gap-2">
        <div className="flex items-start justify-between gap-3">
          <p className="etiqueta pt-1 text-ink-2">
            {categoria} · {evento.origin}
          </p>
          {acoes}
        </div>
        {/* A regra de h1/h2/h3 do globals.css vence os utilitários: fonte e etiqueta vão nos spans de dentro. */}
        <h2 id={idDoTitulo} className="text-lg break-all">
          <span className="font-mono">{evento.type}</span>
        </h2>
        <p className="text-sm break-all text-ink-2">{evento.aggregate}</p>
        <p className={cn("etiqueta flex items-center gap-2", TOM_DO_STATUS[evento.status])}>
          <Ponto status={evento.status} />
          {evento.status}
        </p>
      </header>

      <section aria-label="Processamento" className="grid gap-3">
        <h3>
          <span className="etiqueta text-ink-2">Processamento</span>
        </h3>
        <ol className="grid">
          {passos.map((passo, indice) => {
            const anterior = indice > 0 ? passos[indice - 1].quando : null;
            const ultimo = indice === passos.length - 1;
            return (
              <li key={passo.nome} className="flex gap-3">
                <span aria-hidden="true" className="relative flex w-2 shrink-0 justify-center">
                  {ultimo ? null : <span className="absolute top-2 bottom-0 left-1/2 border-l border-line" />}
                  <span
                    className={cn(
                      "relative mt-1 size-2 rounded-full",
                      passo.quando ? "bg-brand" : "border-2 border-line bg-surface",
                    )}
                  />
                </span>
                <div className={cn("grid min-w-0 gap-1", !ultimo && "pb-4")}>
                  <span className={cn("text-sm font-medium", !passo.quando && "text-ink-2")}>{passo.nome}</span>
                  <span className="text-xs text-ink-2 tabular-nums">
                    {passo.quando ? dataHora(passo.quando, fuso) : "Ainda não"}
                    {passo.quando && anterior
                      ? ` · +${intervalo(Math.max(0, Date.parse(passo.quando) - Date.parse(anterior)))}`
                      : null}
                  </span>
                  {passo.nota && passo.quando ? <span className="text-xs text-ink-2">{passo.nota}</span> : null}
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      <section aria-label="Dados do evento" className="grid gap-3">
        <h3>
          <span className="etiqueta text-ink-2">Dados</span>
        </h3>
        <dl className="grid gap-3 text-sm">
          {dados.map(([nome, valor, mono]) => (
            <div key={nome} className="grid min-w-0 gap-1">
              <dt className="etiqueta text-ink-2">{nome}</dt>
              <dd className={cn("break-all", mono && "font-mono text-xs")}>{valor}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby={`${idDoTitulo}-payload`} className="grid gap-2">
        <div className="flex items-center justify-between gap-3">
          <h3 id={`${idDoTitulo}-payload`}>
            <span className="etiqueta text-ink-2">Payload</span>
          </h3>
          <Button variant="quiet" onClick={() => void copiar()}>
            Copiar
          </Button>
        </div>
        <pre className="max-h-dvh overflow-auto border border-line bg-surface-2 p-3 font-mono text-xs">{payload}</pre>
      </section>

      <p className="text-xs text-ink-2">
        Eventos são fatos imutáveis; só o processamento pode ser repetido. Campos sensíveis aparecem mascarados.
      </p>
    </article>
  );
}
