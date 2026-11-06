"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { CompromissoDoDia, HojeResposta, PendenciaDoDia, Tarefa, VencimentoDoDia } from "@finnagent/contracts";
import { Button } from "../../components/ui/button";
import { Chip } from "../../components/ui/chip";
import { caixaDeMarcar, campo, cn, focusRing } from "../../components/ui/cn";
import { Carregando } from "../../components/ui/esqueleto";
import { Icone } from "../../components/ui/icone";
import { Money } from "../../components/ui/money";
import { ItemAnimado, ListaAnimada, Troca } from "../../components/ui/movimento";
import { PageHeader } from "../../components/ui/page-header";
import { useToast } from "../../components/ui/toast";
import { ROTULO_CATEGORIA } from "../financas/rotulos";

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { ...init, cache: "no-store", headers: { "content-type": "application/json", ...init?.headers } });
  if (response.status === 204) return undefined as T;
  const body = (await response.json().catch(() => ({}))) as { message?: string | string[] };
  if (!response.ok) {
    const message = Array.isArray(body.message) ? body.message[0] : body.message;
    throw new Error(message || "O backend não respondeu.");
  }
  return body as T;
}

function somarDias(iso: string, dias: number) {
  const [ano, mes, dia] = iso.split("-").map(Number);
  return new Date(Date.UTC(ano as number, (mes as number) - 1, (dia as number) + dias)).toISOString().slice(0, 10);
}

function dataLocal(iso: string) {
  const [ano, mes, dia] = iso.split("-").map(Number);
  return new Date(ano as number, (mes as number) - 1, dia as number);
}

