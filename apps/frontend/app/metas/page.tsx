"use client";

import { useEffect, useRef, useState } from "react";
import { calcularMeta, type CalculoMeta, type Meta, type MetasResposta } from "@finnagent/contracts";
import { reaisParaCentavos } from "../financas/reais";
import { Button } from "../../components/ui/button";
import { Chip } from "../../components/ui/chip";
import { focusRing } from "../../components/ui/cn";
import { Money } from "../../components/ui/money";
import { PageHeader } from "../../components/ui/page-header";
import { Stat } from "../../components/ui/stat";

const MESES = [
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

const field = `min-h-10 w-full min-w-0 rounded-sm border border-line bg-surface px-3 text-base text-ink ${focusRing}`;
const dialogClass =
  "mt-auto mb-0 w-full max-w-none rounded-t-lg border border-line bg-surface p-6 text-ink backdrop:bg-overlay/80 tab:m-auto tab:max-w-lg tab:rounded-lg";

function reais(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function centavosDaMeta(texto: string, permiteZero: boolean) {
  const limpo = texto.trim();
  if (!limpo) return permiteZero ? 0 : null;
  if (permiteZero && /^0([.,]00?)?$/.test(limpo.replace(/\s/g, ""))) return 0;
  const valor = reaisParaCentavos(limpo);
  if (valor === null || valor < 0) return null;
  return valor;
}

function meses(quantidade: number) {
  return quantidade === 1 ? "1 mês" : `${quantidade} meses`;
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
  });
  if (response.status === 204) return undefined as T;
  const body = (await response.json().catch(() => ({}))) as { message?: string | string[] };
  if (!response.ok) {
    const message = Array.isArray(body.message) ? body.message[0] : body.message;
    throw new Error(message || "O backend não respondeu.");
  }
  return body as T;
}

function textoDoCalculo(meta: Pick<Meta, "dueYear" | "dueMonth">, calculo: CalculoMeta, sobra: number) {
  if (calculo.alcancada) return ["Você já tem o valor desta meta."];
  const frases = [`Faltam ${reais(calculo.falta)}.`];
  if (calculo.prazoPassou) frases.push("O prazo já passou.");
  if (calculo.porMes !== null && meta.dueMonth && meta.dueYear) {
    frases.push(
      `Para chegar em ${MESES[meta.dueMonth - 1]} de ${meta.dueYear}, separe ${reais(calculo.porMes)} por mês.`,
    );
  }
  if (calculo.mesesNaSobra !== null) {
    frases.push(`Guardando a sobra deste mês, você chega em ${meses(calculo.mesesNaSobra)}.`);
  } else if (sobra <= 0) {
    frases.push("A sobra deste mês não cobre a meta.");
  }
  if (calculo.porMes !== null && sobra > 0 && calculo.porMes > sobra) {
    frases.push("Essa parcela passa da sobra deste mês.");
  }
  return frases;
}

