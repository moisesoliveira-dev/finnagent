"use client";

import { useEffect, useRef, useState } from "react";
import {
  AGENDAS,
  CATEGORIAS_COMPROMISSO,
  type AgendaResposta,
  type CategoriaCompromisso,
  type NomeAgenda,
} from "@finnagent/contracts";
import { Button } from "../../components/ui/button";
import { Chip } from "../../components/ui/chip";
import { PageHeader } from "../../components/ui/page-header";
import { cn, focusRing } from "../../components/ui/cn";
import { GradeMes } from "./grade";
import { diasDoMes, ehHoje, itensNoDia, montarItens, rotuloDaCategoria, rotuloDoDia } from "./itens";
import { ListaDoDia, ListaMes } from "./lista";

type Visao = "mes" | "lista";
type Camadas = { compromisso: boolean; lancamento: boolean };
type Menu = { x: number; y: number };
type Rascunho = {
  id: string;
  title: string;
  date: string;
  endDate: string;
  time: string;
  calendar: NomeAgenda;
  category: CategoriaCompromisso;
  entryId: string;
};

const dicaDaCategoria: Record<CategoriaCompromisso, string> = {
  unico: "Acontece só neste dia.",
  recorrente: "Repete neste dia, todo mês, até dezembro deste ano.",
  validade: "Aparece em cada dia do período.",
};

const field = `min-h-11 w-full min-w-0 rounded-sm border border-line bg-surface px-3 text-base text-ink ${focusRing}`;
const dialogDia =
  "mt-auto mb-0 w-full max-w-none rounded-t-lg border border-line bg-surface p-6 text-ink backdrop:bg-overlay/80 tab:m-auto tab:w-[min(560px,calc(100vw-2rem))] tab:rounded-lg";
