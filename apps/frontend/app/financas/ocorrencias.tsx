"use client";

import { useState } from "react";
import {
  diaLocal,
  ocorrenciasDoLancamento,
  situacaoDaOcorrencia,
  type Lancamento,
  type Ocorrencia,
  type StatusTransacao,
} from "@finnagent/contracts";
import { Button } from "../../components/ui/button";
import { Chip } from "../../components/ui/chip";
import { List } from "../../components/ui/list";
import { Money } from "../../components/ui/money";
import { useToast } from "../../components/ui/toast";
import { api } from "./api";
import { rotuloDaSituacao, tomDaSituacao } from "./rotulos";

export function OcorrenciasDoLancamento({
  entry,
  onAtualizar,
}: {
  entry: Lancamento;
  onAtualizar: () => Promise<void>;
}) {
  const toast = useToast();
  const [ocupado, setOcupado] = useState<number | null>(null);
  const hoje = diaLocal();
  const lista = ocorrenciasDoLancamento(entry);

  async function enviar(item: Ocorrencia, status: StatusTransacao, sucesso: string) {
    if (ocupado != null) return;
    setOcupado(item.number);
    try {
      await api(`/api/lancamentos/${entry.id}/ocorrencias/${item.number}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
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
      <List className="max-h-96 min-w-0 overflow-x-hidden overflow-y-auto overscroll-contain">
        {lista.map((item) => {
          const situacao = situacaoDaOcorrencia(item, hoje);
          const centavos =
            item.status === "completed" && item.paidCents != null ? item.paidCents : item.plannedCents;
          return (
            <li
              key={item.number}
              className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-line px-4 py-3 last:border-b-0"
            >
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-2">
                <p className="text-sm whitespace-nowrap text-ink">
                  <span className="tabular-nums">{item.number}.</span>{" "}
                  <time dateTime={item.dueDate}>{dataBr(item.dueDate)}</time>
                </p>
                <div className="ml-auto flex shrink-0 items-center gap-3">
                  <Money cents={centavos} />
                  <Chip tone={tomDaSituacao(situacao)} className="shrink-0">
                    {rotuloDaSituacao(situacao)}
                  </Chip>
                </div>
              </div>
              <AcoesDaLinha item={item} ocupado={ocupado != null} onEnviar={enviar} />
            </li>
          );
        })}
      </List>
    </div>
  );
}

function AcoesDaLinha({
  item,
  ocupado,
  onEnviar,
}: {
  item: Ocorrencia;
  ocupado: boolean;
  onEnviar: (item: Ocorrencia, status: StatusTransacao, sucesso: string) => Promise<void>;
}) {
  const grupo = "flex basis-full flex-wrap justify-end gap-2 tab:basis-auto tab:shrink-0";
  if (item.status === "pending") {
    return (
      <div className={grupo}>
        <Button type="button" disabled={ocupado} onClick={() => void onEnviar(item, "completed", "Ocorrência paga.")}>
          Pagar
        </Button>
        <Button
          type="button"
          variant="danger"
          disabled={ocupado}
          onClick={() => void onEnviar(item, "cancelled", "Ocorrência cancelada.")}
        >
          Cancelar
        </Button>
      </div>
    );
  }
  if (item.status === "completed") {
    return (
      <div className={grupo}>
        <Button
          type="button"
          variant="danger"
          disabled={ocupado}
          onClick={() => void onEnviar(item, "refunded", "Ocorrência estornada.")}
        >
          Estornar
        </Button>
      </div>
    );
  }
  if (item.status === "cancelled") {
    return (
      <div className={grupo}>
        <Button
          type="button"
          variant="quiet"
          disabled={ocupado}
          onClick={() => void onEnviar(item, "pending", "Cancelamento desfeito.")}
        >
          Desfazer
        </Button>
      </div>
    );
  }
  return null;
}

function dataBr(iso: string) {
  const [ano, mes, dia] = iso.split("-");
  if (!ano || !mes || !dia) return iso;
  return `${dia}/${mes}/${ano}`;
}