export default function MetasPage() {
  const dialogo = useRef<HTMLDialogElement>(null);
  const exclusao = useRef<HTMLDialogElement>(null);
  const [dados, setDados] = useState<MetasResposta | null>(null);
  const [erroCarga, setErroCarga] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [nome, setNome] = useState("");
  const [alvo, setAlvo] = useState("");
  const [guardado, setGuardado] = useState("");
  const [comPrazo, setComPrazo] = useState(false);
  const [dueMonth, setDueMonth] = useState(1);
  const [dueYear, setDueYear] = useState(2026);
  const [apagando, setApagando] = useState<Meta | null>(null);

  function carregar() {
    setErroCarga("");
    return api<MetasResposta>("/api/metas")
      .then(setDados)
      .catch((error: Error) => setErroCarga(error.message));
  }

  useEffect(() => {
    void carregar();
  }, []);

  function abrir() {
    setErro("");
    setNome("");
    setAlvo("");
    setGuardado("");
    setComPrazo(false);
    if (dados) {
      setDueMonth(dados.month);
      setDueYear(dados.year);
    }
    dialogo.current?.showModal();
  }

  function salvar(event: React.FormEvent) {
    event.preventDefault();
    const targetCents = centavosDaMeta(alvo, false);
    const savedCents = centavosDaMeta(guardado, true);
    if (targetCents === null || savedCents === null) {
      setErro("Informe um valor em reais.");
      return;
    }
    setSalvando(true);
    setErro("");
    api<Meta>("/api/metas", {
      method: "POST",
      body: JSON.stringify({
        id: crypto.randomUUID(),
        name: nome.trim(),
        targetCents,
        savedCents,
        dueYear: comPrazo ? dueYear : null,
        dueMonth: comPrazo ? dueMonth : null,
      }),
    })
      .then(() => carregar())
      .then(() => dialogo.current?.close())
      .catch((error: Error) => setErro(error.message))
      .finally(() => setSalvando(false));
  }

  function confirmarExclusao() {
    if (!apagando) return;
    setSalvando(true);
    setErro("");
    api<void>(`/api/metas/${apagando.id}`, { method: "DELETE" })
      .then(() => carregar())
      .then(() => {
        setApagando(null);
        exclusao.current?.close();
      })
      .catch((error: Error) => setErro(error.message))
      .finally(() => setSalvando(false));
  }

  const alvoCentavos = centavosDaMeta(alvo, false);
  const guardadoCentavos = centavosDaMeta(guardado, true) ?? 0;
  const previa =
    dados && alvoCentavos !== null
      ? calcularMeta(
          {
            targetCents: alvoCentavos,
            savedCents: guardadoCentavos,
            dueYear: comPrazo ? dueYear : null,
            dueMonth: comPrazo ? dueMonth : null,
          },
          dados,
          dados.surplusCents,
        )
      : null;

  return (
    <>
      <PageHeader
        title="Metas"
        subtitle="Defina o que você quer e veja quanto separar para chegar lá."
        actions={
          <Button variant="primary" onClick={abrir} disabled={!dados}>
            Nova meta
          </Button>
        }
      />

      {erroCarga ? (
        <p role="alert" className="mb-4 max-w-prose text-sm text-neg">
          {erroCarga}
        </p>
      ) : null}
      {!dados && !erroCarga ? (
        <p role="status" className="max-w-prose text-sm text-ink-2">
          Carregando metas.
        </p>
      ) : null}

      {dados ? (
        <>
          <dl className="mb-6 flex flex-wrap gap-x-8 gap-y-4 border-y border-line py-4" aria-label="Resumo das metas">
            <Stat label={`Sobra de ${MESES[dados.month - 1]}`}>
              <Money cents={dados.surplusCents} strong />
            </Stat>
            <Stat label="Metas">{dados.goals.length}</Stat>
          </dl>

          {dados.goals.length === 0 ? (
            <p className="rounded-lg border border-line bg-surface p-6 text-sm text-ink-2">
              Nenhuma meta ainda. Crie a primeira para ver quanto separar por mês.
            </p>
          ) : (
            <ul className="grid gap-4 tab:grid-cols-2">
              {dados.goals.map((meta) => {
                const calculo = calcularMeta(meta, dados, dados.surplusCents);
                const progresso =
                  meta.targetCents > 0
                    ? Math.min(100, Math.round((meta.savedCents / meta.targetCents) * 100))
                    : 0;
                return (
                  <li key={meta.id} className="grid min-w-0 gap-3 rounded-lg border border-line bg-surface p-4">
                    <div className="flex min-w-0 items-start justify-between gap-3">
                      <h2 className="min-w-0 font-display text-lg wrap-break-word">{meta.name}</h2>
                      {calculo.alcancada ? (
                        <Chip tone="ok" className="shrink-0">
                          Alcançada
                        </Chip>
                      ) : null}
                    </div>
                    <div className="h-2 overflow-hidden rounded-sm bg-brand-soft" aria-hidden>
                      <div className="h-full bg-brand" style={{ width: `${progresso}%` }} />
                    </div>
                    <p className="text-sm font-medium">
                      {reais(meta.savedCents)} de {reais(meta.targetCents)}
                    </p>
                    <div className="grid gap-1 text-sm text-ink-2">
                      {textoDoCalculo(meta, calculo, dados.surplusCents).map((frase) => (
                        <p key={frase}>{frase}</p>
                      ))}
                    </div>
                    <div>
                      <Button
                        variant="quiet"
                        onClick={() => {
                          setErro("");
                          setApagando(meta);
                          exclusao.current?.showModal();
                        }}
                      >
                        Excluir
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      ) : null}

      <dialog
        ref={dialogo}
        className={dialogClass}
        aria-labelledby="titulo-nova-meta"
        onClose={() => setErro("")}
      >
        <h2 id="titulo-nova-meta" className="mb-4 font-display text-lg">
          Nova meta
        </h2>
        <form className="grid gap-4" onSubmit={salvar}>
          <div className="grid gap-1">
            <label htmlFor="meta-nome" className="text-sm font-medium">
              Nome
            </label>
            <input
              id="meta-nome"
              className={field}
              required
              maxLength={80}
              value={nome}
              onChange={(event) => setNome(event.target.value)}
            />
          </div>
          <div className="grid gap-4 tab:grid-cols-2">
            <div className="grid gap-1">
              <label htmlFor="meta-alvo" className="text-sm font-medium">
                Quanto você quer
              </label>
              <input
                id="meta-alvo"
                className={field}
                inputMode="decimal"
                required
                placeholder="0,00"
                value={alvo}
                onChange={(event) => setAlvo(event.target.value)}
              />
            </div>
            <div className="grid gap-1">
              <label htmlFor="meta-guardado" className="text-sm font-medium">
                Quanto você já separou
              </label>
              <input
                id="meta-guardado"
                className={field}
                inputMode="decimal"
                placeholder="0,00"
                value={guardado}
                onChange={(event) => setGuardado(event.target.value)}
              />
            </div>
          </div>
          <label className="flex min-h-10 items-center gap-2 text-sm">
            <input
              type="checkbox"
              className={`size-4 accent-brand ${focusRing}`}
              checked={comPrazo}
              onChange={(event) => setComPrazo(event.target.checked)}
            />
            Definir um prazo
          </label>
          {comPrazo ? (
            <div className="grid gap-4 tab:grid-cols-2">
              <div className="grid gap-1">
                <label htmlFor="meta-mes" className="text-sm font-medium">
                  Mês
                </label>
                <select
                  id="meta-mes"
                  className={field}
                  value={dueMonth}
                  onChange={(event) => setDueMonth(Number(event.target.value))}
                >
                  {MESES.map((mes, index) => (
                    <option key={mes} value={index + 1}>
                      {mes}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-1">
                <label htmlFor="meta-ano" className="text-sm font-medium">
                  Ano
                </label>
                <input
                  id="meta-ano"
                  className={field}
                  inputMode="numeric"
                  required
                  min={2000}
                  max={2100}
                  value={dueYear}
                  onChange={(event) => setDueYear(Number(event.target.value))}
                />
              </div>
            </div>
          ) : null}
          {previa && dados ? (
            <div className="grid gap-1 rounded-sm bg-brand-soft p-3 text-sm text-ink">
              {textoDoCalculo(
                { dueYear: comPrazo ? dueYear : null, dueMonth: comPrazo ? dueMonth : null },
                previa,
                dados.surplusCents,
              ).map((frase) => (
                <p key={frase}>{frase}</p>
              ))}
            </div>
          ) : null}
          {erro ? (
            <p role="alert" className="text-sm text-neg">
              {erro}
            </p>
          ) : null}
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="quiet" onClick={() => dialogo.current?.close()}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" disabled={salvando}>
              Salvar
            </Button>
          </div>
        </form>
      </dialog>

      <dialog ref={exclusao} className={dialogClass} aria-labelledby="titulo-excluir-meta">
        <div className="grid gap-4">
          <h2 id="titulo-excluir-meta" className="font-display text-lg">
            Excluir esta meta?
          </h2>
          <p>{apagando?.name}</p>
          {erro ? (
            <p role="alert" className="text-sm text-neg">
              {erro}
            </p>
          ) : null}
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              variant="quiet"
              onClick={() => {
                setApagando(null);
                exclusao.current?.close();
              }}
            >
              Cancelar
            </Button>
            <Button variant="danger" disabled={salvando} onClick={confirmarExclusao}>
              Excluir
            </Button>
          </div>
        </div>
      </dialog>
    </>
  );
}
