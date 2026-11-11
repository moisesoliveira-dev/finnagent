"use client";

import Link from "next/link";
import { Fragment, useCallback, useEffect, useState } from "react";
import {
  REPETICOES_DE_TAREFA,
  ROTULO_DA_REPETICAO,
  type CompromissoDoDia,
  type HojeResposta,
  type PendenciaDoDia,
  type PerguntaDeGasto,
  type RepeticaoDeTarefa,
  type Tarefa,
  type UsoDoLimite,
  type VencimentoDoDia,
} from "@finnagent/contracts";
import { Button } from "../../components/ui/button";
import { Chip } from "../../components/ui/chip";
import { Dialogo } from "../../components/ui/dialogo";
import { caixaDeMarcar, campo, cn, focusRing } from "../../components/ui/cn";
import { Carregando } from "../../components/ui/esqueleto";
import { Icone } from "../../components/ui/icone";
import { formatarReais, Money } from "../../components/ui/money";
import { ItemAnimado, ListaAnimada, Troca } from "../../components/ui/movimento";
import { PageHeader } from "../../components/ui/page-header";
import { useToast } from "../../components/ui/toast";
import { useApagarComDesfazer } from "../../components/ui/use-apagar-com-desfazer";
import { CampoValor } from "../financas/campo-valor";
import { reaisParaCentavos } from "../financas/reais";
import { ROTULO_CATEGORIA } from "../financas/rotulos";
import { MenuDaLinha, type OpcaoDaLinha } from "./menu-da-linha";

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

/** O recuo de cada nível da árvore, em pixels: a caixa da filha alinha com o texto da mãe. */
const RECUO = 28;
/** O arraste que passa disso para a direita, abaixo de uma linha, põe a tarefa dentro dela. */
const RECUO_PARA_ENTRAR = 40;

/** A faixa índigo à esquerda do compromisso e do checklist dele: os itens ficam presos ao compromisso. */
const faixaDoCompromisso = "border-l-4 border-l-event";
const linhaDeCampo = "min-w-0 border-b border-line py-2 pr-4 last:border-b-0";
/** O recuo do conteúdo da linha no nível dado, descontando a faixa de 4 px quando há. */
const recuo = (nivel: number, faixa = false) => 16 + nivel * RECUO - (faixa ? 4 : 0);

type Alvo = { id: string; posicao: "antes" | "depois"; dentro: boolean };
type Arraste = { id: string; alvo: Alvo | null };

