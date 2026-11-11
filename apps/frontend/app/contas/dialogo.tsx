"use client";

import { useState } from "react";
import { ROTULO_DO_TIPO_DE_CONTA, TIPOS_DE_CONTA, lerReais, type Conta, type TipoDeConta } from "@finnagent/contracts";
import { Button } from "../../components/ui/button";
import { caixaDeMarcar, campo, cn } from "../../components/ui/cn";
import { Dialogo } from "../../components/ui/dialogo";
import { Rotulo } from "../../components/ui/rotulo";
import { useToast } from "../../components/ui/toast";
import { api } from "../financas/api";
import { CampoValor } from "../financas/campo-valor";
import { centavosParaReais, reaisParaCentavos } from "../financas/reais";

const field = cn(campo, "w-full");

/** O que o diálogo recebe: a conta a editar, ou `null` para criar. `undefined` fecha. */
export type PedidoDeConta = Conta | null;

/** Cria ou edita uma conta: nome, tipo (conta ou cartão) e o saldo inicial. */
export function DialogoDeConta({
  pedido,
  hoje,
  tipoInicial = "conta",
  onFechar,
  onSalvo,
}: {
  pedido: PedidoDeConta | undefined;
  hoje: string;
  /** O tipo já escolhido ao criar: o "Comece por aqui" abre direto no cartão. */
  tipoInicial?: TipoDeConta;
  onFechar: () => void;
  onSalvo: (conta: Conta) => Promise<void> | void;
}) {
  return (
    <Dialogo aberto={pedido !== undefined} aria-labelledby="titulo-conta" onClose={onFechar}>
      {pedido !== undefined ? <Corpo key={pedido?.id ?? `nova-${tipoInicial}`} conta={pedido} hoje={hoje} tipoInicial={tipoInicial} onFechar={onFechar} onSalvo={onSalvo} /> : null}
    </Dialogo>
  );
}

