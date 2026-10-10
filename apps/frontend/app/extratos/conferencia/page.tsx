"use client";

import { useEffect, useState } from "react";
import type { ConferenciaResposta, LinhaConferencia } from "@finnagent/contracts";
import { Button } from "../../../components/ui/button";
import { Chip } from "../../../components/ui/chip";
import { Money } from "../../../components/ui/money";
import { PageHeader } from "../../../components/ui/page-header";
import { PendingAction } from "../../../components/ui/pending-action";
import { useToast } from "../../../components/ui/toast";

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

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
  });
  const body = (await response.json().catch(() => ({}))) as { message?: string | string[] };
  if (!response.ok) {
    const message = Array.isArray(body.message) ? body.message[0] : body.message;
    throw new Error(message || "O backend não respondeu.");
  }
  return body as T;
}

function dia(iso: string) {
  const [ano, mes, data] = iso.split("-");
  return `${data}/${mes}/${ano}`;
}

function textoDoVinculo(vinculo: NonNullable<LinhaConferencia["link"]>) {
  return `${vinculo.description} · ${vinculo.groupName} / ${vinculo.sessionName}`;
}

export default function Conferencia() {
  const toast = useToast();
  const hoje = new Date();
  const [year, setYear] = useState(hoje.getFullYear());
  const [month, setMonth] = useState(hoje.getMonth() + 1);
  const [dados, setDados] = useState<ConferenciaResposta | null>(null);
  const [falha, setFalha] = useState("");
  const [ocupado, setOcupado] = useState("");
  const pedido = `${year}-${month}`;

  function carregar(alvoAno: number, alvoMes: number) {
    setDados(null);
    setFalha("");
    return api<ConferenciaResposta>(`/api/extratos/conferencia?year=${alvoAno}&month=${alvoMes}`)
      .then((resposta) => {
        setDados(resposta);
      })
      .catch((error: Error) => {
        setFalha(`${alvoAno}-${alvoMes}`);
        toast.erro(error.message);
      });
  }

  useEffect(() => {
    let ativo = true;
    api<ConferenciaResposta>(`/api/extratos/conferencia?year=${year}&month=${month}`)
      .then((resposta) => {
        if (!ativo) return;
        setDados(resposta);
        setFalha("");
      })
      .catch((error: Error) => {
        if (!ativo) return;
        setFalha(pedido);
        toast.erro(error.message);
      });
    return () => {
      ativo = false;
    };
  }, [pedido, year, month, toast]);

  function mudar(delta: number) {
    const data = new Date(year, month - 1 + delta, 1);
    setYear(data.getFullYear());
    setMonth(data.getMonth() + 1);
  }

  async function confirmar(linha: LinhaConferencia) {
    const chave = `${linha.statementId}:${linha.line}`;
    setOcupado(chave);
    try {
      await api("/api/extratos/cruzamentos", {
        method: "POST",
        body: JSON.stringify({ statementId: linha.statementId, line: linha.line }),
      });
      toast.sucesso("Cruzamento confirmado.");
      await carregar(year, month);
    } catch (error) {
      toast.erro(error instanceof Error ? error.message : "Não foi possível confirmar o cruzamento.");
    } finally {
      setOcupado("");
    }
  }

  const falhou = falha === pedido;
  const linhas = dados?.lines ?? [];
  const propostas = linhas.filter((linha) => linha.suggestion);

  return (
    <>
      <PageHeader
        title="Conferência"
        subtitle="As linhas lidas aparecem aqui. A IA propõe o lançamento com o mesmo valor e o dia mais próximo, e você confirma."
        actions={
          <div className="flex items-center gap-1 font-display text-lg font-bold">
            <Button variant="quiet" className="min-w-10 px-0" aria-label="Mês anterior" onClick={() => mudar(-1)}>
              ‹
            </Button>
            <span>
              {meses[month - 1]} de {year}
            </span>
            <Button variant="quiet" className="min-w-10 px-0" aria-label="Próximo mês" onClick={() => mudar(1)}>
              ›
            </Button>
          </div>
        }
      />
      {!dados && !falhou ? <p className="text-sm text-ink-2">Carregando conferência.</p> : null}
      {dados ? (
        <div className="grid items-start gap-6 desk:grid-cols-[minmax(0,1fr)_340px]">
          <ul className="min-w-0 overflow-hidden rounded-lg border border-line bg-surface">
            {linhas.length ? (
              linhas.map((linha) => (
                <li key={`${linha.statementId}-${linha.line}`} className="grid gap-3 border-b border-line p-4 last:border-b-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{linha.description || "—"}</span>
                    <Money cents={linha.cents} strong />
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-ink-2">
                    <span>{dia(linha.date)}</span>
                    <span>{linha.accountName}</span>
                    <span>{linha.filename}</span>
                  </div>
                  {linha.link ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <Chip tone="ok">Cruzado</Chip>
                      <span className="text-sm">{textoDoVinculo(linha.link)}</span>
                    </div>
                  ) : linha.suggestion ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <Chip tone="ai">Proposta</Chip>
                      <span className="text-sm">{textoDoVinculo(linha.suggestion)}</span>
                    </div>
                  ) : (
                    <Chip>Sem par</Chip>
                  )}
                </li>
              ))
            ) : (
              <li className="px-6 py-6 text-center text-ink-2">
                Nenhuma linha lida neste mês. Importe um extrato em Importações.
              </li>
            )}
          </ul>
          <aside aria-label="IA" className="grid min-w-0 gap-4 rounded-lg border border-line bg-surface p-6">
            <h2 className="font-display text-lg">IA</h2>
            <p className="max-w-prose text-sm text-ink-2">
              A proposta usa o valor e o dia do lançamento. Confirme para gravar o cruzamento.
            </p>
            {propostas.length ? (
              <ul className="grid gap-4">
                {propostas.map((linha) => (
                  <li key={`${linha.statementId}-${linha.line}`} className="min-w-0">
                    <PendingAction title={linha.description || "—"}>
                      <p className="text-sm text-ink-2">{linha.suggestion ? textoDoVinculo(linha.suggestion) : ""}</p>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="primary"
                          disabled={ocupado === `${linha.statementId}:${linha.line}`}
                          onClick={() => void confirmar(linha)}
                        >
                          Confirmar
                        </Button>
                      </div>
                    </PendingAction>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-2">Nenhuma proposta neste mês.</p>
            )}
          </aside>
        </div>
      ) : null}
    </>
  );
}