function descendentes(tarefas: Tarefa[], id: string): string[] {
  const filhos = tarefas.filter((item) => item.parentId === id).map((item) => item.id);
  return filhos.flatMap((filho) => [filho, ...descendentes(tarefas, filho)]);
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
  // A atividade que está recebendo uma subatividade nova, e o texto dela.
  const [novaSub, setNovaSub] = useState<string | null>(null);
  const [textoSub, setTextoSub] = useState("");
  // O compromisso com o campo de novo item do checklist aberto.
  const [novoItem, setNovoItem] = useState<string | null>(null);
  const [textoItem, setTextoItem] = useState("");
  const [arraste, setArraste] = useState<Arraste | null>(null);
  // A tarefa solta que a pessoa quer levar para o checklist de um compromisso do dia.
  const [levando, setLevando] = useState<Tarefa | null>(null);

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

  const { ocultos, apagar: apagarComDesfazer } = useApagarComDesfazer(() => carregar(dia));

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

  /** Um item no checklist do compromisso, no dia da tela (o dia da ocorrência). */
  async function adicionarItem(item: CompromissoDoDia) {
    const title = textoItem.trim();
    if (!title || !dados) return;
    const feito = await agir(
      `item-${item.id}`,
      () => api("/api/tarefas", { method: "POST", body: JSON.stringify({ id: crypto.randomUUID(), title, date: dados.date, appointmentId: item.id }) }),
      "Não foi possível anotar o item.",
    );
    if (feito) setTextoItem("");
  }

  const copiarChecklist = (item: CompromissoDoDia) =>
    agir(
      `copiar-${item.id}`,
      () => api(`/api/compromissos/${item.id}/checklist/copiar`, { method: "POST", body: JSON.stringify({ date: dados?.date }) }),
      "Não foi possível trazer o checklist.",
    ).then((feito) => {
      if (feito) toast.sucesso(`Checklist de ${item.title} trazido da última vez, com tudo aberto.`);
    });

  async function adicionarSub(pai: Tarefa) {
    const title = textoSub.trim();
    if (!title) return;
    const feito = await agir(
      `sub-${pai.id}`,
      () => api("/api/tarefas", { method: "POST", body: JSON.stringify({ id: crypto.randomUUID(), title, date: pai.date, parentId: pai.id }) }),
      "Não foi possível anotar a subatividade.",
    );
    if (feito) setTextoSub("");
  }

  const tarefa = (item: Tarefa, done: boolean) =>
    agir(item.id, () => api(`/api/tarefas/${item.id}/concluir`, { method: "PATCH", body: JSON.stringify({ done }) }), "Não foi possível marcar a tarefa.");

  // Apagar some da lista na hora, com "Desfazer": o servidor só é chamado quando o prazo acaba.
  const apagarTarefa = (item: Tarefa) =>
    apagarComDesfazer(
      item.id,
      (dados?.tarefas ?? []).some((outra) => outra.parentId === item.id) ? "Tarefa e subatividades apagadas." : "Tarefa apagada.",
      () => api(`/api/tarefas/${item.id}`, { method: "DELETE" }),
    );

  const salvarTarefa = async (item: Tarefa, title: string, date: string, repeat: RepeticaoDeTarefa | null) => {
    const feito = await agir(
      `editar-${item.id}`,
      () => api(`/api/tarefas/${item.id}`, { method: "PATCH", body: JSON.stringify({ title, date, repeat }) }),
      "Não foi possível salvar a tarefa.",
    );
    if (feito) setEditando(null);
  };

  const mover = (item: Tarefa, parentId: string | null, beforeId: string | null) =>
    agir(
      `mover-${item.id}`,
      () => api(`/api/tarefas/${item.id}/mover`, { method: "PATCH", body: JSON.stringify({ parentId, beforeId }) }),
      "Não foi possível mover a tarefa.",
    );

  /** Leva a tarefa da raiz, com a árvore, para o checklist do compromisso; com `null`, volta para as soltas do dia. */
  const levarPara = (item: Tarefa, appointmentId: string | null) =>
    agir(
      `mover-${item.id}`,
      () =>
        api(`/api/tarefas/${item.id}/mover`, {
          method: "PATCH",
          body: JSON.stringify({ parentId: null, beforeId: null, appointmentId, date: dados?.date }),
        }),
      appointmentId ? "Não foi possível levar a tarefa para o compromisso." : "Não foi possível tirar o item do checklist.",
    );

  async function levarAoCompromisso(alvo: CompromissoDoDia) {
    if (!levando) return;
    const titulo = levando.title;
    const feito = await levarPara(levando, alvo.id);
    if (feito) {
      setLevando(null);
      toast.sucesso(`${titulo} foi para o checklist de ${alvo.title}.`);
    }
  }

  // "Teve gasto?": lançar vira um lançamento único pago no dia do compromisso; "Não teve" só responde.
  const lancarGasto = (item: PerguntaDeGasto, cents: number, sessionId: string) =>
    agir(
      `gasto-${item.appointmentId}-${item.date}`,
      () =>
        api(`/api/compromissos/${item.appointmentId}/gastos`, {
          method: "POST",
          body: JSON.stringify({ id: crypto.randomUUID(), date: item.date, cents, sessionId }),
        }),
      "Não foi possível lançar o gasto.",
    ).then((feito) => {
      if (feito) toast.sucesso(`Gasto de ${item.title} lançado.`);
      return feito;
    });

  const semGasto = (item: PerguntaDeGasto) =>
    agir(
      `gasto-${item.appointmentId}-${item.date}`,
      () => api(`/api/compromissos/${item.appointmentId}/sem-gasto`, { method: "POST", body: JSON.stringify({ date: item.date }) }),
      "Não foi possível responder.",
    );

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

  // As tarefas que a pessoa acabou de apagar (e as subatividades delas) saem da lista enquanto o "Desfazer" vale.
  const todasAsTarefas = dados?.tarefas ?? [];
  const escondidas = new Set(ocultos.flatMap((id) => [id, ...descendentes(todasAsTarefas, id)]));
  const tarefas = todasAsTarefas.filter((item) => !escondidas.has(item.id));
  const filhasDe = (id: string | null) => tarefas.filter((item) => item.parentId === id);
  // As tarefas soltas; o checklist de cada compromisso fica embaixo dele.
  const raizes = filhasDe(null).filter((item) => !item.appointmentId);
  const checklistDe = (id: string) => filhasDe(null).filter((item) => item.appointmentId === id);
  const arvoreDe = (id: string): Tarefa[] => filhasDe(id).flatMap((filha) => [filha, ...arvoreDe(filha.id)]);

  // ----- Arrastar e soltar: o punho segura a linha; soltar em cima ou embaixo de outra reordena, mais à direita entra nela.
  function alvoEm(x: number, y: number, arrastada: string): Alvo | null {
    const elemento = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-tarefa]");
    if (!elemento) return null;
    const id = elemento.dataset.tarefa ?? "";
    if (!id || id === arrastada || descendentes(tarefas, arrastada).includes(id)) return null;
    const caixa = elemento.getBoundingClientRect();
    const nivel = Number(elemento.dataset.nivel ?? 0);
    const posicao = y < caixa.top + caixa.height / 2 ? "antes" : "depois";
    const dentro = posicao === "depois" && x > caixa.left + 16 + nivel * RECUO + RECUO_PARA_ENTRAR;
    return { id, posicao, dentro };
  }

  function soltar(arrastada: Tarefa, alvo: Alvo) {
    const destino = tarefas.find((item) => item.id === alvo.id);
    if (!destino) return;
    if (alvo.dentro) {
      void mover(arrastada, destino.id, null);
      return;
    }
    const irmas = filhasDe(destino.parentId).filter((item) => item.id !== arrastada.id);
    const indice = irmas.findIndex((item) => item.id === destino.id);
    const beforeId = alvo.posicao === "antes" ? destino.id : (irmas[indice + 1]?.id ?? null);
    void mover(arrastada, destino.parentId, beforeId);
  }

  // ----- Uma tarefa com a árvore abaixo dela, o campo de subatividade nova e a edição no lugar.
  const atividade = (item: Tarefa, nivel: number): React.ReactNode => {
    if (!dados) return null;
    const filhas = filhasDe(item.id);
    const feitas = filhas.filter((filha) => filha.doneOn).length;
    const pai = item.parentId ? tarefas.find((outra) => outra.id === item.parentId) : null;
    const irmas = filhasDe(item.parentId);
    const posicao = irmas.findIndex((outra) => outra.id === item.id);
    const emArraste = arraste?.id === item.id;
    const alvo = arraste?.alvo?.id === item.id ? arraste.alvo : null;
    // O checklist herda a faixa do compromisso, para não parecer tarefa solta.
    const faixa = Boolean(item.appointmentId);
    const opcoes: OpcaoDaLinha[] = [
      {
        rotulo: "Subatividade",
        onClick: () => {
          setNovaSub(item.id);
          setTextoSub("");
        },
      },
      { rotulo: "Editar", onClick: () => setEditando(item.id) },
      ...(posicao > 0 ? [{ rotulo: "Subir", onClick: () => void mover(item, item.parentId, irmas[posicao - 1]?.id ?? null) }] : []),
      ...(posicao < irmas.length - 1 ? [{ rotulo: "Descer", onClick: () => void mover(item, item.parentId, irmas[posicao + 2]?.id ?? null) }] : []),
      ...(nivel === 0 && !item.appointmentId && dados.compromissos.length > 0 ? [{ rotulo: "Levar para um compromisso", onClick: () => setLevando(item) }] : []),
      ...(item.appointmentId && !item.parentId ? [{ rotulo: "Tirar do checklist", onClick: () => void levarPara(item, null) }] : []),
      ...(pai
        ? [
            {
              rotulo: "Tirar de dentro",
              onClick: () => {
                const tias = filhasDe(pai.parentId);
                const depoisDoPai = tias[tias.findIndex((outra) => outra.id === pai.id) + 1]?.id ?? null;
                void mover(item, pai.parentId, depoisDoPai);
              },
            },
          ]
        : []),
      { rotulo: "Apagar", perigo: true, onClick: () => void apagarTarefa(item) },
    ];
    return (
      <Fragment key={item.id}>
        {editando === item.id ? (
          <EdicaoDaTarefa
            item={item}
            nivel={nivel}
            faixa={faixa}
            soTexto={Boolean(item.appointmentId)}
            ocupado={ocupado === `editar-${item.id}`}
            onSalvar={(title, date, repeat) => void salvarTarefa(item, title, date, repeat)}
            onCancelar={() => setEditando(null)}
          />
        ) : (
          <Linha
            chave={item.id}
            nivel={nivel}
            faixa={faixa}
            feito={Boolean(item.doneOn)}
            ocupado={ocupado === item.id}
            rotulo={`${item.appointmentId && nivel <= 1 ? "Item do checklist" : nivel > 0 ? "Subatividade" : "Tarefa"} ${item.title}`}
            onMarcar={(done) => void tarefa(item, done)}
            titulo={item.title}
            detalhe={filhas.length > 0 ? `${feitas} de ${filhas.length}` : undefined}
            chip={
              <>
                {nivel === 0 && !item.appointmentId && item.date < dados.date && !item.doneOn ? <Chip tone="pending">Ficou de {rotuloCurto(item.date)}</Chip> : null}
                {item.repeat ? <Chip tone="info">{ROTULO_DA_REPETICAO[item.repeat]}</Chip> : null}
              </>
            }
            opcoes={opcoes}
            emArraste={emArraste}
            alvo={alvo}
            onPegar={(x, y) => setArraste({ id: item.id, alvo: alvoEm(x, y, item.id) })}
            onArrastar={(x, y) => setArraste((atual) => (atual ? { ...atual, alvo: alvoEm(x, y, atual.id) } : atual))}
            onSoltar={() => {
              if (arraste?.alvo) soltar(item, arraste.alvo);
              setArraste(null);
            }}
          />
        )}
        {filhas.map((filha) => atividade(filha, nivel + 1))}
        {novaSub === item.id ? (
          <ItemAnimado className={cn(linhaDeCampo, faixa && faixaDoCompromisso)} style={{ paddingLeft: recuo(nivel + 1, faixa) }}>
            <form
              className="flex min-w-0 items-center gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                void adicionarSub(item);
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape") setNovaSub(null);
              }}
            >
              <span className="size-4 shrink-0 border border-dashed border-line" aria-hidden />
              <label htmlFor={`sub-${item.id}`} className="sr-only">
                Nova subatividade de {item.title}
              </label>
              <input
                id={`sub-${item.id}`}
                autoFocus
                className={cn("min-h-10 min-w-0 flex-1 bg-transparent text-base text-ink placeholder:text-ink-2", focusRing)}
                placeholder="Subatividade"
                maxLength={160}
                value={textoSub}
                onChange={(event) => setTextoSub(event.target.value)}
              />
              <Button type="submit" variant="quiet" aria-label="Adicionar subatividade" className="size-10 px-0" disabled={!textoSub.trim() || ocupado !== ""}>
                <Icone name="add" />
              </Button>
              <Button type="button" variant="quiet" aria-label="Cancelar subatividade" className="size-10 px-0" onClick={() => setNovaSub(null)}>
                <Icone name="fechar" />
              </Button>
            </form>
          </ItemAnimado>
        ) : null}
      </Fragment>
    );
  };

  const atrasados = dados ? dados.vencimentos.filter((item) => item.situation === "late") : [];
  const doDia = dados ? dados.vencimentos.filter((item) => item.situation !== "late") : [];
  const abertas = dados
    ? dados.compromissos.filter((item) => item.status !== "done").length +
      dados.vencimentos.filter((item) => item.situation !== "completed").length +
      tarefas.filter((item) => !item.doneOn).length
    : 0;
  const total = dados ? dados.compromissos.length + dados.vencimentos.length + tarefas.length : 0;
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
      <div className="min-w-0">
        {!dados && !falhou ? (
          <div className="max-w-prose">
            <Carregando texto="Carregando o dia." linhas={6} />
          </div>
        ) : null}
        {dados ? (
          // No desktop, duas colunas: a lista larga e, ao lado, o resumo do dia preso no rolar. Antes disso, uma coluna.
          <Troca id={dados.date} direcao={deslize} className="flex min-w-0 flex-col gap-4 desk:flex-row desk:items-start desk:gap-8">
            {total > 0 || dados.livre ? (
              <aside aria-label="Resumo do dia" className="grid min-w-0 gap-4 desk:sticky desk:top-4 desk:order-last desk:w-72 desk:shrink-0">
                {total > 0 ? (
                  <section aria-label="Andamento do dia" className="grid gap-2 desk:gap-3 desk:rounded-lg desk:border desk:border-line desk:bg-surface desk:p-4">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="etiqueta text-ink-2">{feitas === total ? "Tudo feito" : "Andamento"}</span>
                      <span className="text-sm tabular-nums text-ink-2">
                        <span className="desk:font-display desk:text-lg desk:tracking-titulo desk:text-ink">{feitas}</span> de {total}
                      </span>
                    </div>
                    <div className="h-1 w-full bg-surface-2">
                      <div className="h-1 bg-brand" style={{ width: `${Math.round((feitas / total) * 100)}%` }} />
                    </div>
                  </section>
                ) : null}
                {dados.livre ? <Livre livre={dados.livre} limites={dados.limites} /> : null}
              </aside>
            ) : null}

            <div className="grid min-w-0 flex-1 gap-4">
              {/* Uma lista só, como uma lista de papel: o campo de anotar é a primeira linha. */}
              <div className={cn("rounded-lg border border-line bg-surface", arraste && "select-none")}>
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

                <Grupo titulo="Teve gasto?" vazio={dados.gastos.length === 0}>
                  {dados.gastos.map((item) => (
                    <PerguntaDoGasto
                      key={`${item.appointmentId}-${item.date}`}
                      item={item}
                      ontem={item.date < dados.today}
                      sessoes={dados.sessoesParaGasto}
                      ocupado={ocupado === `gasto-${item.appointmentId}-${item.date}`}
                      onLancar={(cents, sessionId) => lancarGasto(item, cents, sessionId)}
                      onSemGasto={() => void semGasto(item)}
                    />
                  ))}
                </Grupo>

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
                  {dados.compromissos.map((item) => {
                    const itens = checklistDe(item.id);
                    const todos = itens.flatMap((raiz) => [raiz, ...arvoreDe(raiz.id)]);
                    const prontos = todos.filter((tarefa) => tarefa.doneOn).length;
                    const opcoes: OpcaoDaLinha[] = [
                      {
                        rotulo: "Item do checklist",
                        onClick: () => {
                          setNovoItem(item.id);
                          setTextoItem("");
                        },
                      },
                      ...(item.repeats && itens.length === 0 ? [{ rotulo: "Trazer o checklist da última vez", onClick: () => void copiarChecklist(item) }] : []),
                    ];
                    return (
                      <Fragment key={item.id}>
                        <Linha
                          chave={item.id}
                          faixa
                          feito={item.status === "done"}
                          ocupado={ocupado === item.id || ocupado === `copiar-${item.id}`}
                          rotulo={`Compromisso ${item.title}`}
                          onMarcar={(done) => void compromisso(item, done)}
                          hora={item.allDay ? "Dia todo" : item.time}
                          titulo={item.title}
                          detalhe={[todos.length > 0 ? `Checklist ${prontos} de ${todos.length}` : "", item.location, item.endTime ? `até ${item.endTime}` : ""].filter(Boolean).join(" · ")}
                          lado={<Chip tone="event">{item.calendar}</Chip>}
                          opcoes={opcoes}
                        />
                        {itens.map((raiz) => atividade(raiz, 1))}
                        {novoItem === item.id ? (
                          <ItemAnimado className={cn(linhaDeCampo, faixaDoCompromisso)} style={{ paddingLeft: recuo(1, true) }}>
                            <form
                              className="flex min-w-0 items-center gap-2"
                              onSubmit={(event) => {
                                event.preventDefault();
                                void adicionarItem(item);
                              }}
                              onKeyDown={(event) => {
                                if (event.key === "Escape") setNovoItem(null);
                              }}
                            >
                              <span className="size-4 shrink-0 border border-dashed border-line" aria-hidden />
                              <label htmlFor={`item-novo-${item.id}`} className="sr-only">
                                Novo item do checklist de {item.title}
                              </label>
                              <input
                                id={`item-novo-${item.id}`}
                                autoFocus
                                className={cn("min-h-10 min-w-0 flex-1 bg-transparent text-base text-ink placeholder:text-ink-2", focusRing)}
                                placeholder={`Item do checklist de ${item.title}`}
                                maxLength={160}
                                value={textoItem}
                                onChange={(event) => setTextoItem(event.target.value)}
                              />
                              <Button type="submit" variant="quiet" aria-label="Adicionar item" className="size-10 px-0" disabled={!textoItem.trim() || ocupado !== ""}>
                                <Icone name="add" />
                              </Button>
                              <Button type="button" variant="quiet" aria-label="Fechar o campo do item" className="size-10 px-0" onClick={() => setNovoItem(null)}>
                                <Icone name="fechar" />
                              </Button>
                            </form>
                          </ItemAnimado>
                        ) : itens.length > 0 ? (
                          <li className={cn("min-w-0 border-b border-line py-1 pr-4 last:border-b-0", faixaDoCompromisso)} style={{ paddingLeft: recuo(1, true) }}>
                            <Button
                              variant="quiet"
                              onClick={() => {
                                setNovoItem(item.id);
                                setTextoItem("");
                              }}
                            >
                              + Item
                            </Button>
                          </li>
                        ) : null}
                      </Fragment>
                    );
                  })}
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

                <Grupo titulo="Para fazer" vazio={raizes.every((item) => item.doneOn) && dados.pendencias.length === 0}>
                  {raizes.filter((item) => !item.doneOn).map((item) => atividade(item, 0))}
                  {dados.pendencias.map((item) => (
                    <Pendencia key={item.id} item={item} />
                  ))}
                </Grupo>

                <Grupo titulo="Feito" vazio={!raizes.some((item) => item.doneOn)}>
                  {raizes.filter((item) => item.doneOn).map((item) => atividade(item, 0))}
                </Grupo>
              </div>
              {tarefas.length > 1 ? (
                <p className="max-w-prose text-xs text-ink-2">Segure o punho de uma tarefa e arraste para reordenar. Solte mais à direita, abaixo de outra, para pôr dentro dela.</p>
              ) : null}
            </div>
          </Troca>
        ) : null}
      </div>

      <Dialogo aberto={levando !== null} aria-labelledby="titulo-levar" onClose={() => setLevando(null)}>
        <h2 id="titulo-levar" className="mb-2 font-display text-lg">
          Levar para um compromisso
        </h2>
        <p className="mb-4 text-sm text-ink-2">
          <span className="font-medium text-ink">{levando?.title}</span>
          {levando && filhasDe(levando.id).length > 0 ? " e as subatividades dela" : ""} entram no checklist do compromisso escolhido, neste dia.
        </p>
        <div className="dialog-corpo">
          <ListaAnimada className="grid min-w-0 border border-line" aria-label="Compromissos do dia">
            {(dados?.compromissos ?? []).map((item) => (
              <ItemAnimado key={item.id} className={cn("min-w-0 border-b border-line last:border-b-0", faixaDoCompromisso)}>
                <button
                  type="button"
                  disabled={ocupado !== ""}
                  onClick={() => void levarAoCompromisso(item)}
                  className={cn(
                    "flex min-h-10 w-full min-w-0 items-center gap-3 py-2 pr-4 pl-3 text-left transition-colors hover:bg-brand-soft hover:text-brand disabled:opacity-50",
                    focusRing,
                  )}
                >
                  <time className="w-16 shrink-0 text-sm tabular-nums text-ink-2">{item.allDay ? "Dia todo" : item.time}</time>
                  <span className="flex min-w-0 flex-1 flex-col items-start gap-1">
                    <span className="min-w-0 break-words font-medium">{item.title}</span>
                    {checklistDe(item.id).length > 0 ? <Chip>{checklistDe(item.id).length} no checklist</Chip> : null}
                  </span>
                </button>
              </ItemAnimado>
            ))}
          </ListaAnimada>
        </div>
        <div className="dialog-acoes">
          <Button variant="quiet" type="button" onClick={() => setLevando(null)}>
            Cancelar
          </Button>
        </div>
      </Dialogo>
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
 * Uma linha da lista: o punho de arrastar (nas tarefas), a caixa, a hora quando há, o título com o detalhe, e o
 * valor, o chip ou o menu de três pontos à direita. O que já foi feito fica riscado e apagado, sem sair do lugar.
 */
