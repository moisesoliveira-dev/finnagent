"use client";

import { motion } from "motion/react";
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

export default function MetasPage() {
  const toast = useToast();
  const curva = useCurva();
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
          <Button variant="primary" onClick={abrir} disabled={!dados}>
            Nova meta
          </Button>
        }
      />

      {!dados && !falhou ? (
        <Carregando texto="Carregando metas." linhas={3} />
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
            <Vazio>Nenhuma meta ainda. Crie a primeira para ver quanto separar por mês.</Vazio>
          ) : (
            <ListaAnimada className="grid gap-4 tab:grid-cols-2">
              {dados.goals.map((meta) => {
                const calculo = calcularMeta(meta, dados, dados.surplusCents);
                const progresso =
                  meta.targetCents > 0
                    ? Math.min(100, Math.round((meta.savedCents / meta.targetCents) * 100))
                    : 0;
                return (
                  <ItemAnimado key={meta.id} className="grid min-w-0 gap-3 rounded-lg border border-line bg-surface p-4">
                    <div className="flex min-w-0 items-start justify-between gap-3">
                      <h2 className="min-w-0 font-display text-lg wrap-break-word">{meta.name}</h2>
                      {calculo.alcancada ? (
                        <Chip tone="ok" className="shrink-0">
                          Alcançada
                        </Chip>
                      ) : null}
                    </div>
                    <div className="h-2 overflow-hidden rounded-sm bg-brand-soft" aria-hidden>
                      <motion.div
                        className="h-full bg-brand"
                        initial={{ width: 0 }}
                        animate={{ width: `${progresso}%` }}
                        transition={curva}
                      />
                    </div>
                    <p className="text-sm font-medium">
                      {formatarReais(meta.savedCents)} de {formatarReais(meta.targetCents)}
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
                          setApagando(meta);
                          exclusao.current?.showModal();
                        }}
                      >
                        Excluir
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
