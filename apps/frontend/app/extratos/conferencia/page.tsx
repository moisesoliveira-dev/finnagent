"use client";

import { useEffect, useState } from "react";
import type { ConferenciaResposta, GruposResposta, LinhaConferencia } from "@finnagent/contracts";
import { Button } from "../../../components/ui/button";
import { Chip } from "../../../components/ui/chip";
import { campo, cn } from "../../../components/ui/cn";
import { Money } from "../../../components/ui/money";
import { Troca } from "../../../components/ui/movimento";
import { PageHeader } from "../../../components/ui/page-header";
import { PendingAction } from "../../../components/ui/pending-action";
import { useToast } from "../../../components/ui/toast";

const field = campo;
const POR_PAGINA = 20;

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
  const [deslize, setDeslize] = useState(0);
  const [dados, setDados] = useState<ConferenciaResposta | null>(null);
  const [falha, setFalha] = useState("");
  const [ocupado, setOcupado] = useState("");
  const [sessoes, setSessoes] = useState<Array<{ id: string; rotulo: string }>>([]);
  const [escolha, setEscolha] = useState<Record<string, string>>({});
  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(1);
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

  useEffect(() => {
    let ativo = true;
    api<GruposResposta>("/api/grupos")
      .then((resposta) => {
        if (!ativo) return;
        const nomes = new Map(resposta.groups.map((grupo) => [grupo.id, grupo.name]));
        setSessoes(
          resposta.sessions
            .filter((sessao) => !sessao.endedAt)
            .map((sessao) => ({
              id: sessao.id,
              rotulo: `${nomes.get(sessao.groupId) ?? "Grupo"} / ${sessao.name}`,
            })),
        );
      })
      .catch(() => {
        if (ativo) setSessoes([]);
      });
    return () => {
      ativo = false;
    };
  }, []);

  function mudar(delta: number) {
    setDeslize(delta > 0 ? 1 : -1);
    setPagina(1);
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

  async function acumular(linha: LinhaConferencia) {
    const chave = `${linha.statementId}:${linha.line}`;
    const sessionId = escolha[chave];
    if (!sessionId) {
      toast.erro("Escolha a sessão para acumular.");
      return;
    }
    setOcupado(chave);
    try {
      await api("/api/extratos/acumular", {
        method: "POST",
        body: JSON.stringify({ statementId: linha.statementId, line: linha.line, sessionId }),
      });
      toast.sucesso("Linha acumulada. O mesmo nome entra direto nessa sessão.");
      await carregar(year, month);
    } catch (error) {
      toast.erro(error instanceof Error ? error.message : "Não foi possível acumular a linha.");
    } finally {
      setOcupado("");
    }
  }

  const falhou = falha === pedido;
  const linhas = dados?.lines ?? [];
  const termo = busca.trim().toLowerCase();
  const filtradas = linhas.filter((linha) => {
    if (!termo) return true;
    return [linha.description, linha.accountName, linha.filename].some((valor) => valor.toLowerCase().includes(termo));
  });
  const paginas = Math.max(1, Math.ceil(filtradas.length / POR_PAGINA));
  const paginaAtual = Math.min(pagina, paginas);
  const inicio = filtradas.length === 0 ? 0 : (paginaAtual - 1) * POR_PAGINA;
  const visiveis = filtradas.slice(inicio, inicio + POR_PAGINA);
  const propostas = visiveis.filter((linha) => linha.suggestion);

  return (
    <>
      <PageHeader
        title="Conferência"
        subtitle="Cada linha sem par entra numa sessão. O mesmo nome do extrato volta para essa sessão."
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
      <Troca id={`${year}-${month}`} direcao={deslize} className="min-w-0">
      {!dados && !falhou ? <p className="text-sm text-ink-2">Carregando conferência.</p> : null}
      {dados ? (
        <div className="grid items-start gap-6 desk:grid-cols-[minmax(0,1fr)_auto]">
          <div className="grid min-w-0 gap-4">
          <input
            className={cn(field, "w-full")}
            type="search"
            placeholder="Buscar por nome, conta ou arquivo"
            aria-label="Buscar"
            value={busca}
            onChange={(event) => {
              setBusca(event.target.value);
              setPagina(1);
            }}
          />
          <ul className="min-w-0 overflow-hidden rounded-lg border border-line bg-surface">
            {visiveis.length ? (
              visiveis.map((linha) => (
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
                  ) : (
                    <div className="grid gap-2">
                      {linha.suggestion ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <Chip tone="ai">Proposta</Chip>
                          <span className="text-sm">{textoDoVinculo(linha.suggestion)}</span>
                        </div>
                      ) : (
                        <Chip>Sem par</Chip>
                      )}
                      {sessoes.length ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <select
                            className={cn(field, "w-full min-w-0 flex-1 tab:w-auto")}
                            aria-label={`Sessão para ${linha.description || "a linha"}`}
                            value={escolha[`${linha.statementId}:${linha.line}`] ?? ""}
                            onChange={(event) =>
                              setEscolha((atual) => ({
                                ...atual,
                                [`${linha.statementId}:${linha.line}`]: event.target.value,
                              }))
                            }
                          >
                            <option value="">Escolha a sessão</option>
                            {sessoes.map((sessao) => (
                              <option key={sessao.id} value={sessao.id}>
                                {sessao.rotulo}
                              </option>
                            ))}
                          </select>
                          <Button
                            variant="default"
                            disabled={ocupado === `${linha.statementId}:${linha.line}`}
                            onClick={() => void acumular(linha)}
                          >
                            Acumular
                          </Button>
                        </div>
                      ) : (
                        <p className="text-sm text-ink-2">Crie uma sessão em Grupos para acumular esta linha.</p>
                      )}
                    </div>
                  )}
                </li>
              ))
            ) : (
              <li className="px-6 py-6 text-center text-ink-2">
                {linhas.length
                  ? "Nenhuma linha com essa busca."
                  : "Nenhuma linha lida neste mês. Importe um extrato em Importações."}
              </li>
            )}
          </ul>
          {filtradas.length > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-ink-2">
                {inicio + 1}–{inicio + visiveis.length} de {filtradas.length}
              </p>
              <div className="flex gap-2">
                <Button variant="quiet" disabled={paginaAtual <= 1} onClick={() => setPagina(paginaAtual - 1)}>
                  Anterior
                </Button>
                <Button variant="quiet" disabled={paginaAtual >= paginas} onClick={() => setPagina(paginaAtual + 1)}>
                  Próxima
                </Button>
              </div>
            </div>
          ) : null}
          </div>
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
                          variant="default"
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
      </Troca>
    </>
  );
}
