"use client";

import { useEffect, useState } from "react";
import {
  LIMITE_FERIADOS_LOCAIS,
  NOME_MES,
  ROTULO_DO_TIPO_DE_FERIADO,
  type Feriado,
  type FeriadoLocal,
} from "@finnagent/contracts";
import { Button } from "../../components/ui/button";
import { Chip } from "../../components/ui/chip";
import { campo, cn } from "../../components/ui/cn";
import { Carregando } from "../../components/ui/esqueleto";
import { ItemAnimado, ListaAnimada, Troca } from "../../components/ui/movimento";
import { Rotulo } from "../../components/ui/rotulo";
import { useToast } from "../../components/ui/toast";

const field = cn(campo, "w-full");

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

const DIAS_NO_MES = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

const diaDaSemana = new Intl.DateTimeFormat("pt-BR", { weekday: "short", timeZone: "UTC" });

type Resposta = { feriados: Feriado[]; locais: FeriadoLocal[] };

async function ler<T>(resposta: Response, padrao: string) {
  const corpo = (await resposta.json().catch(() => ({}))) as T & { message?: string | string[] };
  if (!resposta.ok) {
    const mensagem = Array.isArray(corpo.message) ? corpo.message[0] : corpo.message;
    throw new Error(mensagem || padrao);
  }
  return corpo;
}

function buscar(ano: number) {
  return fetch(`/api/feriados?year=${ano}`).then((resposta) => ler<Resposta>(resposta, "Não foi possível carregar os feriados."));
}

function avisoDeRedatacao(redatados: number) {
  if (redatados === 0) return "";
  return redatados === 1
    ? " As datas pendentes de 1 lançamento foram ajustadas."
    : ` As datas pendentes de ${redatados} lançamentos foram ajustadas.`;
}

/**
 * Feriados do ano (nacionais, pontos facultativos e os da conta) e o cadastro dos feriados da cidade ou do estado.
 * Fica fora do formulário das preferências: adicionar e remover gravam na hora e reajustam os vencimentos pendentes.
 */