function rotuloDoDia(iso: string) {
  const texto = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long" }).format(dataLocal(iso));
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** "5 de nov", para a tarefa ou o vencimento que ficou de outro dia. */
function rotuloCurto(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short" }).format(dataLocal(iso)).replace(".", "");
}

function detalhesDoVencimento(item: VencimentoDoDia) {
  return [item.counterparty || `${item.groupName} › ${item.sessionName}`, ROTULO_CATEGORIA[item.category]].join(" · ");
}

export default function Hoje() {
  const toast = useToast();
  const [dia, setDia] = useState<string | null>(null);
  const [dados, setDados] = useState<HojeResposta | null>(null);
  const [falhou, setFalhou] = useState(false);
  const [ocupado, setOcupado] = useState("");
  const [deslize, setDeslize] = useState(0);
  const [novo, setNovo] = useState("");
  const [editando, setEditando] = useState<string | null>(null);

  const carregar = useCallback(
    (alvo: string | null) =>
      api<HojeResposta>(alvo ? `/api/hoje?date=${alvo}` : "/api/hoje")
        .then((resposta) => {
          setDados(resposta);
          setFalhou(false);
          return resposta;
        })
        .catch((error: Error) => {
          setFalhou(true);
          toast.erro(error.message);
          return null;
        }),
    [toast],
  );

  useEffect(() => {
    let ativo = true;
    carregar(dia).then((resposta) => {
      if (ativo && resposta && dia === null) setDia(resposta.date);
    });
    return () => {
      ativo = false;
    };
  }, [dia, carregar]);

  async function agir(chave: string, acao: () => Promise<unknown>, erro: string) {
    if (ocupado) return false;
    setOcupado(chave);
    try {
      await acao();
      await carregar(dia);
      return true;
    } catch (error) {
      toast.erro(error instanceof Error ? error.message : erro);
      return false;
    } finally {
      setOcupado("");
    }
  }

  function mudar(delta: number) {
    if (!dados) return;
    setDeslize(delta);
    setDia(somarDias(dados.date, delta));
  }

  async function adicionar(event: React.FormEvent) {
    event.preventDefault();
    const title = novo.trim();
    if (!title || !dados) return;
    setNovo("");
    await agir(
      "nova",
      () => api("/api/tarefas", { method: "POST", body: JSON.stringify({ id: crypto.randomUUID(), title, date: dados.date }) }),
      "Não foi possível anotar a tarefa.",
    );
  }

  const tarefa = (item: Tarefa, done: boolean) =>
    agir(item.id, () => api(`/api/tarefas/${item.id}/concluir`, { method: "PATCH", body: JSON.stringify({ done }) }), "Não foi possível marcar a tarefa.");

  const apagarTarefa = (item: Tarefa) =>
    agir(`apagar-${item.id}`, () => api(`/api/tarefas/${item.id}`, { method: "DELETE" }), "Não foi possível apagar a tarefa.");

  const salvarTarefa = async (item: Tarefa, title: string, date: string) => {
    const feito = await agir(
      `editar-${item.id}`,
      () => api(`/api/tarefas/${item.id}`, { method: "PATCH", body: JSON.stringify({ title, date }) }),
      "Não foi possível salvar a tarefa.",
    );
    if (feito) setEditando(null);
  };

  const compromisso = (item: CompromissoDoDia, done: boolean) =>
    agir(
      item.id,
      () => api(`/api/compromissos/${item.id}/status`, { method: "PATCH", body: JSON.stringify({ status: done ? "done" : "undone" }) }),
      "Não foi possível marcar o compromisso.",
    );

  // Marcar paga na data de hoje: a parcela e o empréstimo registram um pagamento (desmarcar desfaz esse pagamento);
  // a única e a recorrente mudam a ocorrência para paga, no dia de hoje.
  const vencimento = (item: VencimentoDoDia, done: boolean) =>
    agir(
      `${item.entryId}:${item.number}`,
      () => {
        const hoje = dados?.today ?? dados?.date;
        if (item.series && done) {
          return api(`/api/lancamentos/${item.entryId}/pagamentos`, { method: "POST", body: JSON.stringify({ date: hoje, cents: Math.abs(item.cents) }) });
        }
        if (item.series && item.paymentId) {
          return api(`/api/lancamentos/${item.entryId}/pagamentos/${item.paymentId}`, { method: "DELETE" });
        }
        return api(`/api/lancamentos/${item.entryId}/ocorrencias/${item.number}`, {
          method: "PATCH",
          body: JSON.stringify(done ? { status: "completed", paidOn: hoje } : { status: "pending" }),
        });
      },
      "Não foi possível marcar o pagamento.",
    );

  const atrasados = dados ? dados.vencimentos.filter((item) => item.situation === "late") : [];
  const doDia = dados ? dados.vencimentos.filter((item) => item.situation !== "late") : [];
  const abertas = dados
    ? dados.compromissos.filter((item) => item.status !== "done").length +
      dados.vencimentos.filter((item) => item.situation !== "completed").length +
      dados.tarefas.filter((item) => !item.doneOn).length
    : 0;
  const total = dados ? dados.compromissos.length + dados.vencimentos.length + dados.tarefas.length : 0;
  const feitas = total - abertas;
  const ehHoje = dados ? dados.date === dados.today : true;
  const vazio = dados ? total === 0 && dados.pendencias.length === 0 : false;

  return (
    <PageHeader
      title="Hoje"
      subtitle={dados ? rotuloDoDia(dados.date) : undefined}
      actions={
        <>
          <Button variant="quiet" className="min-w-10 px-0" aria-label="Dia anterior" onClick={() => mudar(-1)} disabled={!dados}>
            ‹
          </Button>
          <Button variant="quiet" onClick={() => setDia(dados?.today ?? null)} disabled={!dados || ehHoje}>
            Hoje
          </Button>
          <Button variant="quiet" className="min-w-10 px-0" aria-label="Dia seguinte" onClick={() => mudar(1)} disabled={!dados}>
            ›
          </Button>
        </>
      }
    >
      <div className="grid min-w-0 max-w-prose gap-4">
        {!dados && !falhou ? <Carregando texto="Carregando o dia." linhas={6} /> : null}
        {dados ? (
          <Troca id={dados.date} direcao={deslize} className="grid min-w-0 gap-4">
            {total > 0 ? (
              <div className="grid gap-2" aria-label="Andamento do dia">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="etiqueta text-ink-2">{feitas === total ? "Tudo feito" : "Andamento"}</span>
                  <span className="text-sm tabular-nums text-ink-2">
                    {feitas} de {total}
                  </span>
                </div>
                <div className="h-1 w-full bg-surface-2">
                  <div className="h-1 bg-brand" style={{ width: `${Math.round((feitas / total) * 100)}%` }} />
                </div>
              </div>
            ) : null}

            {/* Uma lista só, como uma lista de papel: o campo de anotar é a primeira linha. */}
            <div className="rounded-lg border border-line bg-surface">
              <form onSubmit={(event) => void adicionar(event)} className="flex min-w-0 items-center gap-3 border-b border-line px-4 py-2">
                <span className="size-4 shrink-0 border border-dashed border-line" aria-hidden />
                <label htmlFor="nova-tarefa" className="sr-only">
                  Nova tarefa
                </label>
                <input
                  id="nova-tarefa"
                  className={cn("min-h-10 min-w-0 flex-1 bg-transparent text-base text-ink placeholder:text-ink-2", focusRing)}
                  placeholder={ehHoje ? "Anotar uma tarefa para hoje" : `Anotar para ${rotuloCurto(dados.date)}`}
                  maxLength={160}
                  value={novo}
                  onChange={(event) => setNovo(event.target.value)}
                />
                <Button type="submit" variant="quiet" aria-label="Adicionar tarefa" className="size-10 px-0" disabled={!novo.trim() || ocupado !== ""}>
                  <Icone name="add" />
                </Button>
              </form>

              {vazio ? <p className="px-4 py-6 text-sm text-ink-2">Nada marcado para este dia.</p> : null}

              <Grupo titulo="Atrasados" vazio={atrasados.length === 0}>
                {atrasados.map((item) => (
                  <Linha
                    key={`${item.entryId}:${item.number}`}
                    chave={`${item.entryId}:${item.number}`}
                    feito={false}
                    ocupado={ocupado === `${item.entryId}:${item.number}`}
                    rotulo={`Pagamento ${item.description}`}
                    onMarcar={(done) => void vencimento(item, done)}
                    titulo={item.description}
                    detalhe={detalhesDoVencimento(item)}
                    chip={<Chip tone="neg">Venceu em {rotuloCurto(item.dueDate)}</Chip>}
                    lado={<Money cents={item.cents} strong />}
                  />
                ))}
              </Grupo>

              <Grupo titulo="Compromissos" vazio={dados.compromissos.length === 0}>
                {dados.compromissos.map((item) => (
                  <Linha
                    key={item.id}
                    chave={item.id}
                    feito={item.status === "done"}
                    ocupado={ocupado === item.id}
                    rotulo={`Compromisso ${item.title}`}
                    onMarcar={(done) => void compromisso(item, done)}
                    hora={item.allDay ? "Dia todo" : item.time}
                    titulo={item.title}
                    detalhe={[item.location, item.endTime ? `até ${item.endTime}` : ""].filter(Boolean).join(" · ")}
                    lado={<Chip tone="event">{item.calendar}</Chip>}
                  />
                ))}
              </Grupo>

              <Grupo titulo={ehHoje ? "Pagamentos de hoje" : "Pagamentos do dia"} vazio={doDia.length === 0}>
                {doDia.map((item) => (
                  <Linha
                    key={`${item.entryId}:${item.number}`}
                    chave={`${item.entryId}:${item.number}`}
                    feito={item.situation === "completed"}
                    ocupado={ocupado === `${item.entryId}:${item.number}`}
                    rotulo={`Pagamento ${item.description}`}
                    onMarcar={(done) => void vencimento(item, done)}
                    titulo={item.description}
                    detalhe={detalhesDoVencimento(item)}
                    lado={<Money cents={item.cents} strong />}
                  />
                ))}
              </Grupo>

              <Grupo titulo="Para fazer" vazio={dados.tarefas.every((item) => item.doneOn) && dados.pendencias.length === 0}>
                {dados.tarefas
                  .filter((item) => !item.doneOn)
                  .map((item) =>
                    editando === item.id ? (
                      <EdicaoDaTarefa
                        key={item.id}
                        item={item}
                        ocupado={ocupado === `editar-${item.id}`}
                        onSalvar={(title, date) => void salvarTarefa(item, title, date)}
                        onCancelar={() => setEditando(null)}
                      />
                    ) : (
                      <Linha
                        key={item.id}
                        chave={item.id}
                        feito={false}
                        ocupado={ocupado === item.id}
                        rotulo={`Tarefa ${item.title}`}
                        onMarcar={(done) => void tarefa(item, done)}
                        titulo={item.title}
                        chip={item.date < dados.date ? <Chip tone="pending">Ficou de {rotuloCurto(item.date)}</Chip> : null}
                        onEditar={() => setEditando(item.id)}
                        onApagar={() => void apagarTarefa(item)}
                      />
                    ),
                  )}
                {dados.pendencias.map((item) => (
                  <Pendencia key={item.id} item={item} />
                ))}
              </Grupo>

              <Grupo titulo="Feito" vazio={!dados.tarefas.some((item) => item.doneOn)}>
                {dados.tarefas
                  .filter((item) => item.doneOn)
                  .map((item) => (
                    <Linha
                      key={item.id}
                      chave={item.id}
                      feito
                      ocupado={ocupado === item.id}
                      rotulo={`Tarefa ${item.title}`}
                      onMarcar={(done) => void tarefa(item, done)}
                      titulo={item.title}
                      onApagar={() => void apagarTarefa(item)}
                    />
                  ))}
              </Grupo>
            </div>
          </Troca>
        ) : null}
      </div>
    </PageHeader>
  );
}

/** Um grupo da lista: a etiqueta como linha de cabeçalho e as linhas abaixo, no mesmo quadro. */
function Grupo({ titulo, vazio, children }: { titulo: string; vazio: boolean; children: React.ReactNode }) {
  if (vazio) return null;
  return (
    <section aria-label={titulo} className="border-b border-line last:border-b-0">
      <h2 className="etiqueta bg-surface-2 px-4 py-2 text-ink-2">{titulo}</h2>
      <ListaAnimada className="grid min-w-0">{children}</ListaAnimada>
    </section>
  );
}

/**
 * Uma linha da lista: a caixa, a hora quando há, o título com o detalhe em texto, e o valor ou o chip à direita.
 * O que já foi feito fica riscado e apagado, sem sair do lugar.
 */
function Linha({
  chave,
  feito,
  ocupado,
  rotulo,
  onMarcar,
  hora,
  titulo,
  detalhe,
  chip,
  lado,
  onEditar,
  onApagar,
}: {
  chave: string;
  feito: boolean;
  ocupado: boolean;
  rotulo: string;
  onMarcar: (done: boolean) => void;
  hora?: string | null;
  titulo: string;
  detalhe?: string;
  chip?: React.ReactNode;
  lado?: React.ReactNode;
  onEditar?: () => void;
  onApagar?: () => void;
}) {
  const id = `item-${chave}`;
  return (
    <ItemAnimado className={cn("group flex min-w-0 items-center gap-3 border-b border-line px-4 py-2 last:border-b-0", feito && "text-ink-2")}>
      <input
        id={id}
        type="checkbox"
        className={caixaDeMarcar}
        checked={feito}
        disabled={ocupado}
        aria-label={feito ? `Desmarcar: ${rotulo}` : `Marcar como feito: ${rotulo}`}
        onChange={(event) => onMarcar(event.target.checked)}
      />
      {hora !== undefined ? <time className="w-16 shrink-0 text-sm tabular-nums text-ink-2">{hora ?? ""}</time> : null}
      <label htmlFor={id} className="flex min-h-10 min-w-0 flex-1 cursor-pointer flex-col justify-center gap-1 py-1">
        <span className={cn("min-w-0 truncate font-medium", feito && "line-through")}>{titulo}</span>
        {detalhe || chip ? (
          <span className="flex min-w-0 flex-wrap items-center gap-2 text-sm text-ink-2">
            {chip}
            {detalhe ? <span className="min-w-0 truncate">{detalhe}</span> : null}
          </span>
        ) : null}
      </label>
      <span className="flex shrink-0 items-center gap-1">
        {lado}
        {onEditar ? (
          <Button type="button" variant="quiet" className="size-10 px-0" aria-label={`Editar: ${rotulo}`} disabled={ocupado} onClick={onEditar}>
            <Icone name="edit" />
          </Button>
        ) : null}
        {onApagar ? (
          <Button type="button" variant="quiet" className="size-10 px-0" aria-label={`Apagar: ${rotulo}`} disabled={ocupado} onClick={onApagar}>
            <Icone name="remove" />
          </Button>
        ) : null}
      </span>
    </ItemAnimado>
  );
}

/** A tarefa em edição, no lugar dela: o texto e o dia; Enter salva, Escape cancela. */
function EdicaoDaTarefa({
  item,
  ocupado,
  onSalvar,
  onCancelar,
}: {
  item: Tarefa;
  ocupado: boolean;
  onSalvar: (title: string, date: string) => void;
  onCancelar: () => void;
}) {
  const [title, setTitle] = useState(item.title);
  const [date, setDate] = useState(item.date);
  return (
    <ItemAnimado className="border-b border-line px-4 py-2 last:border-b-0">
      <form
        className="flex min-w-0 flex-wrap items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (title.trim()) onSalvar(title.trim(), date);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") onCancelar();
        }}
      >
        <label htmlFor={`editar-${item.id}`} className="sr-only">
          Texto da tarefa
        </label>
        <input
          id={`editar-${item.id}`}
          autoFocus
          className={cn(campo, "min-w-0 flex-1")}
          maxLength={160}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
        <label htmlFor={`editar-dia-${item.id}`} className="sr-only">
          Dia da tarefa
        </label>
        <input id={`editar-dia-${item.id}`} type="date" className={campo} value={date} onChange={(event) => setDate(event.target.value)} />
        <Button type="submit" variant="default" disabled={ocupado || !title.trim()}>
          Salvar
        </Button>
        <Button type="button" variant="quiet" disabled={ocupado} onClick={onCancelar}>
          Cancelar
        </Button>
      </form>
    </ItemAnimado>
  );
}

/** Uma pendência que o sistema enxerga: não se marca, leva para a tela que resolve. */
function Pendencia({ item }: { item: PendenciaDoDia }) {
  return (
    <ItemAnimado className="flex min-w-0 items-center gap-3 border-b border-line px-4 py-2 last:border-b-0">
      <span className="size-4 shrink-0 border border-dashed border-line" aria-hidden />
      <Link href={item.href} className={cn("flex min-h-10 min-w-0 flex-1 flex-col justify-center gap-1 py-1 text-ink no-underline hover:text-brand", focusRing)}>
        <span className="flex min-w-0 items-center gap-2">
          <span className="min-w-0 truncate font-medium">{item.title}</span>
          <span className="shrink-0 text-ink-2" aria-hidden>
            →
          </span>
        </span>
        <span className="text-sm text-ink-2">{item.detail}</span>
      </Link>
    </ItemAnimado>
  );
}
