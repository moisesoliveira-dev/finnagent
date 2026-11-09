"use client";

import { useState } from "react";
import {
  NOME_MES,
  ROTULO_DO_MOVIMENTO_DA_CAIXINHA,
  resumoDaCaixinha,
  type Caixinha,
  type Conta,
  type LancamentoVista,
  type Meta,
  type MovimentoDaCaixinha,
} from "@finnagent/contracts";
import { Button } from "../../components/ui/button";
import { Chip } from "../../components/ui/chip";
import { caixaDeMarcar, campo, cn } from "../../components/ui/cn";
import { Dialogo } from "../../components/ui/dialogo";
import { List } from "../../components/ui/list";
import { Money } from "../../components/ui/money";
import { Rotulo } from "../../components/ui/rotulo";
import { useToast } from "../../components/ui/toast";
import { api } from "../financas/api";
import { CampoValor } from "../financas/campo-valor";
import { centavosParaReais, reaisParaCentavos } from "../financas/reais";

const field = cn(campo, "w-full");

type Pedido = { conta: Conta; caixinha: Caixinha | null };
type Movimento = { caixinha: Caixinha; tipo: MovimentoDaCaixinha };

/**
 * As caixinhas (depósitos) da conta: o saldo de cada uma, o que rendeu no mês da tela e os botões para lançar o
 * rendimento, aplicar e resgatar. Cada caixinha tem uma sessão no grupo Caixinhas, onde esses lançamentos ficam.
 */
export function SecaoDeCaixinhas({
  conta,
  caixinhas,
  entries,
  metas,
  hoje,
  mes,
  onMudou,
}: {
  conta: Conta;
  caixinhas: Caixinha[];
  entries: LancamentoVista[];
  metas: Meta[];
  hoje: string;
  mes: { year: number; month: number };
  onMudou: () => Promise<void>;
}) {
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [movimento, setMovimento] = useState<Movimento | null>(null);
  const daConta = caixinhas.filter((item) => item.accountId === conta.id);
  const chaveDoMes = `${mes.year}-${String(mes.month).padStart(2, "0")}`;
  const nomeDaMeta = (id: string | null) => (id ? metas.find((meta) => meta.id === id)?.name : undefined);

  if (conta.kind === "cartao") return null;
  return (
    <div className="grid min-w-0 gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="etiqueta text-ink-2">Caixinhas desta conta</h3>
        <Button variant="quiet" onClick={() => setPedido({ conta, caixinha: null })}>
          Nova caixinha
        </Button>
      </div>
      {daConta.length === 0 ? (
        <p className="text-sm text-ink-2">
          Nenhuma caixinha. Crie uma para cada depósito ou reserva: ela ganha uma sessão no grupo Caixinhas para você lançar o quanto rendeu no mês.
        </p>
      ) : (
        <List>
          {daConta.map((caixinha) => {
            const resumo = resumoDaCaixinha(caixinha, entries, hoje, chaveDoMes);
            const meta = nomeDaMeta(caixinha.goalId);
            return (
              <li key={caixinha.id} className="grid min-w-0 gap-3 border-b border-line px-4 py-3 last:border-b-0">
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <span className="grid min-w-0 gap-1">
                    <span className="flex min-w-0 flex-wrap items-center gap-2">
                      <span className="truncate font-medium">{caixinha.name}</span>
                      {meta ? <Chip tone="ok">Para {meta}</Chip> : null}
                    </span>
                    <span className="text-sm text-ink-2">
                      Rendeu em {NOME_MES[mes.month - 1]} {<Money cents={resumo.rendimentoDoMesCents} />} · no total {<Money cents={resumo.rendimentoTotalCents} />}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    <Money cents={resumo.saldoCents} strong />
                    <span className="text-xs text-ink-2">saldo hoje</span>
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="default" onClick={() => setMovimento({ caixinha, tipo: "rendimento" })}>
                    Lançar rendimento
                  </Button>
                  <Button variant="quiet" onClick={() => setMovimento({ caixinha, tipo: "aplicacao" })}>
                    Aplicar
                  </Button>
                  <Button variant="quiet" onClick={() => setMovimento({ caixinha, tipo: "resgate" })}>
                    Resgatar
                  </Button>
                  <Button variant="quiet" onClick={() => setPedido({ conta, caixinha })}>
                    Editar
                  </Button>
                </div>
              </li>
            );
          })}
        </List>
      )}

      <Dialogo aberto={pedido !== null} aria-labelledby="titulo-caixinha" onClose={() => setPedido(null)}>
        {pedido ? (
          <CorpoDaCaixinha
            key={pedido.caixinha?.id ?? "nova"}
            pedido={pedido}
            metas={metas}
            caixinhas={caixinhas}
            onFechar={() => setPedido(null)}
            onSalvo={onMudou}
          />
        ) : null}
      </Dialogo>
      <Dialogo aberto={movimento !== null} aria-labelledby="titulo-movimento" onClose={() => setMovimento(null)}>
        {movimento ? (
          <CorpoDoMovimento
            key={`${movimento.caixinha.id}-${movimento.tipo}`}
            movimento={movimento}
            conta={conta}
            meta={nomeDaMeta(movimento.caixinha.goalId)}
            hoje={hoje}
            onFechar={() => setMovimento(null)}
            onSalvo={onMudou}
          />
        ) : null}
      </Dialogo>
    </div>
  );
}