const dialogForm =
  "mt-auto mb-0 w-full max-w-none rounded-t-lg border border-line bg-surface p-6 text-ink backdrop:bg-overlay/80 tab:m-auto tab:w-[min(460px,calc(100vw-2rem))] tab:rounded-lg";

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
  const hoje = new Date();
  const [year, setYear] = useState(hoje.getFullYear());
  const [month, setMonth] = useState(hoje.getMonth() + 1);
  const [selected, setSelected] = useState(hoje.getDate());
  const [visao, setVisao] = useState<Visao>("mes");
  const [camadas, setCamadas] = useState<Camadas>({ compromisso: true, lancamento: true });
  const [data, setData] = useState<AgendaResposta | null>(null);
  const [carregado, setCarregado] = useState<{ year: number; month: number } | null>(null);
  const [loadError, setLoadError] = useState("");
  const [menu, setMenu] = useState<Menu | null>(null);
  const [diaAberto, setDiaAberto] = useState(false);
  const [draft, setDraft] = useState<Rascunho | null>(null);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [aviso, setAviso] = useState("");
  const [coarse, setCoarse] = useState(false);
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
        setLoadError("");
      })
      .catch((error: Error) => {
        if (active) setLoadError(error.message);
      });
    return () => {
      active = false;
    };
  }, [year, month]);

  useEffect(() => {
    const media = window.matchMedia("(pointer: coarse)");
    const atualizar = () => setCoarse(media.matches);
    atualizar();
    media.addEventListener("change", atualizar);
    return () => media.removeEventListener("change", atualizar);
  }, []);

  useEffect(() => {
    const atual = dia.current;
    if (!atual) return;
    if (diaAberto && !atual.open) atual.showModal();
    if (!diaAberto && atual.open) atual.close();
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

  const mesPronto = carregado?.year === year && carregado?.month === month;
  const itens = data && mesPronto ? montarItens(data.appointments, data.entries, camadas) : [];
  const doDia = itensNoDia(itens, selected);
  const hojeNoMes = ehHoje(year, month, hoje.getDate()) ? hoje.getDate() : null;

  function irPara(alvoAno: number, alvoMes: number, diaAlvo?: number) {
    const limite = diasDoMes(alvoAno, alvoMes);
    setYear(alvoAno);
    setMonth(alvoMes);
    setSelected(Math.min(diaAlvo ?? selected, limite));
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
    setSelected(day);
    setMenu(null);
    if (coarse) setDiaAberto(true);
  }

  function abrirMenu(day: number, x: number, y: number) {
    setSelected(day);
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
    setFormError("");
    setAviso("");
    setDiaAberto(false);
    setMenu(null);
    setDraft({
      id: crypto.randomUUID(),
      title: "",
      date: dataIso(year, month, selected),
      endDate: dataIso(year, month, selected),
      time: "",
      calendar: "Pessoal",
      category: "unico",
      entryId: "",
    });
  }

  async function salvar(event: React.FormEvent) {
    event.preventDefault();
    if (!draft || saving) return;
    setSaving(true);
    setFormError("");
    const [anoTexto, mesTexto, diaTexto] = draft.date.split("-");
    try {
      const response = await fetch("/api/compromissos", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: draft.id,
          title: draft.title,
          year: Number(anoTexto),
          month: Number(mesTexto),
          day: Number(diaTexto),
          time: draft.time || null,
          calendar: draft.calendar,
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
      setLoadError("");
      setDraft(null);
      irPara(Number(anoTexto), Number(mesTexto), Number(diaTexto));
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Não foi possível salvar o compromisso.");
    } finally {
      setSaving(false);
    }
  }

  function sincronizar() {
    setAviso("Conecte o Google Calendar para sincronizar.");
  }

  return (
    <div className="mx-auto min-w-0 max-w-5xl">
      <PageHeader
        title="Agenda"
        subtitle={
          <span className="inline-flex items-center">
            <span className={`mr-2 inline-block size-2 rounded-full ${aviso ? "bg-neg" : "bg-ink-2"}`} />
            {subtitulo(aviso)}
          </span>
        }
        actions={
          <>
            <div className="inline-flex overflow-hidden rounded-sm border border-line bg-surface" role="group" aria-label="Visão">
              <button
                type="button"
                aria-pressed={visao === "mes"}
                onClick={() => setVisao("mes")}
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
                onClick={() => setVisao("lista")}
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
          {loadError ? (
            <p role="alert" className="max-w-prose text-sm text-neg">
              {loadError}
            </p>
          ) : null}
          {!mesPronto && !loadError ? (
            <p className="max-w-prose text-sm text-ink-2">Carregando agenda.</p>
          ) : null}
          <ConectarGoogle onConnect={sincronizar} aviso={aviso} />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1 font-display text-lg font-bold">
              <Button variant="quiet" className="min-w-10 px-0" aria-label="Mês anterior" onClick={mesAnterior}>
                ‹
              </Button>
              <span>
                {meses[month - 1]} de {year}
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
                <i className="size-2.5 rounded-full bg-event" />
                Compromissos
              </Camada>
              <Camada
                pressed={camadas.lancamento}
                onClick={() => setCamadas((atual) => ({ ...atual, lancamento: !atual.lancamento }))}
              >
                <i className="size-2.5 rounded-full bg-neg" />
                <i className="size-2.5 rounded-full bg-pos" />
                Lançamentos
              </Camada>
              <Button onClick={sincronizar}>Sincronizar</Button>
            </div>
          </div>
          {mesPronto && visao === "mes" ? (
            <GradeMes
              year={year}
              month={month}
              selected={selected}
              today={hojeNoMes}
              itens={itens}
              onSelect={escolherDia}
              onContext={abrirMenu}
            />
          ) : null}
          {mesPronto && visao === "lista" ? <ListaMes year={year} month={month} itens={itens} /> : null}
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
        aria-labelledby="titulo-dia"
        onClose={() => setDiaAberto(false)}
        onClick={(event) => {
          if (event.target === dia.current) setDiaAberto(false);
        }}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 id="titulo-dia" className="flex flex-wrap items-center gap-2 font-display text-lg">
            {rotuloDoDia(year, month, selected)}
            {ehHoje(year, month, selected) ? (
              <Chip tone="ok" className="font-sans font-normal">
                Hoje
              </Chip>
            ) : null}
          </h2>
          <Button variant="quiet" onClick={() => setDiaAberto(false)}>
            Fechar
          </Button>
        </div>
        <div className="max-h-[60dvh] overflow-auto">
          <ListaDoDia year={year} month={month} day={selected} itens={doDia} />
        </div>
        <div className="mt-2 flex justify-end">
          <Button variant="primary" onClick={novoCompromisso}>
            Novo compromisso neste dia
          </Button>
        </div>
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
        <form className="grid gap-4" onSubmit={salvar}>
          <div className="grid gap-1">
            <label htmlFor="compromisso-titulo" className="text-sm font-medium">
              Título
            </label>
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
            <label htmlFor="compromisso-categoria" className="text-sm font-medium">
              Categoria
            </label>
            <select
              id="compromisso-categoria"
              value={draft?.category ?? "unico"}
              onChange={(event) =>
                setDraft((atual) =>
                  atual ? ajustarCategoria(atual, event.target.value as CategoriaCompromisso) : atual,
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
            <p className="text-xs text-ink-2">{dicaDaCategoria[draft?.category ?? "unico"]}</p>
          </div>
          <div className="grid gap-3 tab:grid-cols-2">
            <div className="grid gap-1">
              <label htmlFor="compromisso-data" className="text-sm font-medium">
                {draft?.category === "validade" ? "Início" : draft?.category === "recorrente" ? "Primeiro dia" : "Data"}
              </label>
              <input
                id="compromisso-data"
                type="date"
                required
                min={draft?.category === "recorrente" ? `${hoje.getFullYear()}-01-01` : undefined}
                max={draft?.category === "recorrente" ? `${hoje.getFullYear()}-12-31` : undefined}
                value={draft?.date ?? ""}
                onChange={(event) =>
                  setDraft((atual) => (atual ? { ...atual, date: event.target.value } : atual))
                }
                className={field}
              />
            </div>
            {draft?.category === "validade" ? (
              <div className="grid gap-1">
                <label htmlFor="compromisso-fim" className="text-sm font-medium">
                  Fim
                </label>
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
            ) : (
              <div className="grid gap-1">
                <label htmlFor="compromisso-hora" className="text-sm font-medium">
                  Hora <span className="font-normal text-ink-2">(opcional)</span>
                </label>
                <input
                  id="compromisso-hora"
                  type="time"
                  value={draft?.time ?? ""}
                  onChange={(event) =>
                    setDraft((atual) => (atual ? { ...atual, time: event.target.value } : atual))
                  }
                  className={field}
                />
              </div>
            )}
          </div>
          {draft?.category === "validade" ? (
            <div className="grid gap-1">
              <label htmlFor="compromisso-hora" className="text-sm font-medium">
                Hora <span className="font-normal text-ink-2">(opcional)</span>
              </label>
              <input
                id="compromisso-hora"
                type="time"
                value={draft.time}
                onChange={(event) =>
                  setDraft((atual) => (atual ? { ...atual, time: event.target.value } : atual))
                }
                className={field}
              />
            </div>
          ) : null}
          <div className="grid gap-1">
            <label htmlFor="compromisso-agenda" className="text-sm font-medium">
              Agenda do Google
            </label>
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
            <label htmlFor="compromisso-vinculo" className="text-sm font-medium">
              Vincular a uma transação <span className="font-normal text-ink-2">(opcional)</span>
            </label>
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
          {formError ? (
            <p role="alert" className="text-sm text-neg">
              {formError}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
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

function ConectarGoogle({ onConnect, aviso }: { onConnect: () => void; aviso: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-surface p-6">
      <div>
        <p className="font-medium">Conectar Google Calendar</p>
        <p className="max-w-prose text-sm text-ink-2">
          Os compromissos do Google aparecem aqui depois da conexão. Os lançamentos do Prumo já estão
          no calendário.
        </p>
        {aviso ? <p className="mt-2 text-sm text-ink-2">{aviso}</p> : null}
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

function subtitulo(aviso: string) {
  return aviso ? "Não foi possível sincronizar com o Google Calendar" : "Google Calendar desconectado";
}

function dataIso(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function ajustarCategoria(atual: Rascunho, category: CategoriaCompromisso): Rascunho {
  if (category !== "recorrente") return { ...atual, category };
  const ano = new Date().getFullYear();
  if (atual.date.startsWith(`${ano}-`)) return { ...atual, category };
  const hoje = new Date();
  return { ...atual, category, date: dataIso(ano, hoje.getMonth() + 1, hoje.getDate()) };
}

function fimDoRascunho(draft: Rascunho) {
  if (draft.category !== "validade") return { endYear: null, endMonth: null, endDay: null };
  const [anoTexto, mesTexto, diaTexto] = draft.endDate.split("-");
  return { endYear: Number(anoTexto), endMonth: Number(mesTexto), endDay: Number(diaTexto) };
}

function posicaoDoMenu(menu: Menu) {
  const margem = 8;
  const largura = 240;
  const altura = 88;
  const x = Math.max(margem, Math.min(menu.x, window.innerWidth - largura - margem));
  const y = Math.max(margem, Math.min(menu.y, window.innerHeight - altura - margem));
  return { left: x, top: y };
}
