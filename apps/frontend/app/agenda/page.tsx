"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  AGENDAS,
  CATEGORIAS_COMPROMISSO,
  FUSO_PADRAO,
  FUSOS_AGENDA,
  type AgendaResposta,
  type CategoriaCompromisso,
  type FusoAgenda,
  type NomeAgenda,
  type StatusCompromisso,
} from "@finnagent/contracts";
import { Button } from "../../components/ui/button";
import { Chip } from "../../components/ui/chip";
import { Money } from "../../components/ui/money";
import { PageHeader } from "../../components/ui/page-header";
import { Dica, Rotulo } from "../../components/ui/rotulo";
import { useToast } from "../../components/ui/toast";
import { cn, focusRing } from "../../components/ui/cn";
import { Presenca, Troca } from "../../components/ui/movimento";
import { GradeMes } from "./grade";
import { diasDoMes, ehHoje, itensNoDia, montarItens, rotuloDaCategoria, rotuloDoDia, rotuloDoFuso } from "./itens";
import { ListaMes, PainelDoDia, resumoDoDia } from "./lista";

type Visao = "mes" | "lista";
type Camadas = { compromisso: boolean; lancamento: boolean };
type Menu = { x: number; y: number };
type Rascunho = {
  id: string;
  title: string;
  description: string;
  location: string;
  date: string;
  endDate: string;
  allDay: boolean;
  time: string;
  endTime: string;
  calendar: NomeAgenda;
  category: CategoriaCompromisso;
  entryId: string;
};

const dicaDaCategoria: Record<CategoriaCompromisso, string> = {
  fixed: "Acontece só neste dia.",
  periodical: "Repete neste dia, todo mês.",
  time: "Repete neste dia, todo mês, até a validade.",
};

const field = `min-h-10 w-full min-w-0 rounded-sm border border-line bg-surface px-3 text-base text-ink ${focusRing}`;
const dialogDia =
  "rounded-lg border border-line bg-surface text-ink backdrop:bg-overlay/80";
const dialogForm =
  "rounded-lg border border-line bg-surface text-ink backdrop:bg-overlay/80";

const meses = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

