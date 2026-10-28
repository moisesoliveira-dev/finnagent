"use client";

import { AnimatePresence, motion } from "motion/react";
import {
  AJUSTES_DE_DIA_UTIL,
  CONTAGENS_DE_DIA_UTIL,
  ROTULO_DO_AJUSTE,
  aceitaDiaUtilDoMes,
  mesmaRegra,
  normalizarRegra,
  proximosVencimentos,
  type AjusteDeDiaUtil,
  type CalendarioDeDiasUteis,
  type CategoriaTransacao,
  type ContagemDeDiaUtil,
  type PreviaDeVencimento,
  type Recorrencia,
  type RegraDeVencimento,
  type TipoDeRegra,
} from "@finnagent/contracts";
import { Button } from "../../components/ui/button";
import { Chip } from "../../components/ui/chip";
import { campo, cn } from "../../components/ui/cn";
import { useCurva } from "../../components/ui/movimento";
import { Rotulo } from "../../components/ui/rotulo";
import { Segmentado } from "../../components/ui/segmentado";

const field = cn(campo, "w-full");

const ROTULO_DA_CONTAGEM: Record<ContagemDeDiaUtil, string> = {
  bancaria: "Bancária (segunda a sexta)",
  clt: "CLT (o sábado conta)",
};

const ORDENS = Array.from({ length: 23 }, (_, indice) => indice + 1);

