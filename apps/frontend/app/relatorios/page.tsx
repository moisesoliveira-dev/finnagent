"use client";

import { useEffect, useState } from "react";
import { type RelatorioResposta, type TipoLancamento } from "@finnagent/contracts";
import { doisDigitos } from "../financas/reais";
import { Button } from "../../components/ui/button";
import { Carregando } from "../../components/ui/esqueleto";
import { Chip } from "../../components/ui/chip";
import { List } from "../../components/ui/list";
import { ListRow } from "../../components/ui/list-row";
import { Money } from "../../components/ui/money";
import { Troca } from "../../components/ui/movimento";
import { PageHeader } from "../../components/ui/page-header";
import { Stat } from "../../components/ui/stat";
import { Vazio } from "../../components/ui/vazio";
import { useToast } from "../../components/ui/toast";

const celula = "border-b border-line px-3 py-3";

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

const TIPO: Record<TipoLancamento, string> = {
  adicional: "Adicional",
  parcela: "Parcela",
  empréstimo: "Empréstimo",
  fixo: "Fixo",
  variável: "Variável",
};

async function api<T>(path: string): Promise<T> {
  const response = await fetch(path, { headers: { "content-type": "application/json" } });
  const body = (await response.json().catch(() => ({}))) as { message?: string | string[] };
  if (!response.ok) {
    const message = Array.isArray(body.message) ? body.message[0] : body.message;
    throw new Error(message || "O backend não respondeu.");
  }
  return body as T;
}

function parteDasSaidas(saidas: number, total: number) {
  if (saidas >= 0 || total >= 0) return 0;
  return Math.round((saidas / total) * 100);
}

export default function RelatoriosPage() {
  const toast = useToast();
  const [dados, setDados] = useState<RelatorioResposta | null>(null);
  const [deslize, setDeslize] = useState(0);
  const [falhou, setFalhou] = useState(false);
  const [carregando, setCarregando] = useState(true);

  function carregar(year?: number) {
    setCarregando(true);
    setFalhou(false);
    const path = year ? `/api/relatorios?year=${year}` : "/api/relatorios";
    return api<RelatorioResposta>(path)
      .then((resposta) => {
        setDados(resposta);
        setFalhou(false);
      })
      .catch((error: Error) => {
        setFalhou(true);
        toast.erro(error.message);
      })
      .finally(() => setCarregando(false));
  }

  useEffect(() => {
    let ativo = true;
    api<RelatorioResposta>("/api/relatorios")
      .then((resposta) => {
        if (!ativo) return;
        setDados(resposta);
      })
      .catch((error: Error) => {
        if (!ativo) return;
        setFalhou(true);
        toast.erro(error.message);
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, [toast]);

  return (
    <>
      <PageHeader
        title="Relatórios"
        subtitle="Veja para onde foi o dinheiro do ano."
      />
      {!dados && carregando && !falhou ? (
        <Carregando texto="Carregando relatório." titulo linhas={4} />
      ) : null}
      {dados ? (
        <div className="grid min-w-0 gap-8">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
            <div className="flex items-center gap-1 font-semibold">
              <Button
                variant="quiet"
                className="size-10 px-0 disabled:opacity-60"
                aria-label="Ano anterior"
                disabled={carregando || dados.year <= dados.workflow.year}
                onClick={() => {
                  setDeslize(-1);
                  void carregar(dados.year - 1);
                }}
              >
                ‹
              </Button>
              <span>{dados.year}</span>
              <Button
                variant="quiet"
                className="size-10 px-0"
                aria-label="Próximo ano"
                disabled={carregando}
                onClick={() => {
                  setDeslize(1);
                  void carregar(dados.year + 1);
                }}
              >
                ›
              </Button>
            </div>
            <Chip>
              A partir de {doisDigitos(dados.workflow.day)}/{doisDigitos(dados.workflow.month)}
            </Chip>
          </div>

          <Troca id={String(dados.year)} direcao={deslize} className="grid min-w-0 gap-8">
          <dl className="flex min-w-0 flex-wrap gap-x-8 gap-y-4 border-y border-line py-4" aria-label="Totais do ano">
            <Stat label="Entradas">
              <Money cents={dados.entradas} strong />
            </Stat>
            <Stat label="Saídas">
              <Money cents={dados.saidas} strong />
            </Stat>
            <Stat label="Sobra">
              <Money cents={dados.sobra} strong />
            </Stat>
          </dl>

          <section className="grid min-w-0 gap-3">
            <h2 className="font-display text-lg">Por mês</h2>
            <div className="min-w-0 overflow-x-auto rounded-lg border border-line bg-surface">
              <table className="w-full border-separate border-spacing-0 text-sm">
                <caption className="sr-only">Meses do relatório</caption>
                <thead>
                  <tr>
                    <th scope="col" className={`${celula} text-left etiqueta text-ink-2`}>
                      Mês
                    </th>
                    <th scope="col" className={`${celula} text-right etiqueta text-ink-2`}>
                      Entradas
                    </th>
                    <th scope="col" className={`${celula} text-right etiqueta text-ink-2`}>
                      Saídas
                    </th>
                    <th scope="col" className={`${celula} text-right etiqueta text-ink-2`}>
                      Sobra
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {dados.months.map((mes) => (
                    <tr key={mes.month} className="last:[&>*]:border-b-0">
                      <th scope="row" className={`${celula} text-left font-medium whitespace-nowrap`}>
                        {MESES[mes.month - 1]}
                      </th>
                      <td className={`${celula} text-right whitespace-nowrap`}>
                        <Money cents={mes.entradas} />
                      </td>
                      <td className={`${celula} text-right whitespace-nowrap`}>
                        <Money cents={mes.saidas} />
                      </td>
                      <td className={`${celula} text-right whitespace-nowrap`}>
                        <Money cents={mes.sobra} strong />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="grid min-w-0 gap-3">
            <h2 className="font-display text-lg">Por grupo</h2>
            {dados.groups.length === 0 ? (
              <Vazio>Nenhum lançamento neste ano.</Vazio>
            ) : (
              <ul className="grid gap-4">
                {dados.groups.map((grupo) => {
                  const parte = parteDasSaidas(grupo.saidas, dados.saidas);
                  return (
                    <li
                      key={grupo.groupId}
                      className="grid min-w-0 gap-3 rounded-lg border border-line bg-surface p-4"
                    >
                      <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-3">
                        <h3 className="min-w-0 font-semibold wrap-break-word">{grupo.name}</h3>
                        <Money cents={grupo.sobra} strong />
                      </div>
                      <p className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1 text-sm text-ink-2">
                        <span>
                          Entradas <Money cents={grupo.entradas} />
                        </span>
                        <span aria-hidden>·</span>
                        <span>
                          Saídas <Money cents={grupo.saidas} />
                        </span>
                      </p>
                      {parte > 0 ? (
                        <>
                          <div className="h-2 overflow-hidden rounded-sm bg-brand-soft" aria-hidden>
                            <div className="h-full bg-neg" style={{ width: `${parte}%` }} />
                          </div>
                          <p className="text-sm text-ink-2">{parte}% das saídas</p>
                        </>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {dados.types.length > 0 ? (
            <section className="grid min-w-0 gap-3">
              <h2 className="font-display text-lg">Por tipo</h2>
              <List>
                {dados.types.map((tipo) => (
                  <ListRow
                    key={tipo.type}
                    title={TIPO[tipo.type]}
                    value={<Money cents={tipo.sobra} strong />}
                  />
                ))}
              </List>
            </section>
          ) : null}
          </Troca>
        </div>
      ) : null}
    </>
  );
}