export default function Agenda() {
  const toast = useToast();
  const hoje = new Date();
  const [year, setYear] = useState(hoje.getFullYear());
  const [month, setMonth] = useState(hoje.getMonth() + 1);
  const [selected, setSelected] = useState(hoje.getDate());
  const [selecaoGrade, setSelecaoGrade] = useState(hoje.getDate());
  const [visao, setVisao] = useState<Visao>("mes");
  const [deslize, setDeslize] = useState(0);
  const [camadas, setCamadas] = useState<Camadas>({ compromisso: true, lancamento: true });
  const [data, setData] = useState<AgendaResposta | null>(null);
  const [carregado, setCarregado] = useState<{ year: number; month: number } | null>(null);
  const [falhou, setFalhou] = useState(false);
  const [menu, setMenu] = useState<Menu | null>(null);
  const [diaAberto, setDiaAberto] = useState(false);
  const [draft, setDraft] = useState<Rascunho | null>(null);
  const [saving, setSaving] = useState(false);
  const [coarse, setCoarse] = useState(false);
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const diaArmado = useRef<number | null>(null);
  const dia = useRef<HTMLDialogElement>(null);
  const form = useRef<HTMLDialogElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  function carregar(alvoAno = year, alvoMes = month) {
    return fetch(`/api/agenda?year=${alvoAno}&month=${alvoMes}`).then(async (response) => {
      const body = (await response.json().catch(() => ({}))) as { message?: string };
      if (!response.ok) throw new Error(body.message || "O backend não respondeu.");
      return body as AgendaResposta;
    });
  }

  useEffect(() => {
    let active = true;
    carregar(year, month)
      .then((resposta) => {
        if (!active) return;
        setData(resposta);
        setCarregado({ year, month });
        setSelecaoGrade(selectedRef.current);
        setFalhou(false);
      })
      .catch((error: Error) => {
        if (!active) return;
        setFalhou(true);
        toast.erro(error.message);
      });
    return () => {
      active = false;
    };
  }, [year, month, toast]);

  useEffect(() => {
    const media = window.matchMedia("(pointer: coarse)");
    const atualizar = () => setCoarse(media.matches);
    atualizar();
    media.addEventListener("change", atualizar);
    return () => media.removeEventListener("change", atualizar);
  }, []);

  useLayoutEffect(() => {
    const atual = dia.current;
    if (!atual) return;
    if (diaAberto && !atual.open) atual.showModal();
  }, [diaAberto]);

  useEffect(() => {
    const atual = form.current;
    if (!atual) return;
    if (draft && !atual.open) atual.showModal();
    if (!draft && atual.open) atual.close();
  }, [draft]);

  useEffect(() => {
    if (!menu) return;
    menuRef.current?.querySelector("button")?.focus();
    const fechar = () => setMenu(null);
    const fecharClique = (event: MouseEvent) => {
      if (menuRef.current?.contains(event.target as Node)) return;
      setMenu(null);
    };
    window.addEventListener("scroll", fechar, true);
    window.addEventListener("resize", fechar);
    document.addEventListener("mousedown", fecharClique);
    return () => {
      window.removeEventListener("scroll", fechar, true);
      window.removeEventListener("resize", fechar);
      document.removeEventListener("mousedown", fecharClique);
    };
  }, [menu]);

  const anoVisivel = carregado?.year ?? year;
  const mesVisivel = carregado?.month ?? month;

  useEffect(() => {
    diaArmado.current = null;
  }, [anoVisivel, mesVisivel]);
  const itens = data ? montarItens(data.appointments, data.entries, camadas) : [];
  const doDia = itensNoDia(itens, selecaoGrade);
  const resumo = resumoDoDia(doDia);
  const hojeNoMes = ehHoje(anoVisivel, mesVisivel, hoje.getDate()) ? hoje.getDate() : null;

  function irPara(alvoAno: number, alvoMes: number, diaAlvo?: number) {
    const atual = year * 12 + month;
    const alvo = alvoAno * 12 + alvoMes;
    if (alvo !== atual) setDeslize(alvo > atual ? 1 : -1);
    const limite = diasDoMes(alvoAno, alvoMes);
    const dia = Math.min(diaAlvo ?? selected, limite);
    setYear(alvoAno);
    setMonth(alvoMes);
    setSelected(dia);
    if (carregado?.year === alvoAno && carregado?.month === alvoMes) setSelecaoGrade(dia);
    setMenu(null);
  }

  function mesAnterior() {
    if (month === 1) irPara(year - 1, 12);
    else irPara(year, month - 1);
  }

  function mesSeguinte() {
    if (month === 12) irPara(year + 1, 1);
    else irPara(year, month + 1);
  }

  function escolherDia(day: number) {
    setMenu(null);
    if (diaArmado.current === day) {
      abrirDia(day);
      return;
    }
    diaArmado.current = day;
    setSelected(day);
    setSelecaoGrade(day);
    if (coarse) setDiaAberto(true);
  }

  function abrirDia(day: number) {
    diaArmado.current = null;
    setSelected(day);
    setSelecaoGrade(day);
    setMenu(null);
    setDiaAberto(true);
  }

  function abrirMenu(day: number, x: number, y: number) {
    setSelected(day);
    setSelecaoGrade(day);
    if (!x && !y) {
      const celula = document.querySelector<HTMLElement>(`[data-dia="${day}"]`);
      const rect = celula?.getBoundingClientRect();
      setMenu({ x: (rect?.left ?? 8) + 8, y: (rect?.bottom ?? 8) - 8 });
      return;
    }
    setMenu({ x, y });
  }

  function focarDia() {
    document.querySelector<HTMLElement>(`[data-dia="${selected}"]`)?.focus();
  }

  function novoCompromisso() {
    setDiaAberto(false);
    setMenu(null);
    setDraft({
      id: crypto.randomUUID(),
      title: "",
      description: "",
      location: "",
      date: dataIso(year, month, selected),
      endDate: dataIso(year, month, selected),
      allDay: false,
      time: "",
      endTime: "",
      calendar: "Pessoal",
      category: "fixed",
      entryId: "",
    });
  }

  async function salvar(event: React.FormEvent) {
    event.preventDefault();
    if (!draft || saving) return;
    setSaving(true);
    const [anoTexto, mesTexto, diaTexto] = draft.date.split("-");
    try {
      const response = await fetch("/api/compromissos", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: draft.id,
          title: draft.title,
          description: draft.description,
          location: draft.location,
          allDay: draft.allDay,
          year: Number(anoTexto),
          month: Number(mesTexto),
          day: Number(diaTexto),
          time: draft.allDay ? null : draft.time || null,
          endTime: draft.allDay ? null : draft.endTime || null,
          calendar: draft.calendar,
          timezone: fusoDaAgenda(data, draft.calendar),
          category: draft.category,
          ...fimDoRascunho(draft),
          entryId: draft.entryId || null,
        }),
      });
      const body = (await response.json().catch(() => ({}))) as { message?: string };
      if (!response.ok) throw new Error(body.message || "Não foi possível salvar o compromisso.");
      const resposta = await carregar(Number(anoTexto), Number(mesTexto));
      setData(resposta);
      setCarregado({ year: Number(anoTexto), month: Number(mesTexto) });
      setFalhou(false);
      setDraft(null);
      toast.sucesso("Compromisso criado.");
      irPara(Number(anoTexto), Number(mesTexto), Number(diaTexto));
    } catch (error) {
      toast.erro(error instanceof Error ? error.message : "Não foi possível salvar o compromisso.");
    } finally {
      setSaving(false);
    }
  }

  async function sincronizar() {
    try {
      const response = await fetch("/api/agenda/sincronizar", { method: "POST" });
      const body = (await response.json().catch(() => ({}))) as { message?: string };
      if (!response.ok) throw new Error(body.message || "Não foi possível sincronizar.");
      const resposta = await carregar();
      setData(resposta);
      setCarregado({ year, month });
      setFalhou(false);
      toast.sucesso("Agenda sincronizada.");
    } catch (error) {
      toast.erro(error instanceof Error ? error.message : "Não foi possível sincronizar.");
    }
  }

  async function salvarFuso(name: NomeAgenda, timezone: FusoAgenda) {
    try {
      const response = await fetch("/api/calendarios", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, timezone }),
      });
      const body = (await response.json().catch(() => ({}))) as { message?: string };
      if (!response.ok) throw new Error(body.message || "Não foi possível salvar o fuso.");
      setData((atual) =>
        atual
          ? {
              ...atual,
              calendars: atual.calendars.map((calendario) =>
                calendario.name === name ? { ...calendario, timezone } : calendario,
              ),
            }
          : atual,
      );
      toast.sucesso("Fuso atualizado.");
    } catch (error) {
      toast.erro(error instanceof Error ? error.message : "Não foi possível salvar o fuso.");
    }
  }

  async function atualizarStatus(id: string, status: StatusCompromisso) {
    try {
      const response = await fetch(`/api/compromissos/${id}/status`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const body = (await response.json().catch(() => ({}))) as { message?: string };
      if (!response.ok) throw new Error(body.message || "Não foi possível atualizar o status.");
      const resposta = await carregar();
      setData(resposta);
      setCarregado({ year, month });
      setFalhou(false);
      toast.sucesso(status === "done" ? "Compromisso cumprido." : "Compromisso marcado como descumprido.");
    } catch (error) {
      toast.erro(error instanceof Error ? error.message : "Não foi possível atualizar o status.");
    }
  }

  return (
    <div className="mx-auto min-w-0 max-w-5xl">
      <PageHeader
        title="Agenda"
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2">
              <span className="inline-block size-2 shrink-0 rounded-full bg-ink-2" />
              Google Calendar desconectado
            </span>
            <span>{textoDosFusos(data)}</span>
          </span>
        }
        actions={
          <>
            <div className="inline-flex overflow-hidden rounded-sm border border-line bg-surface" role="group" aria-label="Visão">
              <button
                type="button"
                aria-pressed={visao === "mes"}
                onClick={() => {
                  setDeslize(0);
                  setVisao("mes");
                }}
                className={cn(
                  "min-h-10 px-4 font-semibold",
                  focusRing,
                  visao === "mes" ? "bg-brand-soft text-brand" : "bg-transparent text-ink-2",
                )}
              >
                Mês
              </button>
              <button
                type="button"
                aria-pressed={visao === "lista"}
                onClick={() => {
                  setDeslize(0);
                  setVisao("lista");
                }}
                className={cn(
                  "min-h-10 px-4 font-semibold",
                  focusRing,
                  visao === "lista" ? "bg-brand-soft text-brand" : "bg-transparent text-ink-2",
                )}
              >
                Lista
              </button>
            </div>
            <Button variant="primary" onClick={novoCompromisso}>
              Novo compromisso
            </Button>
          </>
        }
      >
        <div className="grid gap-4">
          {!data && !falhou ? (
            <p className="max-w-prose text-sm text-ink-2">Carregando agenda.</p>
          ) : null}
          <ConectarGoogle onConnect={() => void sincronizar()} />
          <div className="flex flex-wrap gap-4">
            {AGENDAS.map((nome) => (
              <div key={nome} className="grid gap-1">
                <Rotulo htmlFor={`fuso-${nome}`} dica="O fuso horário desta agenda.">
                  Fuso · {nome}
                </Rotulo>
                <select
                  id={`fuso-${nome}`}
                  className={field}
                  disabled={!data}
                  value={fusoDaAgenda(data, nome)}
                  onChange={(event) => void salvarFuso(nome, event.target.value as FusoAgenda)}
                >
                  {FUSOS_AGENDA.map((fuso) => (
                    <option key={fuso} value={fuso}>
                      {rotuloDoFuso(fuso)}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1 font-display text-lg font-bold">
              <Button variant="quiet" className="min-w-10 px-0" aria-label="Mês anterior" onClick={mesAnterior}>
                ‹
              </Button>
              <span>
                {meses[mesVisivel - 1]} de {anoVisivel}
              </span>
              <Button variant="quiet" className="min-w-10 px-0" aria-label="Próximo mês" onClick={mesSeguinte}>
                ›
              </Button>
              <Button
                variant="quiet"
                onClick={() => irPara(hoje.getFullYear(), hoje.getMonth() + 1, hoje.getDate())}
              >
                Hoje
              </Button>
            </div>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Camadas">
              <Camada
                pressed={camadas.compromisso}
                onClick={() => setCamadas((atual) => ({ ...atual, compromisso: !atual.compromisso }))}
              >
                <i className="size-2 shrink-0 rounded-full bg-event" />
                Compromissos
              </Camada>
              <Camada
                pressed={camadas.lancamento}
                onClick={() => setCamadas((atual) => ({ ...atual, lancamento: !atual.lancamento }))}
              >
                <i className="size-2 shrink-0 rounded-full bg-neg" />
                <i className="size-2 shrink-0 rounded-full bg-pos" />
                Lançamentos
              </Camada>
              <Button onClick={() => void sincronizar()}>Sincronizar</Button>
            </div>
          </div>
          {data ? (
            <Troca id={`${visao}-${anoVisivel}-${mesVisivel}`} direcao={deslize}>
              {visao === "mes" ? (
                <GradeMes
                  year={anoVisivel}
                  month={mesVisivel}
                  selected={selecaoGrade}
                  today={hojeNoMes}
                  itens={itens}
                  onSelect={escolherDia}
                  onOpen={abrirDia}
                  onContext={abrirMenu}
                />
              ) : (
                <ListaMes
                  year={anoVisivel}
                  month={mesVisivel}
                  itens={itens}
                  onStatus={(id, status) => void atualizarStatus(id, status)}
                />
              )}
            </Troca>
          ) : null}
        </div>
      </PageHeader>

      {menu ? (
        <div
          ref={menuRef}
          role="menu"
          aria-label="Ações do dia"
          className="fixed z-20 grid min-w-60 rounded-md border border-line bg-surface p-1"
          style={posicaoDoMenu(menu)}
          onKeyDown={(event) => {
            const botoes = [...(menuRef.current?.querySelectorAll("button") ?? [])];
            if (event.key === "Escape") {
              event.preventDefault();
              setMenu(null);
              focarDia();
            } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              const atual = botoes.indexOf(document.activeElement as HTMLButtonElement);
              const passo = event.key === "ArrowDown" ? 1 : botoes.length - 1;
              botoes[(atual + passo) % botoes.length]?.focus();
            }
          }}
        >
          <button
            type="button"
            role="menuitem"
            className={`min-h-10 rounded-sm px-3 text-left font-medium ${focusRing} hover:bg-brand-soft hover:text-brand`}
            onClick={() => {
              setMenu(null);
              setDiaAberto(true);
            }}
          >
            Abrir
          </button>
          <button
            type="button"
            role="menuitem"
            className={`min-h-10 rounded-sm px-3 text-left font-medium ${focusRing} hover:bg-brand-soft hover:text-brand`}
            onClick={novoCompromisso}
          >
            Novo compromisso neste dia
          </button>
        </div>
      ) : null}

      <dialog
        ref={dia}
        className={dialogDia}
        data-largura="media"
        aria-labelledby="titulo-dia"
        onCancel={(event) => {
          event.preventDefault();
          setDiaAberto(false);
        }}
        onClose={() => setDiaAberto(false)}
        onClick={(event) => {
          if (event.target === dia.current) setDiaAberto(false);
        }}
      >
        <Presenca
          aberto={diaAberto}
          onSaiu={() => {
            if (dia.current?.open) dia.current.close();
          }}
          className="dialog-miolo"
        >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="grid gap-1">
            <h2 id="titulo-dia" className="flex flex-wrap items-center gap-2 font-display text-lg">
              {rotuloDoDia(anoVisivel, mesVisivel, selecaoGrade)}
              {ehHoje(anoVisivel, mesVisivel, selecaoGrade) ? (
                <Chip tone="ok" className="font-sans font-normal">
                  Hoje
                </Chip>
              ) : null}
            </h2>
            <p className="flex flex-wrap items-center gap-2 text-sm text-ink-2">
              <span>
                {resumo.quantidade} {resumo.quantidade === 1 ? "item" : "itens"}
              </span>
              {resumo.temValor ? (
                <>
                  <span aria-hidden>·</span>
                  <Money cents={resumo.total} />
                </>
              ) : null}
            </p>
          </div>
          <Button variant="quiet" className="min-w-10 px-0" aria-label="Fechar" onClick={() => setDiaAberto(false)}>
            ×
          </Button>
        </div>
        <div className="dialog-corpo">
          <PainelDoDia
            year={anoVisivel}
            month={mesVisivel}
            day={selecaoGrade}
            itens={doDia}
            onStatus={(id, status) => void atualizarStatus(id, status)}
          />
        </div>
        <div className="dialog-acoes">
          <Button variant="primary" className="w-full tab:w-auto" onClick={novoCompromisso}>
            Novo compromisso neste dia
          </Button>
        </div>
        </Presenca>
      </dialog>

      <dialog
        ref={form}
        className={dialogForm}
        aria-labelledby="titulo-compromisso"
        onClose={() => setDraft(null)}
      >
        <h2 id="titulo-compromisso" className="mb-4 font-display text-lg">
          Novo compromisso
        </h2>
        <form onSubmit={salvar}>
          <div className="dialog-corpo grid gap-4">
          <div className="grid gap-1">
            <Rotulo htmlFor="compromisso-titulo" dica="O nome do compromisso.">
              Título
            </Rotulo>
            <input
              id="compromisso-titulo"
              required
              maxLength={80}
              placeholder="Ex.: Vence aluguel"
              value={draft?.title ?? ""}
              onChange={(event) =>
                setDraft((atual) => (atual ? { ...atual, title: event.target.value } : atual))
              }
              className={field}
            />
          </div>
          <div className="grid gap-1">
            <Rotulo htmlFor="compromisso-descricao" dica="Um detalhe do compromisso.">
              Descrição <span className="font-normal text-ink-2">(opcional)</span>
            </Rotulo>
            <input
              id="compromisso-descricao"
              maxLength={160}
              value={draft?.description ?? ""}
              onChange={(event) =>
                setDraft((atual) => (atual ? { ...atual, description: event.target.value } : atual))
              }
              className={field}
            />
          </div>
          <div className="grid gap-1">
            <Rotulo htmlFor="compromisso-local" dica="Onde o compromisso acontece.">
              Local <span className="font-normal text-ink-2">(opcional)</span>
            </Rotulo>
            <input
              id="compromisso-local"
              maxLength={160}
              value={draft?.location ?? ""}
              onChange={(event) =>
                setDraft((atual) => (atual ? { ...atual, location: event.target.value } : atual))
              }
              className={field}
            />
          </div>
          <div className="grid gap-1">
            <Rotulo htmlFor="compromisso-categoria" dica="Uma vez, todo mês, ou todo mês até uma data.">
              Categoria
            </Rotulo>
            <select
              id="compromisso-categoria"
              value={draft?.category ?? "fixed"}
              onChange={(event) =>
                setDraft((atual) =>
                  atual ? { ...atual, category: event.target.value as CategoriaCompromisso } : atual,
                )
              }
              className={field}
            >
              {CATEGORIAS_COMPROMISSO.map((categoria) => (
                <option key={categoria} value={categoria}>
                  {rotuloDaCategoria(categoria)}
                </option>
              ))}
            </select>
            <p className="text-xs text-ink-2">{dicaDaCategoria[draft?.category ?? "fixed"]}</p>
          </div>
          <div className="grid gap-3 tab:grid-cols-2">
            <div className="grid gap-1">
              <Rotulo
                htmlFor="compromisso-data"
                dica={
                  draft?.category === "fixed"
                    ? "O dia deste compromisso."
                    : "O primeiro dia em que a repetição acontece."
                }
              >
                {draft?.category === "fixed" ? "Data" : "Primeiro dia"}
              </Rotulo>
              <input
                id="compromisso-data"
                type="date"
                required
                value={draft?.date ?? ""}
                onChange={(event) =>
                  setDraft((atual) => (atual ? { ...atual, date: event.target.value } : atual))
                }
                className={field}
              />
            </div>
            {draft?.category === "time" ? (
              <div className="grid gap-1">
                <Rotulo htmlFor="compromisso-fim" dica="O último dia em que a repetição vale.">
                  Válido até
                </Rotulo>
                <input
                  id="compromisso-fim"
                  type="date"
                  required
                  min={draft.date}
                  value={draft.endDate}
                  onChange={(event) =>
                    setDraft((atual) => (atual ? { ...atual, endDate: event.target.value } : atual))
                  }
                  className={field}
                />
              </div>
            ) : null}
          </div>
          <label className="flex min-h-10 items-center gap-2 text-sm">
            <input
              type="checkbox"
              className={`size-4 accent-brand ${focusRing}`}
              checked={draft?.allDay ?? false}
              onChange={(event) =>
                setDraft((atual) => (atual ? { ...atual, allDay: event.target.checked } : atual))
              }
            />
            <span className="inline-flex items-center gap-1">
              Dia todo
              <Dica texto="O compromisso ocupa o dia inteiro, sem horário." />
            </span>
          </label>
          {draft?.allDay ? null : (
            <div className="grid gap-3 tab:grid-cols-2">
              <div className="grid gap-1">
                <Rotulo htmlFor="compromisso-hora" dica="A hora em que começa.">
                  Hora inicial
                </Rotulo>
                <input
                  id="compromisso-hora"
                  type="time"
                  required
                  value={draft?.time ?? ""}
                  onChange={(event) =>
                    setDraft((atual) => (atual ? { ...atual, time: event.target.value } : atual))
                  }
                  className={field}
                />
              </div>
              <div className="grid gap-1">
                <Rotulo htmlFor="compromisso-hora-fim" dica="A hora em que termina.">
                  Hora final
                </Rotulo>
                <input
                  id="compromisso-hora-fim"
                  type="time"
                  required
                  value={draft?.endTime ?? ""}
                  onChange={(event) =>
                    setDraft((atual) => (atual ? { ...atual, endTime: event.target.value } : atual))
                  }
                  className={field}
                />
              </div>
            </div>
          )}
          <div className="grid gap-1">
            <Rotulo htmlFor="compromisso-agenda" dica="Em qual calendário este compromisso entra.">
              Agenda do Google
            </Rotulo>
            <select
              id="compromisso-agenda"
              value={draft?.calendar ?? "Pessoal"}
              onChange={(event) =>
                setDraft((atual) =>
                  atual ? { ...atual, calendar: event.target.value as NomeAgenda } : atual,
                )
              }
              className={field}
            >
              {AGENDAS.map((nome) => (
                <option key={nome}>{nome}</option>
              ))}
            </select>
          </div>
          <div className="grid gap-1">
            <Rotulo htmlFor="compromisso-vinculo" dica="Liga o compromisso a um lançamento. O dia passa a mostrar o valor.">
              Vincular a uma transação <span className="font-normal text-ink-2">(opcional)</span>
            </Rotulo>
            <select
              id="compromisso-vinculo"
              value={draft?.entryId ?? ""}
              onChange={(event) =>
                setDraft((atual) => (atual ? { ...atual, entryId: event.target.value } : atual))
              }
              className={field}
            >
              <option value="">Nenhuma</option>
              {(data?.entries ?? []).map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.sessionName} · {entry.groupName} · {entry.description}
                </option>
              ))}
            </select>
            <p className="text-xs text-ink-2">
              Com vínculo, o dia mostra o valor e o status da transação.
            </p>
          </div>
          </div>
          <div className="dialog-acoes">
            <Button variant="quiet" type="button" onClick={() => setDraft(null)}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit" disabled={saving}>
              Criar compromisso
            </Button>
          </div>
        </form>
      </dialog>
    </div>
  );
}

function ConectarGoogle({ onConnect }: { onConnect: () => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-surface p-6">
      <div>
        <p className="font-medium">Conectar Google Calendar</p>
        <p className="max-w-prose text-sm text-ink-2">
          Os compromissos do Google aparecem aqui depois da conexão. Os lançamentos do Prumo já estão
          no calendário.
        </p>
      </div>
      <Button onClick={onConnect}>Conectar Google Calendar</Button>
    </div>
  );
}

function Camada({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-10 items-center gap-2 rounded-sm border bg-surface px-3 font-medium",
        focusRing,
        pressed ? "border-brand text-ink" : "border-line text-ink-2",
      )}
    >
      {children}
    </button>
  );
}

function dataIso(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function fimDoRascunho(draft: Rascunho) {
  if (draft.category !== "time") return { endYear: null, endMonth: null, endDay: null };
  const [anoTexto, mesTexto, diaTexto] = draft.endDate.split("-");
  return { endYear: Number(anoTexto), endMonth: Number(mesTexto), endDay: Number(diaTexto) };
}

function fusoDaAgenda(data: AgendaResposta | null, nome: NomeAgenda): FusoAgenda {
  return data?.calendars.find((calendario) => calendario.name === nome)?.timezone ?? FUSO_PADRAO;
}

function textoDosFusos(data: AgendaResposta | null) {
  return AGENDAS.map((nome) => `${nome}: ${rotuloDoFuso(fusoDaAgenda(data, nome))}`).join(" · ");
}

function posicaoDoMenu(menu: Menu) {
  const margem = 8;
  const largura = 240;
  const altura = 88;
  const x = Math.max(margem, Math.min(menu.x, window.innerWidth - largura - margem));
  const y = Math.max(margem, Math.min(menu.y, window.innerHeight - altura - margem));
  return { left: x, top: y };
}
