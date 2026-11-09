"use client";

import Link from "next/link";
import { useState } from "react";
import type { Caixinha, ContasResposta, Meta } from "@finnagent/contracts";
import { Button } from "../../components/ui/button";
import { campo, cn, focusRing } from "../../components/ui/cn";
import { Dialogo } from "../../components/ui/dialogo";
import { formatarReais } from "../../components/ui/money";
import { Rotulo } from "../../components/ui/rotulo";
import { useToast } from "../../components/ui/toast";
import { api } from "../financas/api";

type Opcao = Caixinha & { accountName: string };

/**
 * A caixinha em que a meta guarda o dinheiro. Ligada, o saldo dela soma no guardado e o que a meta separa vira
 * aplicação nela. A escolha abre um diálogo com as caixinhas das contas.
 */
export function CaixinhaDaMeta({ meta, onMudou }: { meta: Meta; onMudou: () => Promise<unknown> }) {
  const toast = useToast();
  const [opcoes, setOpcoes] = useState<Opcao[] | null>(null);
  const [aberto, setAberto] = useState(false);
  const [escolha, setEscolha] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function abrir() {
    setEscolha(meta.box?.id ?? "");
    setAberto(true);
    try {
      const resposta = await api<ContasResposta>("/api/contas");
      const nomes = new Map(resposta.accounts.map((conta) => [conta.id, conta.name]));
      // A caixinha que já guarda outra meta não aparece: cada caixinha guarda uma meta só.
      setOpcoes(
        resposta.boxes
          .filter((item) => !item.goalId || item.goalId === meta.id)
          .map((item) => ({ ...item, accountName: nomes.get(item.accountId) ?? "" })),
      );
    } catch (error) {
      toast.erro(error instanceof Error ? error.message : "Não foi possível ler as caixinhas.");
      setOpcoes([]);
    }
  }

  async function salvar(event: React.FormEvent) {
    event.preventDefault();
    if (salvando) return;
    setSalvando(true);
    try {
      await api(`/api/metas/${meta.id}/caixinha`, { method: "PUT", body: JSON.stringify({ boxId: escolha || null }) });
      toast.sucesso(escolha ? "A meta passa a guardar na caixinha." : "A meta saiu da caixinha.");
      setAberto(false);
      await onMudou();
    } catch (error) {
      toast.erro(error instanceof Error ? error.message : "Não foi possível ligar a caixinha.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <>
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 text-sm">
        {meta.box ? (
          <span className="min-w-0 text-ink-2">
            Guarda na caixinha <span className="font-medium text-ink">{meta.box.name}</span>
            {meta.box.accountName ? ` · ${meta.box.accountName}` : ""} · {formatarReais(meta.box.saldoCents)}
          </span>
        ) : (
          <span className="text-ink-2">Sem caixinha</span>
        )}
        <Button variant="quiet" onClick={() => void abrir()}>
          {meta.box ? "Trocar caixinha" : "Guardar numa caixinha"}
        </Button>
      </div>
      <Dialogo aberto={aberto} aria-labelledby={`titulo-caixinha-${meta.id}`} onClose={() => setAberto(false)}>
        <form onSubmit={(event) => void salvar(event)}>
          <div className="dialog-corpo grid gap-4">
            <h2 id={`titulo-caixinha-${meta.id}`} className="font-display text-lg">
              Caixinha da meta {meta.name}
            </h2>
            <p className="text-sm text-ink-2">
              O saldo da caixinha soma no guardado da meta. O que você separar ou aprovar para a meta vira uma aplicação nela: sai da conta e da sobra do mês.
            </p>
            {opcoes === null ? (
              <p className="text-sm text-ink-2">Carregando as caixinhas.</p>
            ) : opcoes.length === 0 && !meta.box ? (
              <p className="text-sm">
                Nenhuma caixinha livre.{" "}
                <Link href="/contas" className={cn("text-brand underline", focusRing)}>
                  Crie uma em Contas
                </Link>
                .
              </p>
            ) : (
              <div className="grid gap-1">
                <Rotulo htmlFor={`meta-caixinha-${meta.id}`} dica="As caixinhas das suas contas que ainda não guardam outra meta.">
                  Caixinha
                </Rotulo>
                <select
                  id={`meta-caixinha-${meta.id}`}
                  className={cn(campo, "w-full")}
                  value={escolha}
                  onChange={(event) => setEscolha(event.target.value)}
                >
                  <option value="">Sem caixinha</option>
                  {opcoes.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                      {item.accountName ? ` · ${item.accountName}` : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div className="dialog-acoes">
            <Button type="button" variant="quiet" onClick={() => setAberto(false)} disabled={salvando}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" disabled={salvando || opcoes === null}>
              Salvar
            </Button>
          </div>
        </form>
      </Dialogo>
    </>
  );
}
