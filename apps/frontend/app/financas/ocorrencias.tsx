"use client";

import { useEffect, useState } from "react";
import type { LancamentoVista, OcorrenciaVista, StatusTransacao } from "@finnagent/contracts";
import { Button } from "../../components/ui/button";
import { Chip } from "../../components/ui/chip";
import { campo } from "../../components/ui/cn";
import { List } from "../../components/ui/list";
import { Money } from "../../components/ui/money";
import { useToast } from "../../components/ui/toast";
import { api } from "./api";
import { centavosParaReais, reaisParaCentavos } from "./reais";
import { rotuloDaSituacao, tomDaSituacao } from "./rotulos";

const ACAO: Record<
  StatusTransacao,
  { rotulo: string; sucesso: string; variante: "default" | "danger" | "quiet" }
> = {
  completed: { rotulo: "Pagar", sucesso: "Ocorrência paga.", variante: "default" },
  cancelled: { rotulo: "Cancelar", sucesso: "Ocorrência cancelada.", variante: "danger" },
  refunded: { rotulo: "Estornar", sucesso: "Ocorrência estornada.", variante: "danger" },
  pending: { rotulo: "Desfazer", sucesso: "Cancelamento desfeito.", variante: "quiet" },
};

export function OcorrenciasDoLancamento({
  entry,
  foco,
  onAtualizar,
}: {
  entry: LancamentoVista;
  foco?: number | null;
  onAtualizar: () => Promise<void>;
}) {
  const toast = useToast();
  const [ocupado, setOcupado] = useState<number | null>(null);
  const lista = entry.occurrences;

  useEffect(() => {
    if (foco == null) return;
    document.getElementById(`ocorrencia-${entry.id}-${foco}`)?.scrollIntoView({ block: "nearest" });
  }, [entry.id, foco, lista.length]);

  async function enviar(
    item: OcorrenciaVista,
    corpo: { status?: StatusTransacao; dueDate?: string; plannedCents?: number },
    sucesso: string,
  ) {
    if (ocupado != null) return;
    setOcupado(item.number);
    try {
      await api(`/api/lancamentos/${entry.id}/ocorrencias/${item.number}`, {
        method: "PATCH",
        body: JSON.stringify(corpo),
      });
      toast.sucesso(sucesso);
      await onAtualizar();
    } catch (error) {
      toast.erro(error instanceof Error ? error.message : "Não foi possível atualizar a ocorrência.");
    } finally {
      setOcupado(null);
    }
  }

  if (lista.length === 0) return null;

  return (
    <div className="grid min-w-0 gap-3">
      <p className="text-sm font-medium">Ocorrências</p>
      <List className="min-w-0 overflow-x-hidden">
        {lista.map((item) => (
          <li
            id={`ocorrencia-${entry.id}-${item.number}`}
            key={item.number}
            className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-line px-4 py-3 last:border-b-0"
          >
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-2">
              <p className="text-sm whitespace-nowrap text-ink">
                <span className="tabular-nums">{item.number}.</span>
              </p>
              {item.editable ? (
                <CamposPendentes
                  item={item}
                  ocupado={ocupado != null}
                  onGravar={(corpo) => void enviar(item, corpo, "Ocorrência atualizada.")}
                />
              ) : (
                <>
                  <time className="text-sm text-ink" dateTime={item.dueDate}>
                    {dataBr(item.dueDate)}
                  </time>
                  <div className="ml-auto flex shrink-0 items-center gap-3">
                    <Money cents={item.cents} />
                  </div>
                </>
              )}
              <Chip tone={tomDaSituacao(item.situation)} className="shrink-0">
                {rotuloDaSituacao(item.situation)}
              </Chip>
            </div>
            {item.next.length > 0 ? (
              <div className="flex basis-full flex-wrap justify-end gap-2 tab:basis-auto tab:shrink-0">
                {item.next.map((status) => (
                  <Button
                    key={status}
                    type="button"
                    variant={ACAO[status].variante}
                    disabled={ocupado != null}
                    onClick={() => void enviar(item, { status }, ACAO[status].sucesso)}
                  >
                    {ACAO[status].rotulo}
                  </Button>
                ))}
              </div>
            ) : null}
          </li>
        ))}
      </List>
    </div>
  );
}

function CamposPendentes({
  item,
  ocupado,
  onGravar,
}: {
  item: OcorrenciaVista;
  ocupado: boolean;
  onGravar: (corpo: { dueDate?: string; plannedCents?: number }) => void;
}) {
  const [data, setData] = useState(item.dueDate);
  const [valor, setValor] = useState(centavosParaReais(Math.abs(item.plannedCents)));

  function gravarData() {
    if (/^\d{4}-\d{2}-\d{2}$/.test(data) && data !== item.dueDate) onGravar({ dueDate: data });
  }

  function gravarValor() {
    const centavos = reaisParaCentavos(valor.replace(/^[-−]/, ""));
    if (centavos == null || centavos === Math.abs(item.plannedCents)) return;
    onGravar({ plannedCents: centavos });
  }

  return (
    <>
      <input
        type="date"
        aria-label={`Data da ocorrência ${item.number}`}
        value={data}
        disabled={ocupado}
        onChange={(event) => setData(event.target.value)}
        onBlur={gravarData}
        className={campo}
      />
      <input
        aria-label={`Valor da ocorrência ${item.number}`}
        value={valor}
        inputMode="decimal"
        disabled={ocupado}
        onChange={(event) => setValor(event.target.value)}
        onBlur={gravarValor}
        className={`${campo} min-w-0 flex-1 text-right`}
      />
    </>
  );
}

function dataBr(iso: string) {
  const [ano, mes, dia] = iso.split("-");
  if (!ano || !mes || !dia) return iso;
  return `${dia}/${mes}/${ano}`;
}