export function FeriadosDaConta({ visivel }: { visivel: boolean }) {
  const toast = useToast();
  const [ano, setAno] = useState(() => new Date().getFullYear());
  const [direcao, setDirecao] = useState(0);
  const [dados, setDados] = useState<Resposta | null>(null);
  const [falhou, setFalhou] = useState(false);
  const [nome, setNome] = useState("");
  const [dia, setDia] = useState(1);
  const [mes, setMes] = useState(1);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!visivel) return;
    let vivo = true;
    buscar(ano)
      .then((resposta) => {
        if (!vivo) return;
        setDados(resposta);
        setFalhou(false);
      })
      .catch(() => {
        if (vivo) setFalhou(true);
      });
    return () => {
      vivo = false;
    };
  }, [ano, visivel]);

  function recarregar() {
    return buscar(ano)
      .then((resposta) => {
        setDados(resposta);
        setFalhou(false);
      })
      .catch(() => setFalhou(true));
  }

  function mudarAno(passo: number) {
    setDirecao(passo);
    setAno((atual) => atual + passo);
  }

  async function adicionar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (enviando) return;
    if (!nome.trim()) {
      toast.erro("Dê um nome ao feriado.");
      return;
    }
    setEnviando(true);
    try {
      const corpo = await ler<{ redatados: number }>(
        await fetch("/api/feriados", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ nome: nome.trim(), dia, mes }),
        }),
        "Não foi possível adicionar o feriado.",
      );
      toast.sucesso(`Feriado adicionado.${avisoDeRedatacao(corpo.redatados)}`);
      setNome("");
      await recarregar();
    } catch (error) {
      toast.erro(error instanceof Error ? error.message : "Não foi possível adicionar o feriado.");
    } finally {
      setEnviando(false);
    }
  }

  async function remover(local: FeriadoLocal) {
    setEnviando(true);
    try {
      const corpo = await ler<{ redatados: number }>(
        await fetch(`/api/feriados/${local.id}`, { method: "DELETE" }),
        "Não foi possível remover o feriado.",
      );
      toast.sucesso(`${local.nome} saiu dos feriados.${avisoDeRedatacao(corpo.redatados)}`);
      await recarregar();
    } catch (error) {
      toast.erro(error instanceof Error ? error.message : "Não foi possível remover o feriado.");
    } finally {
      setEnviando(false);
    }
  }

  const locais = [...(dados?.locais ?? [])].sort((a, b) => a.mes - b.mes || a.dia - b.dia);
  const noLimite = locais.length >= LIMITE_FERIADOS_LOCAIS;

  return (
    <div hidden={!visivel} className="grid min-w-0 gap-6">
      <section className="grid min-w-0 gap-4 rounded-lg border border-line bg-surface p-6" aria-labelledby="titulo-feriados-locais">
        <div className="grid gap-1">
          <h2 id="titulo-feriados-locais" className="font-display text-lg">
            Feriados da sua cidade
          </h2>
          <p className="max-w-prose text-sm text-ink-2">
            Os nacionais já estão no Prumo. Cadastre os da cidade ou do estado: eles repetem todo ano, aparecem na
            agenda e deixam de contar como dia útil nos vencimentos.
          </p>
        </div>

        <form className="grid min-w-0 gap-3 tab:grid-cols-4 tab:items-end" onSubmit={(event) => void adicionar(event)}>
          <div className="grid min-w-0 gap-1 tab:col-span-2">
            <Rotulo htmlFor="feriado-nome" dica="Como o feriado aparece na agenda.">
              Nome
            </Rotulo>
            <input
              id="feriado-nome"
              value={nome}
              maxLength={60}
              placeholder="Aniversário da cidade"
              autoComplete="off"
              className={field}
              onChange={(event) => setNome(event.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3 tab:col-span-2 tab:grid-cols-3">
            <div className="grid min-w-0 gap-1">
              <Rotulo htmlFor="feriado-dia" dica="O dia do mês.">
                Dia
              </Rotulo>
              <select id="feriado-dia" value={dia} className={field} onChange={(event) => setDia(Number(event.target.value))}>
                {Array.from({ length: DIAS_NO_MES[mes - 1] ?? 31 }, (_, indice) => indice + 1).map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid min-w-0 gap-1">
              <Rotulo htmlFor="feriado-mes" dica="O mês do feriado.">
                Mês
              </Rotulo>
              <select
                id="feriado-mes"
                value={mes}
                className={field}
                onChange={(event) => {
                  const escolhido = Number(event.target.value);
                  setMes(escolhido);
                  setDia((atual) => Math.min(atual, DIAS_NO_MES[escolhido - 1] ?? 31));
                }}
              >
                {MESES.map((rotulo, indice) => (
                  <option key={rotulo} value={indice + 1}>
                    {rotulo}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit" variant="primary" className="col-span-2 tab:col-span-1" disabled={enviando || noLimite}>
              Adicionar
            </Button>
          </div>
        </form>
        {noLimite ? (
          <p className="text-sm text-ink-2">Você chegou ao limite de {LIMITE_FERIADOS_LOCAIS} feriados locais.</p>
        ) : null}

        {falhou ? (
          <div className="grid justify-items-start gap-3">
            <p>Não foi possível carregar os feriados.</p>
            <Button onClick={() => void recarregar()}>Tentar de novo</Button>
          </div>
        ) : !dados ? (
          <Carregando texto="Carregando feriados." linhas={2} />
        ) : locais.length === 0 ? (
          <p className="text-sm text-ink-2">Nenhum feriado local cadastrado.</p>
        ) : (
          <ListaAnimada className="overflow-hidden rounded-lg border border-line">
            {locais.map((local) => (
              <ItemAnimado key={local.id} className="flex min-w-0 items-center gap-3 border-b border-line px-4 py-3 last:border-b-0">
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="truncate font-medium">{local.nome}</span>
                  <span className="text-sm text-ink-2">
                    {local.dia} de {MESES[local.mes - 1]?.toLowerCase()}, todo ano
                  </span>
                </div>
                <Button variant="quiet" disabled={enviando} onClick={() => void remover(local)} aria-label={`Remover ${local.nome}`}>
                  Remover
                </Button>
              </ItemAnimado>
            ))}
          </ListaAnimada>
        )}
      </section>

      <section className="grid min-w-0 gap-4 rounded-lg border border-line bg-surface p-6" aria-labelledby="titulo-feriados-ano">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="titulo-feriados-ano" className="font-display text-lg">
            Feriados de {ano}
          </h2>
          <span className="flex items-center gap-1">
            <Button variant="quiet" className="size-10 px-0" aria-label="Ano anterior" onClick={() => mudarAno(-1)}>
              ‹
            </Button>
            <Button variant="quiet" className="size-10 px-0" aria-label="Próximo ano" onClick={() => mudarAno(1)}>
              ›
            </Button>
          </span>
        </div>
        {dados ? (
          <Troca id={String(ano)} direcao={direcao}>
            <ul className="overflow-hidden rounded-lg border border-line">
              {dados.feriados.map((feriado) => (
                <LinhaDoFeriado key={`${feriado.data}-${feriado.nome}`} feriado={feriado} />
              ))}
            </ul>
          </Troca>
        ) : null}
      </section>
    </div>
  );
}

function LinhaDoFeriado({ feriado }: { feriado: Feriado }) {
  const [, mes, dia] = feriado.data.split("-").map(Number);
  const semana = diaDaSemana.format(new Date(`${feriado.data}T12:00:00Z`));
  return (
    <li className="flex min-w-0 items-start gap-3 border-b border-line px-4 py-3 last:border-b-0">
      <time dateTime={feriado.data} className="grid min-w-12 shrink-0 text-sm tabular-nums text-ink-2">
        <span>
          {String(dia).padStart(2, "0")} {NOME_MES[(mes ?? 1) - 1]}
        </span>
        <span className="text-xs">{semana}</span>
      </time>
      {/* No celular o selo desce para baixo do nome em vez de empurrar a linha para fora da tela. */}
      <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <span className="min-w-0 font-medium">{feriado.nome}</span>
        <Chip tone={feriado.tipo === "local" ? "ok" : "default"}>{ROTULO_DO_TIPO_DE_FERIADO[feriado.tipo]}</Chip>
      </div>
    </li>
  );
}