function Linha({
  chave,
  nivel = 0,
  faixa = false,
  feito,
  ocupado,
  rotulo,
  onMarcar,
  hora,
  titulo,
  detalhe,
  chip,
  lado,
  opcoes,
  emArraste = false,
  alvo = null,
  onPegar,
  onArrastar,
  onSoltar,
}: {
  chave: string;
  nivel?: number;
  /** A faixa do compromisso: o próprio compromisso e os itens do checklist dele. */
  faixa?: boolean;
  feito: boolean;
  ocupado: boolean;
  rotulo: string;
  onMarcar: (done: boolean) => void;
  hora?: string | null;
  titulo: string;
  detalhe?: string;
  chip?: React.ReactNode;
  lado?: React.ReactNode;
  /** O menu de três pontos. Sem ele, a linha não tem ações. */
  opcoes?: OpcaoDaLinha[];
  emArraste?: boolean;
  alvo?: Alvo | null;
  onPegar?: (x: number, y: number) => void;
  onArrastar?: (x: number, y: number) => void;
  onSoltar?: () => void;
}) {
  const id = `item-${chave}`;
  const arrastavel = Boolean(onPegar);
  return (
    <ItemAnimado
      data-tarefa={arrastavel ? chave : undefined}
      data-nivel={arrastavel ? nivel : undefined}
      className={cn(
        "relative flex min-w-0 items-center gap-3 border-b border-line py-2 pr-4 last:border-b-0",
        faixa && faixaDoCompromisso,
        feito && "text-ink-2",
        emArraste && "opacity-50",
      )}
      style={{ paddingLeft: arrastavel ? recuo(nivel, faixa) - 8 : recuo(0, faixa) }}
    >
      {alvo ? (
        <span
          aria-hidden
          className={cn("pointer-events-none absolute right-4 h-0.5 bg-brand", alvo.posicao === "antes" ? "top-0" : "bottom-0")}
          style={{ left: recuo(nivel, faixa) + (alvo.dentro ? RECUO : 0) }}
        />
      ) : null}
      {arrastavel ? (
        <button
          type="button"
          aria-label={`Mover: ${rotulo}`}
          title="Segure e arraste"
          disabled={ocupado}
          className={cn("inline-flex size-10 shrink-0 cursor-grab touch-none items-center justify-center text-ink-2 active:cursor-grabbing", focusRing)}
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            event.currentTarget.setPointerCapture(event.pointerId);
            onPegar?.(event.clientX, event.clientY);
          }}
          onPointerMove={(event) => {
            if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
            onArrastar?.(event.clientX, event.clientY);
          }}
          onPointerUp={(event) => {
            if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
            event.currentTarget.releasePointerCapture(event.pointerId);
            onSoltar?.();
          }}
          onPointerCancel={() => onSoltar?.()}
        >
          <Icone name="punho" />
        </button>
      ) : null}
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
      {/* No celular o detalhe fica embaixo do título; no desktop vai para a direita, e o título usa a largura toda. */}
      <label
        htmlFor={id}
        className="flex min-h-10 min-w-0 flex-1 cursor-pointer flex-col justify-center gap-1 py-1 desk:flex-row desk:items-center desk:justify-between desk:gap-4"
      >
        <span className={cn("min-w-0 break-words font-medium desk:flex-1", feito && "line-through")}>{titulo}</span>
        {detalhe || chip ? (
          <span className="flex min-w-0 flex-wrap items-center gap-2 text-sm text-ink-2 desk:max-w-1/2 desk:shrink-0 desk:justify-end desk:text-right">
            {chip}
            {detalhe ? <span className="line-clamp-2 min-w-0 break-words desk:line-clamp-none desk:truncate">{detalhe}</span> : null}
          </span>
        ) : null}
      </label>
      <span className="flex shrink-0 items-center gap-1">
        {lado}
        {opcoes ? <MenuDaLinha rotulo={rotulo} opcoes={opcoes} disabled={ocupado} /> : null}
      </span>
    </ItemAnimado>
  );
}