function Corpo({
  conta,
  hoje,
  tipoInicial,
  onFechar,
  onSalvo,
}: {
  conta: Conta | null;
  hoje: string;
  tipoInicial: TipoDeConta;
  onFechar: () => void;
  onSalvo: (conta: Conta) => Promise<void> | void;
}) {
  const toast = useToast();
  const [name, setName] = useState(conta?.name ?? "");
  const [kind, setKind] = useState<TipoDeConta>(conta?.kind ?? tipoInicial);
  const [opening, setOpening] = useState(conta ? centavosParaReais(conta.openingCents) : "");
  // O campo só mostra o valor, sem sinal. Conta no vermelho guarda o sinal aqui, para editar não virar saldo positivo.
  const [negativo, setNegativo] = useState(conta ? conta.openingCents < 0 : false);
  // Conta antiga sem data continua sem data até a pessoa escolher uma.
  const [openingOn, setOpeningOn] = useState(conta ? (conta.openingOn ?? "") : hoje);
  const [closingDay, setClosingDay] = useState(conta?.closingDay ? String(conta.closingDay) : "");
  const [dueDay, setDueDay] = useState(conta?.dueDay ? String(conta.dueDay) : "");
  const [limite, setLimite] = useState(conta?.limitCents ? centavosParaReais(conta.limitCents) : "");
  const [salvando, setSalvando] = useState(false);
  const cartao = kind === "cartao";

  async function salvar(event: React.FormEvent) {
    event.preventDefault();
    if (salvando) return;
    const valor = opening.trim() ? lerReais(opening) : 0;
    if (valor == null) {
      toast.erro("Informe o saldo inicial.");
      return;
    }
    // O cartão guarda a fatura em aberto como dívida: sempre negativa. A conta, conforme a marca de saldo negativo.
    const openingCents = cartao || negativo ? -Math.abs(valor) : Math.abs(valor);
    const limitCents = limite.trim() ? reaisParaCentavos(limite) : null;
    if (cartao && limite.trim() && (limitCents == null || limitCents < 0)) {
      toast.erro("Informe o limite do cartão.");
      return;
    }
    const dia = (texto: string) => (texto.trim() ? Number(texto) : null);
    if (cartao && ((closingDay && !(Number(closingDay) >= 1 && Number(closingDay) <= 28)) || (dueDay && !(Number(dueDay) >= 1 && Number(dueDay) <= 28)))) {
      toast.erro("Os dias de fechamento e vencimento vão de 1 a 28.");
      return;
    }
    setSalvando(true);
    try {
      const corpo = {
        name: name.trim(),
        kind,
        openingCents,
        openingOn: openingOn || null,
        closingDay: cartao ? dia(closingDay) : null,
        dueDay: cartao ? dia(dueDay) : null,
        limitCents: cartao ? limitCents : null,
      };
      const salva = conta
        ? await api<Conta>(`/api/contas/${conta.id}`, { method: "PATCH", body: JSON.stringify(corpo) })
        : await api<Conta>("/api/contas", { method: "POST", body: JSON.stringify({ id: crypto.randomUUID(), ...corpo }) });
      toast.sucesso(conta ? "Conta atualizada." : "Conta criada.");
      onFechar();
      await onSalvo(salva);
    } catch (error) {
      toast.erro(error instanceof Error ? error.message : "Não foi possível salvar a conta.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={(event) => void salvar(event)}>
      <div className="dialog-corpo grid gap-4">
        <h2 id="titulo-conta" className="font-display text-lg">
          {conta ? "Editar conta" : "Nova conta"}
        </h2>
        <div className="grid gap-1">
          <Rotulo htmlFor="conta-nome" dica="Como você chama esta conta: Nubank, Carteira, Cartão Itaú.">
            Nome
          </Rotulo>
          <input id="conta-nome" className={field} required maxLength={80} value={name} onChange={(event) => setName(event.target.value)} />
        </div>
        <div className="dialog-par">
          <div className="grid gap-1">
            <Rotulo htmlFor="conta-tipo" dica="Conta é banco ou carteira. Cartão de crédito junta as compras na fatura.">
              Tipo
            </Rotulo>
            <select id="conta-tipo" className={field} value={kind} onChange={(event) => setKind(event.target.value as TipoDeConta)}>
              {TIPOS_DE_CONTA.map((tipo) => (
                <option key={tipo} value={tipo}>
                  {ROTULO_DO_TIPO_DE_CONTA[tipo]}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-1">
            <Rotulo
              htmlFor="conta-saldo"
              dica="Quanto havia na conta no dia ao lado. No cartão, a fatura em aberto nesse dia (o sistema a guarda como dívida), ou zero."
            >
              Saldo inicial
            </Rotulo>
            <CampoValor id="conta-saldo" className={field} value={opening} onChange={setOpening} />
            {cartao ? null : (
              <label className="flex min-h-10 items-center gap-3 text-sm">
                <input type="checkbox" className={caixaDeMarcar} checked={negativo} onChange={(event) => setNegativo(event.target.checked)} />
                Saldo negativo (conta no vermelho)
              </label>
            )}
          </div>
        </div>
        <div className="grid gap-1">
          <Rotulo
            htmlFor="conta-data"
            dica="Só o que acontece a partir deste dia conta no saldo. Extratos de antes entram na sobra e no histórico, sem dobrar o saldo. Vazio: tudo conta."
          >
            Saldo em
          </Rotulo>
          <input id="conta-data" type="date" className={field} value={openingOn} onChange={(event) => setOpeningOn(event.target.value)} />
        </div>
        {cartao ? (
          <>
            <div className="dialog-par">
              <div className="grid gap-1">
                <Rotulo htmlFor="conta-fechamento" dica="O dia do mês em que a fatura fecha. Compras depois dele vão para a fatura seguinte.">
                  Fecha dia
                </Rotulo>
                <input id="conta-fechamento" type="number" inputMode="numeric" min={1} max={28} className={field} value={closingDay} onChange={(event) => setClosingDay(event.target.value)} />
              </div>
              <div className="grid gap-1">
                <Rotulo htmlFor="conta-vencimento" dica="O dia do mês em que a fatura vence. Se vem antes do fechamento, é no mês seguinte.">
                  Vence dia
                </Rotulo>
                <input id="conta-vencimento" type="number" inputMode="numeric" min={1} max={28} className={field} value={dueDay} onChange={(event) => setDueDay(event.target.value)} />
              </div>
            </div>
            <div className="grid gap-1">
              <Rotulo htmlFor="conta-limite" dica="O limite do cartão. O sistema avisa aos 80% e ao estourar. Vazio: sem limite.">
                Limite
              </Rotulo>
              <CampoValor id="conta-limite" className={field} value={limite} onChange={setLimite} />
            </div>
          </>
        ) : null}
      </div>
      <div className="dialog-acoes">
        <Button type="button" variant="quiet" onClick={onFechar} disabled={salvando}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" disabled={salvando}>
          {conta ? "Salvar conta" : "Criar conta"}
        </Button>
      </div>
    </form>
  );
}