const dataCurta = new Intl.DateTimeFormat("pt-BR", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

function formatar(iso: string) {
  return dataCurta.format(new Date(`${iso}T12:00:00Z`));
}

/**
 * Quando o vencimento cai: o dia escolhido (com ajuste se não for dia útil), o Nº dia útil ou o último dia útil.
 * A prévia mostra as próximas datas já com os feriados nacionais e os da conta.
 */
export function RegraDoVencimento({
  category,
  recurrence,
  recurrenceInterval,
  installments,
  date,
  regra,
  padrao,
  editando,
  calendario,
  onChange,
}: {
  category: CategoriaTransacao;
  recurrence: Recorrencia | null;
  recurrenceInterval: number | null;
  installments: number | null;
  date: string;
  regra: RegraDeVencimento;
  /** O padrão das configurações para esta categoria e movimento. */
  padrao: RegraDeVencimento;
  editando: boolean;
  calendario: CalendarioDeDiasUteis;
  onChange: (regra: RegraDeVencimento, manual: boolean) => void;
}) {
  const curva = useCurva();
  const dia = Number(date.slice(8, 10)) || 1;
  const efetiva = normalizarRegra(category, recurrence, regra);
  const doMes = aceitaDiaUtilDoMes(category, recurrence);
  const ehPadrao = mesmaRegra(efetiva, normalizarRegra(category, recurrence, padrao));
  const previa = proximosVencimentos({ category, date, recurrence, recurrenceInterval, installments }, efetiva, calendario);
  const opcoes: { id: TipoDeRegra; label: string }[] = [
    { id: "dia", label: `Dia ${dia}` },
    ...(doMes
      ? [
          { id: "dia_util" as const, label: "Nº dia útil" },
          { id: "ultimo_dia_util" as const, label: "Último dia útil" },
        ]
      : []),
  ];

  function mudar(parcial: Partial<RegraDeVencimento>) {
    onChange({ ...efetiva, ...parcial }, true);
  }

  return (
    <fieldset className="grid min-w-0 gap-3 rounded-sm border border-line p-4">
      <legend className="etiqueta px-1 text-ink-2">Vencimento</legend>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Segmentado
          radio
          aria-label="Quando vence"
          opcoes={opcoes}
          valor={efetiva.tipo}
          onEscolher={(tipo) =>
            mudar({
              tipo,
              ordem: tipo === "dia_util" ? (efetiva.ordem ?? 5) : null,
              ajuste: tipo === "dia" ? efetiva.ajuste : "antecipar",
              contagem: tipo === "dia_util" ? efetiva.contagem : "bancaria",
            })
          }
        />
        {ehPadrao ? (
          <Chip title="A regra que as configurações sugerem para esta categoria.">Padrão</Chip>
        ) : (
          <Button type="button" variant="quiet" onClick={() => onChange(padrao, editando)}>
            Usar o padrão
          </Button>
        )}
      </div>

      {efetiva.tipo === "dia" ? (
        <div className="grid gap-1">
          <Rotulo
            htmlFor="vencimento-ajuste"
            dica="Fim de semana e feriado não são dias úteis. Os feriados da sua cidade entram pelas configurações."
          >
            Se cair em fim de semana ou feriado
          </Rotulo>
          <select
            id="vencimento-ajuste"
            value={efetiva.ajuste}
            onChange={(event) => mudar({ ajuste: event.target.value as AjusteDeDiaUtil })}
            className={field}
          >
            {AJUSTES_DE_DIA_UTIL.map((item) => (
              <option key={item} value={item}>
                {ROTULO_DO_AJUSTE[item]}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {efetiva.tipo === "dia_util" ? (
        <div className="dialog-par">
          <div className="grid gap-1">
            <Rotulo htmlFor="vencimento-ordem" dica="Qual dia útil do mês. O salário costuma ser o 5º.">
              Dia útil
            </Rotulo>
            <select
              id="vencimento-ordem"
              value={efetiva.ordem ?? 5}
              onChange={(event) => mudar({ ordem: Number(event.target.value) })}
              className={field}
            >
              {ORDENS.map((ordem) => (
                <option key={ordem} value={ordem}>
                  {ordem}º dia útil
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-1">
            <Rotulo
              htmlFor="vencimento-contagem"
              dica="Na CLT o sábado conta como dia útil, como no 5º dia útil do salário. Se cair num sábado, o crédito vem no dia útil bancário anterior."
            >
              Contagem
            </Rotulo>
            <select
              id="vencimento-contagem"
              value={efetiva.contagem}
              onChange={(event) => mudar({ contagem: event.target.value as ContagemDeDiaUtil })}
              className={field}
            >
              {CONTAGENS_DE_DIA_UTIL.map((item) => (
                <option key={item} value={item}>
                  {ROTULO_DA_CONTAGEM[item]}
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : null}

      {efetiva.tipo === "ultimo_dia_util" ? (
        <p className="max-w-prose text-sm text-ink-2">O último dia do mês em que os bancos abrem.</p>
      ) : null}

      <div className="grid min-w-0 gap-2">
        <span className="etiqueta text-ink-2">Próximas datas</span>
        <ul className="grid min-w-0" aria-live="polite">
          <AnimatePresence initial={false} mode="popLayout">
            {previa.map((item, indice) => (
              <motion.li
                key={`${indice}-${item.data}`}
                layout
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={curva}
                className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-line py-2 last:border-b-0"
              >
                <time dateTime={item.data} className="text-sm font-medium">
                  {formatar(item.data)}
                </time>
                <NotaDaData item={item} tipo={efetiva.tipo} />
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
        {editando ? (
          <p className="max-w-prose text-xs text-ink-2">Ao salvar, só as datas pendentes mudam. As pagas ficam como estão.</p>
        ) : null}
      </div>
    </fieldset>
  );
}

function NotaDaData({ item, tipo }: { item: PreviaDeVencimento; tipo: TipoDeRegra }) {
  const partes: string[] = [];
  if (tipo === "dia" && item.data !== item.base) {
    partes.push(`Cairia em ${formatar(item.base)}${item.feriado ? `, ${item.feriado}` : ""}`);
  }
  if (tipo === "dia" && item.data.slice(0, 7) !== item.base.slice(0, 7)) partes.push("muda de mês");
  if (partes.length === 0) return null;
  return <span className="min-w-0 text-xs text-ink-2">{partes.join(" · ")}</span>;
}
