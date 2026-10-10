"use client";

import { useEffect, useRef, useState } from "react";
import {
  CATEGORIAS_EVENTO,
  RESULTADOS_HISTORICO,
  STATUS_EVENTO,
  type Evento,
  type EventosResposta,
  type HistoricoEvento,
  type ResultadoHistorico,
  type StatusEvento,
} from "@finnagent/contracts";
import { Button } from "../../components/ui/button";
import { Chip } from "../../components/ui/chip";
import { cn, focusRing } from "../../components/ui/cn";
import { PageHeader } from "../../components/ui/page-header";
import { useToast } from "../../components/ui/toast";

const field = `min-h-10 rounded-sm border border-line bg-surface px-3 text-base text-ink ${focusRing}`;
const dialogClass =
  "mt-auto mb-0 w-full max-w-none rounded-t-lg border border-line bg-surface p-6 text-ink backdrop:bg-overlay/80 tab:m-auto tab:max-w-2xl tab:rounded-lg";
const celula = "border-b border-line px-3 py-3 align-top";
const cabeca = "border-b border-line px-3 py-3 text-left align-top font-semibold whitespace-nowrap text-ink-2";

export default function EventosPage() {
  const toast = useToast();
  const [dados, setDados] = useState<EventosResposta | null>(null);
  const [erro, setErro] = useState(false);
  const [visao, setVisao] = useState<"eventos" | "historico">("eventos");
  const [categoria, setCategoria] = useState("");
  const [status, setStatus] = useState("");
  const [busca, setBusca] = useState("");
  const [resultado, setResultado] = useState("");
  const [buscaHistorico, setBuscaHistorico] = useState("");
  const [aberto, setAberto] = useState<Evento | null>(null);
  const detalhes = useRef<HTMLDialogElement>(null);
  const categorias = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    let ativo = true;
    fetch("/api/eventos")
      .then(async (resposta) => {
        if (!resposta.ok) throw new Error("falha");
        return (await resposta.json()) as EventosResposta;
      })
      .then((corpo) => {
        if (ativo) setDados(corpo);
      })
      .catch(() => {
        if (!ativo) return;
        setErro(true);
        toast.erro("Não foi possível carregar os eventos.");
      });
    return () => {
      ativo = false;
    };
  }, [toast]);

  useEffect(() => {
    const dialog = detalhes.current;
    if (!dialog) return;
    if (aberto && !dialog.open) dialog.showModal();
  }, [aberto]);

  const events = dados?.events ?? [];
  const history = dados?.history ?? [];
  const categories = dados?.categories ?? [...CATEGORIAS_EVENTO];
  const termo = busca.trim().toLowerCase();
  const termoHistorico = buscaHistorico.trim().toLowerCase();
  const filtrados = events.filter((evento) => {
    if (categoria && evento.category !== categoria) return false;
    if (status && evento.status !== status) return false;
    return `${evento.type} ${evento.aggregate} ${evento.origin}`.toLowerCase().includes(termo);
  });
  const historico = history.filter((linha) => {
    if (resultado && linha.result !== resultado) return false;
    return `${linha.eventType} ${linha.consumer}`.toLowerCase().includes(termoHistorico);
  });
  const historicoDoAberto = aberto ? history.filter((linha) => linha.eventId === aberto.id) : [];

  function abrir(evento: Evento) {
    setAberto(evento);
  }

  return (
    <>
      <PageHeader
        title="Eventos"
        subtitle="Fatos registrados pelo sistema e o que aconteceu com cada um."
        actions={
          <>
            <div className="inline-flex rounded-sm border border-line bg-surface" role="group" aria-label="Visão">
              {(
                [
                  ["eventos", "Eventos"],
                  ["historico", "Histórico"],
                ] as const
              ).map(([id, rotulo], indice) => (
                <Button
                  key={id}
                  variant="quiet"
                  aria-pressed={visao === id}
                  className={cn(
                    "rounded-none border-0",
                    indice === 0 && "rounded-l-sm",
                    indice === 1 && "rounded-r-sm",
                    visao === id && "bg-brand-soft text-brand!",
                  )}
                  onClick={() => setVisao(id)}
                >
                  {rotulo}
                </Button>
              ))}
            </div>
            <Button onClick={() => categorias.current?.showModal()}>Categorias</Button>
          </>
        }
      />

      {!erro && !dados ? <p className="text-sm text-ink-2">Carregando eventos.</p> : null}

      {dados && visao === "eventos" ? (
        <section aria-label="Eventos">
          <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Categoria">
            <Button
              aria-pressed={categoria === ""}
              className={classeCategoria(categoria === "")}
              onClick={() => setCategoria("")}
            >
              Todas ({events.length})
            </Button>
            {categories.map((item) => {
              const quantidade = events.filter((evento) => evento.category === item.code).length;
              const ativa = categoria === item.code;
              return (
                <Button
                  key={item.code}
                  aria-pressed={ativa}
                  className={classeCategoria(ativa)}
                  onClick={() => setCategoria(item.code)}
                >
                  {item.name} ({quantidade})
                </Button>
              );
            })}
          </div>
          <div className="mb-4 flex flex-wrap gap-2">
            <select
              aria-label="Status"
              className={field}
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="">Todos os status</option>
              {STATUS_EVENTO.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <input
              type="search"
              aria-label="Buscar eventos"
              placeholder="Buscar por tipo, agregado ou origem"
              className={cn(field, "min-w-56 flex-1")}
              value={busca}
              onChange={(event) => setBusca(event.target.value)}
            />
          </div>
          <div className="min-w-0 overflow-x-auto rounded-lg border border-line bg-surface">
            <table className="w-full min-w-[720px] border-separate border-spacing-0 text-sm">
              <caption className="sr-only">Eventos</caption>
              <thead>
                <tr>
                  {["Quando", "Evento", "Categoria", "Origem", "Agregado", "Status", ""].map((coluna) => (
                    <th key={coluna || "acao"} className={cabeca}>
                      {coluna}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtrados.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-ink-2">
                      Nenhum evento com esses filtros.
                    </td>
                  </tr>
                ) : (
                  filtrados.map((evento) => (
                    <tr key={evento.id} className="last:[&>td]:border-b-0">
                      <td className={cn(celula, "whitespace-nowrap")}>{quando(evento.occurredAt)}</td>
                      <td className={celula}>
                        <strong className="font-mono font-semibold">{evento.type}</strong>
                      </td>
                      <td className={celula}>
                        <Chip>{nomeCategoria(evento.category, categories)}</Chip>
                      </td>
                      <td className={celula}>{evento.origin}</td>
                      <td className={celula}>{evento.aggregate}</td>
                      <td className={celula}>
                        <Chip tone={tomStatus(evento.status)}>{evento.status}</Chip>
                      </td>
                      <td className={celula}>
                        <Button variant="quiet" onClick={() => abrir(evento)}>
                          Detalhes
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {dados && visao === "historico" ? (
        <section aria-label="Histórico">
          <div className="mb-4 flex flex-wrap gap-2">
            <select
              aria-label="Resultado"
              className={field}
              value={resultado}
              onChange={(event) => setResultado(event.target.value)}
            >
              <option value="">Todos os resultados</option>
              {RESULTADOS_HISTORICO.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <input
              type="search"
              aria-label="Buscar no histórico"
              placeholder="Buscar por evento ou consumidor"
              className={cn(field, "min-w-56 flex-1")}
              value={buscaHistorico}
              onChange={(event) => setBuscaHistorico(event.target.value)}
            />
          </div>
          <div className="min-w-0 overflow-x-auto rounded-lg border border-line bg-surface">
            <table className="w-full min-w-[720px] border-separate border-spacing-0 text-sm">
              <caption className="sr-only">Histórico</caption>
              <thead>
                <tr>
                  {["Quando", "Evento", "Consumidor", "Tentativa", "Duração", "Resultado"].map((coluna) => (
                    <th key={coluna} className={cabeca}>
                      {coluna}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {historico.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-ink-2">
                      Nenhum registro com esses filtros.
                    </td>
                  </tr>
                ) : (
                  historico.map((linha) => (
                    <LinhaHistorico
                      key={`${linha.eventId}:${linha.occurredAt}:${linha.attempt}`}
                      linha={linha}
                      onAbrir={() => {
                        const evento = events.find((item) => item.id === linha.eventId);
                        if (evento) abrir(evento);
                      }}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <dialog ref={detalhes} className={dialogClass} aria-labelledby="titulo-evento" onClose={() => setAberto(null)}>
        {aberto ? (
          <>
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 id="titulo-evento" className="flex flex-wrap items-center gap-2 font-display text-lg">
                  <span className="font-mono break-all">{aberto.type}</span>
                  <Chip tone={tomStatus(aberto.status)}>{aberto.status}</Chip>
                </h2>
                <p className="text-sm break-all text-ink-2">
                  Ocorrido em {quando(aberto.occurredAt)} · {aberto.id}
                </p>
              </div>
              <Button variant="quiet" onClick={() => detalhes.current?.close()}>
                Fechar
              </Button>
            </div>
            <div className="max-h-[62dvh] overflow-auto">
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                <dt className="text-ink-2">Categoria</dt>
                <dd className="break-words">{nomeCategoria(aberto.category, categories)}</dd>
                <dt className="text-ink-2">Origem</dt>
                <dd className="break-words">{aberto.origin}</dd>
                <dt className="text-ink-2">Agregado</dt>
                <dd className="break-words">{aberto.aggregate}</dd>
                <dt className="text-ink-2">Correlação</dt>
                <dd className="font-mono break-all">{aberto.correlationId ?? "—"}</dd>
                <dt className="text-ink-2">Causado por</dt>
                <dd className="font-mono break-all">{aberto.causationId ?? "—"}</dd>
                <dt className="text-ink-2">Chave de idempotência</dt>
                <dd className="font-mono break-all">{aberto.idempotencyKey}</dd>
                <dt className="text-ink-2">Versão do schema</dt>
                <dd>{aberto.schemaVersion}</dd>
              </dl>
              <h3 id="payload-evento" className="mt-4 mb-2 font-display text-base">
                Payload
              </h3>
              <pre
                aria-labelledby="payload-evento"
                className="overflow-auto rounded-md border border-line bg-surface-2 p-3 font-mono text-sm"
              >
                {JSON.stringify(aberto.payload, null, 2)}
              </pre>
              <h3 id="historico-evento" className="mt-4 mb-2 font-display text-base">
                Histórico de processamento
              </h3>
              {historicoDoAberto.length === 0 ? (
                <p className="text-sm text-ink-2">
                  {aberto.status === "pendente"
                    ? "Sem histórico: o evento ainda não foi publicado pela outbox."
                    : "Sem histórico: o evento foi publicado e ainda não foi consumido."}
                </p>
              ) : (
                <div className="min-w-0 overflow-x-auto rounded-md border border-line">
                  <table
                    aria-labelledby="historico-evento"
                    className="w-full min-w-[520px] border-separate border-spacing-0 text-sm"
                  >
                    <thead>
                      <tr>
                        {["Consumidor", "Tentativa", "Duração", "Resultado"].map((coluna) => (
                          <th key={coluna} className={cabeca}>
                            {coluna}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {historicoDoAberto.map((linha) => (
                        <tr key={`${linha.consumer}:${linha.attempt}:${linha.occurredAt}`} className="last:[&>td]:border-b-0">
                          <td className={celula}>{linha.consumer}</td>
                          <td className={celula}>{linha.attempt}</td>
                          <td className={cn(celula, "whitespace-nowrap")}>{duracao(linha.durationMs)}</td>
                          <td className={celula}>
                            <Chip tone={tomResultado(linha.result)}>{linha.result}</Chip>
                            {linha.error ? <div className="text-sm text-neg">{linha.error}</div> : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <p className="mt-4 text-sm text-ink-2">
              Eventos são fatos imutáveis; só o processamento pode ser repetido.
            </p>
          </>
        ) : null}
      </dialog>

      <dialog ref={categorias} className={dialogClass} aria-labelledby="titulo-categorias">
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 id="titulo-categorias" className="font-display text-lg">
            Categorias de evento
          </h2>
          <Button variant="quiet" onClick={() => categorias.current?.close()}>
            Fechar
          </Button>
        </div>
        <div className="max-h-[62dvh] overflow-auto">
          <ul className="overflow-hidden rounded-md border border-line">
            {categories.map((item) => (
              <li
                key={item.code}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3 last:border-b-0"
              >
                <div>
                  <strong>{item.name}</strong> <span className="font-mono text-sm text-ink-2">{item.code}</span>
                  <div className="text-sm text-ink-2">{item.description}</div>
                </div>
                <div className="flex gap-2">
                  <Chip>{events.filter((evento) => evento.category === item.code).length} eventos</Chip>
                  <Chip tone={item.active ? "ok" : "default"}>{item.active ? "ativa" : "inativa"}</Chip>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </dialog>
    </>
  );
}

function classeCategoria(ativa: boolean) {
  return cn("px-3 font-medium text-ink-2!", ativa && "border-brand bg-brand-soft text-brand!");
}

function LinhaHistorico({ linha, onAbrir }: { linha: HistoricoEvento; onAbrir: () => void }) {
  return (
    <tr className="last:[&>td]:border-b-0">
      <td className={cn(celula, "whitespace-nowrap")}>{quando(linha.occurredAt)}</td>
      <td className={celula}>
        <Button variant="quiet" className="font-mono" onClick={onAbrir}>
          {linha.eventType}
        </Button>
      </td>
      <td className={celula}>{linha.consumer}</td>
      <td className={celula}>{linha.attempt}</td>
      <td className={cn(celula, "whitespace-nowrap")}>{duracao(linha.durationMs)}</td>
      <td className={celula}>
        <Chip tone={tomResultado(linha.result)}>{linha.result}</Chip>
        {linha.error ? <div className="text-sm text-neg">{linha.error}</div> : null}
      </td>
    </tr>
  );
}

function nomeCategoria(code: string, categories: EventosResposta["categories"]) {
  return categories.find((item) => item.code === code)?.name ?? code;
}

function tomStatus(status: StatusEvento) {
  if (status === "concluído") return "ok" as const;
  if (status === "com falha") return "neg" as const;
  return "default" as const;
}

function tomResultado(result: ResultadoHistorico) {
  if (result === "sucesso") return "ok" as const;
  if (result === "falha") return "neg" as const;
  return "default" as const;
}

function quando(iso: string) {
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return iso;
  const parte = (valor: number) => String(valor).padStart(2, "0");
  return `${parte(data.getDate())}/${parte(data.getMonth() + 1)} ${parte(data.getHours())}:${parte(data.getMinutes())}`;
}

function duracao(ms: number | null) {
  if (ms === null) return "—";
  if (ms >= 1000) return `${(ms / 1000).toFixed(1).replace(".", ",")} s`;
  return `${ms} ms`;
}
