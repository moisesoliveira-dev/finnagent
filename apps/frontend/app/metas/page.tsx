"use client";

import { motion, Reorder } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { calcularMeta, type CalculoMeta, type Meta, type MetasResposta } from "@finnagent/contracts";
import { CampoValor } from "../financas/campo-valor";
import { reaisParaCentavos } from "../financas/reais";
import { Button } from "../../components/ui/button";
import { Carregando } from "../../components/ui/esqueleto";
import { Dialogo } from "../../components/ui/dialogo";
import { ItemAnimado, ListaAnimada, useCurva } from "../../components/ui/movimento";
import { Chip } from "../../components/ui/chip";
import { campo, cn, focusRing } from "../../components/ui/cn";
import { Icone } from "../../components/ui/icone";
import { Vazio } from "../../components/ui/vazio";
import { formatarReais, Money } from "../../components/ui/money";
import { PageHeader } from "../../components/ui/page-header";
import { Dica, Rotulo } from "../../components/ui/rotulo";
import { Stat } from "../../components/ui/stat";
import { useToast } from "../../components/ui/toast";

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

const field = cn(campo, "w-full");

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
  const frases = [`Faltam ${formatarReais(calculo.falta)}.`];
  if (calculo.prazoPassou) frases.push("O prazo já passou.");
  if (calculo.porMes !== null && meta.dueMonth && meta.dueYear) {
    frases.push(
      `Para chegar em ${MESES[meta.dueMonth - 1]} de ${meta.dueYear}, separe ${formatarReais(calculo.porMes)} por mês.`,
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

// Anel de progresso: o traço azul se desenha a partir do topo e o percentual fica no centro.
function Anel({ percentual, alcancada }: { percentual: number; alcancada: boolean }) {
  const curva = useCurva();
  return (
    <div className="relative aspect-square w-full" role="img" aria-label={`${percentual}% da meta`}>
      <svg viewBox="0 0 36 36" className="size-full -rotate-90" fill="none" strokeWidth={3} aria-hidden="true">
        <circle cx="18" cy="18" r="15" className="stroke-brand-soft" />
        <motion.circle
          cx="18"
          cy="18"
          r="15"
          className={alcancada ? "stroke-pos" : "stroke-brand"}
          initial={{ pathLength: 0 }}
          animate={{ pathLength: percentual / 100 }}
          transition={curva}
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center font-display text-lg font-bold tracking-titulo">
        {percentual}%
      </span>
    </div>
  );
}

export default function MetasPage() {
  const toast = useToast();
  const dialogo = useRef<HTMLDialogElement>(null);
  const exclusao = useRef<HTMLDialogElement>(null);
  const [dados, setDados] = useState<MetasResposta | null>(null);
  const [falhou, setFalhou] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [nome, setNome] = useState("");
  const [alvo, setAlvo] = useState("");
  const [guardado, setGuardado] = useState("");
  const [comPrazo, setComPrazo] = useState(false);
  const [dueMonth, setDueMonth] = useState(1);
  const [dueYear, setDueYear] = useState(2026);
  const [apagando, setApagando] = useState<Meta | null>(null);
  const separacao = useRef<HTMLDialogElement>(null);
  const [separando, setSeparando] = useState<Meta | null>(null);
  const [valorSeparado, setValorSeparado] = useState("");
  const organizacao = useRef<HTMLDialogElement>(null);
  const [ordem, setOrdem] = useState<Meta[]>([]);
  const divisao = useRef<HTMLDialogElement>(null);
  const [percentuais, setPercentuais] = useState<Record<string, string>>({});

  function carregar() {
    return api<MetasResposta>("/api/metas")
      .then((resposta) => {
        setDados(resposta);
        setFalhou(false);
      })
      .catch((error: Error) => {
        setFalhou(true);
        toast.erro(error.message);
      });
  }

  useEffect(() => {
    void carregar();
  }, []);

  function abrir() {
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
      toast.erro("Informe um valor em reais.");
      return;
    }
    setSalvando(true);
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
      .then(() => {
        toast.sucesso("Meta salva.");
        return carregar();
      })
      .then(() => dialogo.current?.close())
      .catch((error: Error) => toast.erro(error.message))
      .finally(() => setSalvando(false));
  }

  function abrirDividir() {
    if (!dados) return;
    setPercentuais(
      Object.fromEntries(dados.goals.map((meta) => [meta.id, String(dados.division[meta.id]?.percent ?? 0)])),
    );
    divisao.current?.showModal();
  }

  function percentualDe(id: string) {
    const numero = Number(percentuais[id] ?? 0);
    return Number.isFinite(numero) ? Math.min(Math.max(Math.round(numero), 0), 100) : 0;
  }

  // Só dígitos, de 0 a 100, e no máximo o que falta para fechar 100% somando as outras metas.
  function limiteDe(id: string) {
    if (!dados) return 100;
    const outras = dados.goals
      .filter((meta) => meta.id !== id)
      .reduce(
        (soma, meta) => soma + (dados.division[meta.id]?.approved ? (dados.division[meta.id]?.percent ?? 0) : percentualDe(meta.id)),
        0,
      );
    return Math.max(100 - outras, 0);
  }

  function mudarPercentual(id: string, texto: string) {
    const digitos = texto.replace(/\D/g, "").slice(0, 3);
    const valor = digitos === "" ? "" : String(Math.min(Number(digitos), limiteDe(id)));
    setPercentuais((atual) => ({ ...atual, [id]: valor }));
  }

  function salvarDivisao() {
    if (!dados) return;
    setSalvando(true);
    api<void>("/api/metas/divisao", {
      method: "PUT",
      body: JSON.stringify({
        percents: Object.fromEntries(
          dados.goals.filter((meta) => !dados.division[meta.id]?.approved).map((meta) => [meta.id, percentualDe(meta.id)]),
        ),
      }),
    })
      .then(() => {
        toast.sucesso("Divisão salva. Aprove cada parte para separar.");
        return carregar();
      })
      .then(() => divisao.current?.close())
      .catch((error: Error) => toast.erro(error.message))
      .finally(() => setSalvando(false));
  }

  async function aprovar(metas: Meta[]) {
    setSalvando(true);
    try {
      for (const meta of metas) await api<void>(`/api/metas/${meta.id}/aprovar`, { method: "POST", body: "{}" });
      toast.sucesso(metas.length === 1 ? "Valor aprovado e separado." : "Valores aprovados e separados.");
    } catch (error) {
      toast.erro(error instanceof Error ? error.message : "Não foi possível aprovar.");
    } finally {
      setSalvando(false);
      await carregar();
    }
  }

  function abrirOrganizar() {
    if (!dados) return;
    setOrdem(dados.goals);
    organizacao.current?.showModal();
  }

  function mover(indice: number, passo: number) {
    setOrdem((atual) => {
      const destino = indice + passo;
      if (destino < 0 || destino >= atual.length) return atual;
      const copia = [...atual];
      const [meta] = copia.splice(indice, 1);
      copia.splice(destino, 0, meta as Meta);
      return copia;
    });
  }

  function salvarOrdem() {
    setSalvando(true);
    api<void>("/api/metas/ordem", { method: "PUT", body: JSON.stringify({ ids: ordem.map((meta) => meta.id) }) })
      .then(() => {
        toast.sucesso("Prioridade salva.");
        return carregar();
      })
      .then(() => organizacao.current?.close())
      .catch((error: Error) => toast.erro(error.message))
      .finally(() => setSalvando(false));
  }

  function abrirSeparar(meta: Meta, sugerido: number) {
    setSeparando(meta);
    setValorSeparado(sugerido > 0 ? (sugerido / 100).toFixed(2).replace(".", ",") : "");
    separacao.current?.showModal();
  }

  function separar(event: React.FormEvent) {
    event.preventDefault();
    const cents = centavosDaMeta(valorSeparado, false);
    if (!separando || cents === null || cents <= 0) {
      toast.erro("Informe um valor em reais.");
      return;
    }
    setSalvando(true);
    api<void>(`/api/metas/${separando.id}/separar`, { method: "POST", body: JSON.stringify({ cents }) })
      .then(() => {
        toast.sucesso("Valor separado.");
        return carregar();
      })
      .then(() => separacao.current?.close())
      .catch((error: Error) => toast.erro(error.message))
      .finally(() => setSalvando(false));
  }

  function confirmarExclusao() {
    if (!apagando) return;
    setSalvando(true);
    api<void>(`/api/metas/${apagando.id}`, { method: "DELETE" })
      .then(() => {
        toast.sucesso("Meta excluída.");
        return carregar();
      })
      .then(() => exclusao.current?.close())
      .catch((error: Error) => toast.erro(error.message))
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
          <>
            <Button onClick={abrirDividir} disabled={!dados || dados.goals.length === 0}>
              Dividir a sobra
            </Button>
            <Button onClick={abrirOrganizar} disabled={!dados || dados.goals.length < 2}>
              Organizar prioridade
            </Button>
            <Button variant="primary" onClick={abrir} disabled={!dados}>
              Nova meta
            </Button>
          </>
        }
      />

      {!dados && !falhou ? (
        <Carregando texto="Carregando metas." linhas={3} />
      ) : null}

      {dados ? (
        <>
          {(() => {
            const emAndamento = dados.goals
              .map((meta) => calcularMeta(meta, dados, dados.surplusCents))
              .filter((calculo) => !calculo.alcancada);
            const porMes = emAndamento.reduce((soma, calculo) => soma + (calculo.porMes ?? 0), 0);
            const guardadoTotal = dados.goals.reduce((soma, meta) => soma + meta.savedCents, 0);
            const alvoTotal = dados.goals.reduce((soma, meta) => soma + meta.targetCents, 0);
            const cabe = porMes <= Math.max(dados.surplusCents, 0);
            return (
              <section aria-label="Resumo das metas" className="mb-6 grid min-w-0 gap-4 border border-line bg-surface p-4">
                <dl className="flex flex-wrap gap-x-8 gap-y-4">
                  <Stat label={`Sobra de ${MESES[dados.month - 1]}`}>
                    <Money cents={dados.surplusCents} strong />
                  </Stat>
                  <Stat label="Separado este mês">
                    <Money cents={-dados.separatedCents} />
                  </Stat>
                  <Stat label="Livre depois das metas">
                    <Money cents={dados.surplusCents - dados.separatedCents} strong />
                  </Stat>
                  <Stat label="Guardado">
                    {formatarReais(guardadoTotal)} <span className="text-sm font-normal text-ink-2">de {formatarReais(alvoTotal)}</span>
                  </Stat>
                  {porMes > 0 ? (
                    <Stat label="Separar por mês">
                      <span className="inline-flex flex-wrap items-center gap-2">
                        {formatarReais(porMes)}
                        <Chip tone={cabe ? "ok" : "neg"}>{cabe ? "Cabe na sobra" : "Passa da sobra"}</Chip>
                      </span>
                    </Stat>
                  ) : null}
                </dl>
                {(() => {
                  const pendentes = dados.goals.filter((meta) => {
                    const parte = dados.division[meta.id];
                    return meta.sessionId && parte && !parte.approved && parte.cents > 0;
                  });
                  return pendentes.length ? (
                    <div className="flex flex-wrap items-center gap-3">
                      <Chip tone="ai">Aguardando sua aprovação</Chip>
                      <span className="text-sm text-ink-2">
                        {pendentes.length === 1 ? "1 meta" : `${pendentes.length} metas`} com parte da sobra de{" "}
                        {MESES[dados.month - 1]?.toLowerCase()}.
                      </span>
                      <Button disabled={salvando} onClick={() => void aprovar(pendentes)}>
                        Aprovar todas
                      </Button>
                    </div>
                  ) : null;
                })()}
                <p className="max-w-prose text-sm text-ink-2">
                  As metas têm prioridade na sobra do mês, na ordem que você escolher: a primeira recebe antes. O valor separado
                  sai como negativo na sessão da meta, no grupo Metas.
                </p>
              </section>
            );
          })()}

          {dados.goals.length === 0 ? (
            <Vazio>Nenhuma meta ainda. Crie a primeira para ver quanto separar por mês.</Vazio>
          ) : (
            <ListaAnimada className="grid gap-4 tab:grid-cols-2 desk:grid-cols-3">
              {dados.goals.map((meta, indice) => {
                const calculo = calcularMeta(meta, dados, dados.surplusCents);
                const progresso =
                  meta.targetCents > 0
                    ? Math.min(100, Math.round((meta.savedCents / meta.targetCents) * 100))
                    : 0;
                return (
                  <ItemAnimado
                    key={meta.id}
                    whileHover={{ y: -2 }}
                    className="grid min-w-0 content-start gap-4 border border-line bg-surface p-4"
                  >
                    <div className="flex min-w-0 items-center gap-4">
                      <div className="w-1/3 shrink-0">
                        <Anel percentual={progresso} alcancada={calculo.alcancada} />
                      </div>
                      <div className="grid min-w-0 flex-1 gap-2">
                        <p className="etiqueta text-ink-2">Prioridade {indice + 1}</p>
                        <h2 className="font-display text-lg wrap-break-word">{meta.name}</h2>
                        <p className="text-sm font-medium">
                          {formatarReais(meta.savedCents)}{" "}
                          <span className="font-normal text-ink-2">de {formatarReais(meta.targetCents)}</span>
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {calculo.alcancada ? <Chip tone="ok">Alcançada</Chip> : null}
                          <Chip tone={calculo.prazoPassou && !calculo.alcancada ? "neg" : "default"}>
                            {meta.dueMonth && meta.dueYear
                              ? `Prazo ${MESES[meta.dueMonth - 1]?.slice(0, 3)}/${meta.dueYear}`
                              : "Sem prazo"}
                          </Chip>
                        </div>
                      </div>
                    </div>
                    {dados.division[meta.id] ? (
                      <div className="flex flex-wrap items-center justify-between gap-2 border border-line bg-surface-2 p-3 text-sm">
                        <span>
                          <span className="etiqueta text-ink-2">{dados.division[meta.id]?.approved ? "Aprovada" : "Proposta do mês"}</span>{" "}
                          <span className="font-medium">
                            {dados.division[meta.id]?.percent}% · {formatarReais(dados.division[meta.id]?.cents ?? 0)}
                          </span>
                        </span>
                        {dados.division[meta.id]?.approved ? (
                          <Chip tone="ok">Separada</Chip>
                        ) : meta.sessionId && (dados.division[meta.id]?.cents ?? 0) > 0 ? (
                          <Button disabled={salvando} onClick={() => void aprovar([meta])}>
                            Aprovar
                          </Button>
                        ) : (
                          <Chip>Sem sobra</Chip>
                        )}
                      </div>
                    ) : (dados.suggested[meta.id] ?? 0) > 0 ? (
                      <p className="text-sm">
                        <span className="etiqueta text-ink-2">Pede da sobra</span>{" "}
                        <span className="font-medium">{formatarReais(dados.suggested[meta.id] ?? 0)}</span>
                      </p>
                    ) : null}
                    <div className="grid gap-1 text-sm text-ink-2">
                      {textoDoCalculo(meta, calculo, dados.surplusCents).map((frase) => (
                        <p key={frase}>{frase}</p>
                      ))}
                    </div>
                    <div className="flex items-center justify-between gap-2 border-t border-line pt-3">
                      {meta.sessionId && !calculo.alcancada ? (
                        <Button onClick={() => abrirSeparar(meta, dados.suggested[meta.id] ?? 0)}>Separar valor</Button>
                      ) : (
                        <span />
                      )}
                      <Button
                        variant="quiet"
                        className="size-10 px-0"
                        aria-label={`Excluir ${meta.name}`}
                        title="Excluir"
                        onClick={() => {
                          setApagando(meta);
                          exclusao.current?.showModal();
                        }}
                      >
                        <Icone name="remove" />
                      </Button>
                    </div>
                  </ItemAnimado>
                );
              })}
            </ListaAnimada>
          )}
        </>
      ) : null}

      <Dialogo
        ref={dialogo}
        aria-labelledby="titulo-nova-meta"
      >
        <h2 id="titulo-nova-meta" className="mb-4 font-display text-lg">
          Nova meta
        </h2>
        <form onSubmit={salvar}>
          <div className="dialog-corpo grid gap-4">
          <div className="grid gap-1">
            <Rotulo htmlFor="meta-nome" dica="O nome da meta.">
              Nome
            </Rotulo>
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
              <Rotulo htmlFor="meta-alvo" dica="O valor que você quer juntar.">
                Quanto você quer
              </Rotulo>
              <CampoValor id="meta-alvo" className={field} required value={alvo} onChange={setAlvo} />
            </div>
            <div className="grid gap-1">
              <Rotulo htmlFor="meta-guardado" dica="O que já está guardado para esta meta.">
                Quanto você já separou
              </Rotulo>
              <CampoValor id="meta-guardado" className={field} value={guardado} onChange={setGuardado} />
            </div>
          </div>
          <label className="flex min-h-10 items-center gap-2 text-sm">
            <input
              type="checkbox"
              className={`size-4 accent-brand ${focusRing}`}
              checked={comPrazo}
              onChange={(event) => setComPrazo(event.target.checked)}
            />
            <span className="inline-flex items-center gap-1">
              Definir um prazo
              <Dica texto="Calcula quanto separar por mês até essa data." />
            </span>
          </label>
          {comPrazo ? (
            <div className="grid gap-4 tab:grid-cols-2">
              <div className="grid gap-1">
                <Rotulo htmlFor="meta-mes" dica="O mês do prazo.">
                  Mês
                </Rotulo>
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
                <Rotulo htmlFor="meta-ano" dica="O ano do prazo.">
                  Ano
                </Rotulo>
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
          <p className="text-sm text-ink-2">
            A meta ganha uma sessão com o nome dela no grupo Metas. O que você separa fica ali como saída, em negativo.
          </p>
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
          </div>
          <div className="dialog-acoes">
            <Button type="button" variant="quiet" onClick={() => dialogo.current?.close()}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" disabled={salvando}>
              Salvar
            </Button>
          </div>
        </form>
      </Dialogo>

      <Dialogo ref={divisao} aria-labelledby="titulo-dividir">
        {dados ? (
          <>
            <h2 id="titulo-dividir" className="mb-2 font-display text-lg">
              Dividir a sobra de {MESES[dados.month - 1]}
            </h2>
            <p className="mb-4 text-sm text-ink-2">
              Escolha a porcentagem da sobra de cada meta. Nada é separado até você aprovar a parte de cada uma.
            </p>
            {(() => {
              const livre = Math.max(dados.surplusCents, 0);
              const soma = dados.goals
                .filter((meta) => !dados.division[meta.id]?.approved)
                .reduce((total, meta) => total + percentualDe(meta.id), 0);
              const jaAprovada = dados.goals
                .filter((meta) => dados.division[meta.id]?.approved)
                .reduce((total, meta) => total + (dados.division[meta.id]?.percent ?? 0), 0);
              const passou = soma + jaAprovada > 100;
              return (
                <>
                  <div className="dialog-corpo grid gap-3">
                    <p className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="etiqueta text-ink-2">Sobra de {MESES[dados.month - 1]}</span>
                      <Money cents={dados.surplusCents} strong />
                    </p>
                    {dados.goals.map((meta) => {
                      const parte = dados.division[meta.id];
                      const aprovada = parte?.approved === true;
                      return (
                        <div key={meta.id} className="flex min-w-0 items-center gap-3 border border-line bg-surface p-3">
                          <span className="grid min-w-0 flex-1 gap-1">
                            <span className="font-medium wrap-break-word">{meta.name}</span>
                            <span className="text-xs text-ink-2">
                              {aprovada
                                ? `Aprovada · ${formatarReais(parte?.cents ?? 0)}`
                                : formatarReais(Math.floor((livre * percentualDe(meta.id)) / 100))}
                            </span>
                          </span>
                          <label className="flex shrink-0 items-center gap-2">
                            <span className="sr-only">Porcentagem de {meta.name}</span>
                            <input
                              type="text"
                              inputMode="numeric"
                              autoComplete="off"
                              maxLength={3}
                              disabled={aprovada}
                              value={aprovada ? String(parte?.percent ?? 0) : (percentuais[meta.id] ?? "0")}
                              onChange={(event) => mudarPercentual(meta.id, event.target.value)}
                              onFocus={(event) => event.target.select()}
                              className={cn(campo, "w-12 px-1 text-right")}
                            />
                            <span aria-hidden="true">%</span>
                          </label>
                        </div>
                      );
                    })}
                    <p className={cn("flex items-baseline justify-between gap-3 text-sm", passou && "text-neg")}>
                      <span className="etiqueta">Total dividido</span>
                      <span className="font-medium">
                        {soma + jaAprovada}%{passou ? " · passa de 100%" : ""}
                      </span>
                    </p>
                  </div>
                  <div className="dialog-acoes">
                    <Button type="button" variant="quiet" onClick={() => divisao.current?.close()}>
                      Cancelar
                    </Button>
                    <Button variant="primary" disabled={salvando || passou} onClick={salvarDivisao}>
                      Salvar divisão
                    </Button>
                  </div>
                </>
              );
            })()}
          </>
        ) : null}
      </Dialogo>

      <Dialogo ref={organizacao} aria-labelledby="titulo-organizar">
        <h2 id="titulo-organizar" className="mb-2 font-display text-lg">
          Organizar prioridade
        </h2>
        <p className="mb-4 text-sm text-ink-2">
          Arraste para mudar a ordem. A de cima recebe primeiro da sobra do mês.
        </p>
        <div className="dialog-corpo">
          <Reorder.Group axis="y" values={ordem} onReorder={setOrdem} className="grid gap-2">
            {ordem.map((meta, indice) => (
              <Reorder.Item
                key={meta.id}
                value={meta}
                whileDrag={{ scale: 1.02 }}
                className="flex min-w-0 cursor-grab items-center gap-3 border border-line bg-surface p-3 active:cursor-grabbing"
              >
                <span aria-hidden="true" className="etiqueta shrink-0 text-ink-2 select-none">
                  ⠿
                </span>
                <span className="font-display w-6 shrink-0 text-lg tabular-nums">{indice + 1}</span>
                <span className="grid min-w-0 flex-1 gap-1">
                  <span className="font-medium wrap-break-word">{meta.name}</span>
                  <span className="text-xs text-ink-2">
                    {formatarReais(meta.savedCents)} de {formatarReais(meta.targetCents)}
                  </span>
                </span>
                <span className="flex shrink-0 items-center">
                  <Button
                    variant="quiet"
                    className="size-10 px-0"
                    aria-label={`Subir ${meta.name}`}
                    disabled={indice === 0}
                    onClick={() => mover(indice, -1)}
                  >
                    ↑
                  </Button>
                  <Button
                    variant="quiet"
                    className="size-10 px-0"
                    aria-label={`Descer ${meta.name}`}
                    disabled={indice === ordem.length - 1}
                    onClick={() => mover(indice, 1)}
                  >
                    ↓
                  </Button>
                </span>
              </Reorder.Item>
            ))}
          </Reorder.Group>
        </div>
        <div className="dialog-acoes">
          <Button type="button" variant="quiet" onClick={() => organizacao.current?.close()}>
            Cancelar
          </Button>
          <Button variant="primary" disabled={salvando} onClick={salvarOrdem}>
            Salvar ordem
          </Button>
        </div>
      </Dialogo>

      <Dialogo ref={separacao} aria-labelledby="titulo-separar" onClose={() => setSeparando(null)}>
        <h2 id="titulo-separar" className="mb-4 font-display text-lg">
          Separar para {separando?.name}
        </h2>
        <form onSubmit={separar}>
          <div className="dialog-corpo grid gap-4">
            <div className="grid gap-1">
              <Rotulo htmlFor="meta-separar" dica="Sai da sobra e fica na sessão da meta, como saída.">
                Quanto separar
              </Rotulo>
              <CampoValor id="meta-separar" className={field} required value={valorSeparado} onChange={setValorSeparado} />
            </div>
          </div>
          <div className="dialog-acoes">
            <Button type="button" variant="quiet" onClick={() => separacao.current?.close()}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" disabled={salvando}>
              Separar
            </Button>
          </div>
        </form>
      </Dialogo>

      <Dialogo ref={exclusao} aria-labelledby="titulo-excluir-meta" onClose={() => setApagando(null)}>
        <div className="dialog-corpo grid gap-4">
          <h2 id="titulo-excluir-meta" className="font-display text-lg">
            Excluir esta meta?
          </h2>
          <p>{apagando?.name}</p>
        </div>
        <div className="dialog-acoes">
            <Button
              variant="quiet"
              onClick={() => exclusao.current?.close()}
            >
              Cancelar
            </Button>
            <Button variant="danger" disabled={salvando} onClick={confirmarExclusao}>
              Excluir
            </Button>
          </div>
      </Dialogo>
    </>
  );
}