function CorpoDaCaixinha({
  pedido,
  metas,
  caixinhas,
  onFechar,
  onSalvo,
}: {
  pedido: Pedido;
  metas: Meta[];
  caixinhas: Caixinha[];
  onFechar: () => void;
  onSalvo: () => Promise<void>;
}) {
  const toast = useToast();
  const atual = pedido.caixinha;
  const [name, setName] = useState(atual?.name ?? "");
  const [opening, setOpening] = useState(atual ? centavosParaReais(atual.openingCents) : "");
  const [goalId, setGoalId] = useState(atual?.goalId ?? "");
  const [salvando, setSalvando] = useState(false);
  const [excluir, setExcluir] = useState(false);
  // A meta que já guarda em outra caixinha não aparece: cada meta guarda numa só.
  const livres = metas.filter((meta) => meta.id === atual?.goalId || !caixinhas.some((item) => item.goalId === meta.id));

  async function salvar(event: React.FormEvent) {
    event.preventDefault();
    if (salvando) return;
    const openingCents = opening.trim() ? reaisParaCentavos(opening) : 0;
    if (openingCents == null || openingCents < 0) {
      toast.erro("Informe o saldo inicial da caixinha.");
      return;
    }
    setSalvando(true);
    try {
      const corpo = { name: name.trim(), openingCents, goalId: goalId || null };
      if (atual) await api(`/api/caixinhas/${atual.id}`, { method: "PATCH", body: JSON.stringify(corpo) });
      else await api(`/api/contas/${pedido.conta.id}/caixinhas`, { method: "POST", body: JSON.stringify({ id: crypto.randomUUID(), ...corpo }) });
      toast.sucesso(atual ? "Caixinha atualizada." : "Caixinha criada, com a sessão dela no grupo Caixinhas.");
      onFechar();
      await onSalvo();
    } catch (error) {
      toast.erro(error instanceof Error ? error.message : "Não foi possível salvar a caixinha.");
    } finally {
      setSalvando(false);
    }
  }

  async function apagar() {
    if (!atual || salvando) return;
    setSalvando(true);
    try {
      await api(`/api/caixinhas/${atual.id}`, { method: "DELETE" });
      toast.sucesso(`Caixinha ${atual.name} excluída. Os lançamentos dela ficam no grupo Caixinhas.`);
      onFechar();
      await onSalvo();
    } catch (error) {
      toast.erro(error instanceof Error ? error.message : "Não foi possível excluir a caixinha.");
    } finally {
      setSalvando(false);
    }
  }

  if (excluir && atual) {
    return (
      <>
        <div className="dialog-corpo grid gap-4">
          <h2 id="titulo-caixinha" className="font-display text-lg">
            Excluir a caixinha {atual.name}?
          </h2>
          <p>O rendimento, as aplicações e os resgates já lançados continuam na sessão dela, no grupo Caixinhas. Não pode ser desfeito.</p>
        </div>
        <div className="dialog-acoes">
          <Button variant="quiet" onClick={() => setExcluir(false)} disabled={salvando}>
            Voltar
          </Button>
          <Button variant="danger" disabled={salvando} onClick={() => void apagar()}>
            Excluir caixinha
          </Button>
        </div>
      </>
    );
  }

  return (
    <form onSubmit={(event) => void salvar(event)}>
      <div className="dialog-corpo grid gap-4">
        <h2 id="titulo-caixinha" className="font-display text-lg">
          {atual ? "Editar caixinha" : `Nova caixinha em ${pedido.conta.name}`}
        </h2>
        <div className="grid gap-1">
          <Rotulo htmlFor="caixinha-nome" dica="Como você chama este depósito: Reserva, CDB, Viagem.">
            Nome
          </Rotulo>
          <input id="caixinha-nome" className={field} required maxLength={60} value={name} onChange={(event) => setName(event.target.value)} />
        </div>
        <div className="dialog-par">
          <div className="grid gap-1">
            <Rotulo htmlFor="caixinha-saldo" dica="Quanto já está guardado nela hoje. O que você aplicar, resgatar e render daqui para frente soma a isso.">
              Saldo inicial
            </Rotulo>
            <CampoValor id="caixinha-saldo" className={field} value={opening} onChange={setOpening} />
          </div>
          <div className="grid gap-1">
            <Rotulo htmlFor="caixinha-meta" dica="Com meta, o saldo da caixinha soma no guardado da meta, e o que a meta separa vira aplicação aqui.">
              Meta
            </Rotulo>
            <select id="caixinha-meta" className={field} value={goalId} onChange={(event) => setGoalId(event.target.value)}>
              <option value="">Sem meta</option>
              {livres.map((meta) => (
                <option key={meta.id} value={meta.id}>
                  {meta.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
      <div className="dialog-acoes">
        {atual ? (
          <Button type="button" variant="quiet" className="mr-auto" onClick={() => setExcluir(true)} disabled={salvando}>
            Excluir
          </Button>
        ) : null}
        <Button type="button" variant="quiet" onClick={onFechar} disabled={salvando}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" disabled={salvando}>
          {atual ? "Salvar caixinha" : "Criar caixinha"}
        </Button>
      </div>
    </form>
  );
}

const EXPLICACAO: Record<MovimentoDaCaixinha, (conta: string, meta: string | undefined) => string> = {
  rendimento: () => "O quanto a caixinha rendeu. Entra como entrada do mês, na sessão da caixinha, e soma no saldo dela.",
  aplicacao: (conta, meta) =>
    meta
      ? `Sai de ${conta} e entra na caixinha. Como ela guarda a meta ${meta}, o valor sai da sobra do mês, como separar para a meta.`
      : `Sai de ${conta} e entra na caixinha. É transferência: não mexe na sobra do mês.`,
  resgate: (conta, meta) =>
    meta ? `Sai da caixinha e volta para ${conta}, e volta para a sobra do mês.` : `Sai da caixinha e volta para ${conta}. É transferência: não mexe na sobra do mês.`,
};

function CorpoDoMovimento({
  movimento,
  conta,
  meta,
  hoje,
  onFechar,
  onSalvo,
}: {
  movimento: Movimento;
  conta: Conta;
  meta: string | undefined;
  hoje: string;
  onFechar: () => void;
  onSalvo: () => Promise<void>;
}) {
  const toast = useToast();
  const { caixinha, tipo } = movimento;
  const [valor, setValor] = useState("");
  const [date, setDate] = useState(hoje);
  const [perda, setPerda] = useState(false);
  const [salvando, setSalvando] = useState(false);

  async function salvar(event: React.FormEvent) {
    event.preventDefault();
    if (salvando) return;
    const cents = reaisParaCentavos(valor);
    if (cents == null || cents <= 0) {
      toast.erro("Informe o valor.");
      return;
    }
    setSalvando(true);
    try {
      await api(`/api/caixinhas/${caixinha.id}/movimentos`, {
        method: "POST",
        body: JSON.stringify({ tipo, cents: tipo === "rendimento" && perda ? -cents : cents, date }),
      });
      toast.sucesso(`${ROTULO_DO_MOVIMENTO_DA_CAIXINHA[tipo]} lançado na caixinha ${caixinha.name}.`);
      onFechar();
      await onSalvo();
    } catch (error) {
      toast.erro(error instanceof Error ? error.message : "Não foi possível lançar.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={(event) => void salvar(event)}>
      <div className="dialog-corpo grid gap-4">
        <h2 id="titulo-movimento" className="font-display text-lg">
          {ROTULO_DO_MOVIMENTO_DA_CAIXINHA[tipo]} · {caixinha.name}
        </h2>
        <p className="text-sm text-ink-2">{EXPLICACAO[tipo](conta.name, meta)}</p>
        <div className="dialog-par">
          <div className="grid gap-1">
            <Rotulo htmlFor="movimento-valor" dica="Em reais, sem sinal.">Valor</Rotulo>
            <CampoValor id="movimento-valor" className={field} value={valor} onChange={setValor} />
          </div>
          <div className="grid gap-1">
            <Rotulo htmlFor="movimento-data" dica={tipo === "rendimento" ? "Use um dia do mês em que rendeu: o rendimento conta nesse mês." : "O dia em que o dinheiro saiu ou voltou."}>
              Data
            </Rotulo>
            <input id="movimento-data" type="date" className={field} required value={date} onChange={(event) => setDate(event.target.value)} />
          </div>
        </div>
        {tipo === "rendimento" ? (
          <label className="flex min-h-10 items-center gap-2 text-sm">
            <input type="checkbox" className={caixaDeMarcar} checked={perda} onChange={(event) => setPerda(event.target.checked)} />
            Foi perda neste mês (o valor caiu)
          </label>
        ) : null}
      </div>
      <div className="dialog-acoes">
        <Button type="button" variant="quiet" onClick={onFechar} disabled={salvando}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" disabled={salvando}>
          Lançar
        </Button>
      </div>
    </form>
  );
}