/** A tarefa em edição, no lugar dela: o texto e o dia; Enter salva, Escape cancela. */
function EdicaoDaTarefa({
  item,
  nivel,
  faixa = false,
  soTexto = false,
  ocupado,
  onSalvar,
  onCancelar,
}: {
  item: Tarefa;
  nivel: number;
  faixa?: boolean;
  /** Item do checklist de um compromisso: fica no dia da ocorrência e não repete, então só o texto muda. */
  soTexto?: boolean;
  ocupado: boolean;
  onSalvar: (title: string, date: string, repeat: RepeticaoDeTarefa | null) => void;
  onCancelar: () => void;
}) {
  const [title, setTitle] = useState(item.title);
  const [date, setDate] = useState(item.date);
  const [repeat, setRepeat] = useState<RepeticaoDeTarefa | "">(item.repeat ?? "");
  return (
    <ItemAnimado className={cn(linhaDeCampo, faixa && faixaDoCompromisso)} style={{ paddingLeft: recuo(nivel, faixa) }}>
      <form
        className="flex min-w-0 flex-wrap items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (title.trim()) onSalvar(title.trim(), date, repeat || null);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") onCancelar();
        }}
      >
        <label htmlFor={`editar-${item.id}`} className="sr-only">
          Texto da tarefa
        </label>
        <input id={`editar-${item.id}`} autoFocus className={cn(campo, "min-w-0 flex-1")} maxLength={160} value={title} onChange={(event) => setTitle(event.target.value)} />
        {soTexto ? null : (
          <>
            <label htmlFor={`editar-dia-${item.id}`} className="sr-only">
              Dia da tarefa
            </label>
            <input id={`editar-dia-${item.id}`} type="date" className={campo} value={date} onChange={(event) => setDate(event.target.value)} />
          </>
        )}
        {nivel === 0 && !soTexto ? (
          <>
            <label htmlFor={`editar-repete-${item.id}`} className="sr-only">
              Repetir
            </label>
            <select id={`editar-repete-${item.id}`} className={campo} value={repeat} onChange={(event) => setRepeat(event.target.value as RepeticaoDeTarefa | "")}>
              <option value="">Não repete</option>
              {REPETICOES_DE_TAREFA.map((opcao) => (
                <option key={opcao} value={opcao}>
                  {ROTULO_DA_REPETICAO[opcao]}
                </option>
              ))}
            </select>
          </>
        ) : null}
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

/**
 * O que a pessoa tem livre até o fim do mês e quanto isso dá por dia, mais as sessões com limite: o número que
 * orienta o gasto de hoje.
 */
function Livre({ livre, limites }: { livre: NonNullable<HojeResposta["livre"]>; limites: UsoDoLimite[] }) {
  const partes = [
    `Neste mês ${formatarReais(livre.monthCents)}`,
    livre.carriedCents !== 0 ? `de antes ${formatarReais(livre.carriedCents)}` : "",
    livre.separatedCents !== 0 ? `separado nas metas ${formatarReais(livre.separatedCents)}` : "",
  ].filter(Boolean);
  return (
    <section aria-label="Livre até o fim do mês" className="grid min-w-0 gap-3 rounded-lg border border-line bg-surface p-4">
      <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="etiqueta text-ink-2">Livre até o fim do mês</span>
        <span className="text-sm text-ink-2">{livre.daysLeft === 1 ? "último dia" : `${livre.daysLeft} dias`}</span>
      </div>
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className="font-display text-xl tracking-titulo">
          <Money cents={livre.cents} strong />
        </span>
        {livre.cents > 0 ? (
          <span className="text-sm text-ink-2">
            {formatarReais(livre.perDayCents)} por dia
          </span>
        ) : (
          <span className="text-sm text-neg">Sem folga: as saídas do mês já passam das entradas.</span>
        )}
      </div>
      <p className="text-xs text-ink-2">{partes.join(" · ")}.</p>
      {limites.length > 0 ? (
        <ul className="grid min-w-0 gap-2 border-t border-line pt-3" aria-label="Limites das sessões">
          {limites.map((uso) => {
            const tom = uso.percent >= 100 ? "bg-neg" : uso.percent >= 80 ? "bg-pending" : "bg-brand";
            return (
              <li key={uso.sessionId} className="grid min-w-0 gap-1">
                <div className="flex min-w-0 items-baseline justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate">
                    {uso.sessionName} <span className="text-ink-2">· {uso.groupName}</span>
                  </span>
                  <span className={cn("shrink-0 tabular-nums", uso.percent >= 100 ? "text-neg" : "text-ink-2")}>
                    {formatarReais(uso.usedCents)} de {formatarReais(uso.limitCents)}
                  </span>
                </div>
                <div className="h-1 w-full bg-surface-2" role="progressbar" aria-label={`${uso.sessionName}: ${uso.percent}% do limite`} aria-valuenow={Math.min(uso.percent, 100)} aria-valuemin={0} aria-valuemax={100}>
                  <div className={cn("h-1", tom)} style={{ width: `${Math.min(uso.percent, 100)}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}

/**
 * Um compromisso que terminou sem gasto: o valor (só dígitos, em reais), a sessão quando ele não tem uma, e as duas
 * respostas. A linha some depois de responder.
 */
function PerguntaDoGasto({
  item,
  ontem,
  sessoes,
  ocupado,
  onLancar,
  onSemGasto,
}: {
  item: PerguntaDeGasto;
  ontem: boolean;
  sessoes: { id: string; label: string }[];
  ocupado: boolean;
  onLancar: (cents: number, sessionId: string) => Promise<boolean>;
  onSemGasto: () => void;
}) {
  const [valor, setValor] = useState("");
  const [sessao, setSessao] = useState(item.sessionId ?? "");
  const cents = reaisParaCentavos(valor);
  const idValor = `gasto-valor-${item.appointmentId}-${item.date}`;
  const idSessao = `gasto-sessao-${item.appointmentId}-${item.date}`;
  const quando = `${ontem ? "Ontem, terminou" : "Terminou"} às ${item.endedAtLocal}`;
  return (
    <ItemAnimado className="grid min-w-0 gap-2 border-b border-line px-4 py-3 last:border-b-0">
      <div className="flex min-w-0 items-baseline justify-between gap-3">
        <span className="min-w-0 truncate font-medium">{item.title}</span>
        <Chip tone="event">{item.allDay ? "Dia todo" : item.time}</Chip>
      </div>
      <p className="text-sm text-ink-2">
        {[quando, item.location, item.sessionLabel].filter(Boolean).join(" · ")}
      </p>
      <form
        className="flex min-w-0 flex-wrap items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (cents && cents > 0 && sessao) void onLancar(cents, sessao).then((feito) => feito && setValor(""));
        }}
      >
        {item.sessionId ? null : (
          <>
            <label htmlFor={idSessao} className="sr-only">
              Sessão do gasto
            </label>
            <select id={idSessao} className={cn(campo, "w-full min-w-0 basis-full")} value={sessao} onChange={(event) => setSessao(event.target.value)}>
              <option value="">Escolha a sessão</option>
              {sessoes.map((opcao) => (
                <option key={opcao.id} value={opcao.id}>
                  {opcao.label}
                </option>
              ))}
            </select>
          </>
        )}
        <label htmlFor={idValor} className="sr-only">
          Quanto foi gasto em {item.title}
        </label>
        <CampoValor id={idValor} value={valor} onChange={setValor} className={cn(campo, "w-32 min-w-0")} />
        <Button type="submit" variant="default" disabled={ocupado || !cents || cents <= 0 || !sessao}>
          Lançar
        </Button>
        <Button type="button" variant="quiet" disabled={ocupado} onClick={onSemGasto}>
          Não teve
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
