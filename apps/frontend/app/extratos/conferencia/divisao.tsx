"use client";

import { erroDoTipoDaLinha, type CategoriaTransacao, type LinhaConferencia, type TipoDaLinha } from "@finnagent/contracts";
import { useState } from "react";
import { PainelDaCalculadora, useCalculadora } from "../../../components/calculadora/calculadora";
import { Button } from "../../../components/ui/button";
import { campo, cn, focusRing } from "../../../components/ui/cn";
import { Dialogo } from "../../../components/ui/dialogo";
import { formatarReais } from "../../../components/ui/money";
import { CampoValor } from "../../financas/campo-valor";
import { centavosParaReais, reaisParaCentavos } from "../../financas/reais";
import { BuscaSessao, type SessaoOpcao } from "./busca-sessao";
import { RASCUNHO_UNICO, TipoDaLinhaCampos, rascunhoAceito, tipoDoRascunho, type RascunhoDoTipo } from "./tipo-da-linha";

type Parte = { texto: string; sessionId: string; nome: string; tipo: RascunhoDoTipo };

/** Uma parte pronta para o backend: o valor com sinal, a sessão, o nome (se mudou) e o tipo (se não for única). */
export type ParteParaDividir = { cents: number; sessionId: string; nome?: string; tipo?: TipoDaLinha };

/** A sessão da lista. `fixa` vem quando ela é Fixo e já tem a transação: a parte paga essa transação. */
type SessaoDaDivisao = SessaoOpcao & { fixa?: { cents: number; total: number } | null; categories?: CategoriaTransacao[] };

const MAXIMO_DE_PARTES = 10;

/**
 * Os nomes já dados a linhas com esta descrição, e a própria descrição. Um clique escolhe; o campo de nome
 * continua aberto para um nome novo.
 */
export function NomesLembrados({
  descricao,
  nomes,
  valor,
  onEscolher,
}: {
  descricao: string;
  nomes: string[];
  valor: string;
  onEscolher: (nome: string) => void;
}) {
  const atual = valor.trim() || descricao.trim();
  const opcoes = [descricao.trim(), ...nomes].filter((nome, indice, lista) => nome && lista.indexOf(nome) === indice);
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Nomes já usados">
      <span className="etiqueta text-ink-2">Nomes usados</span>
      {opcoes.map((nome) => (
        <button
          key={nome}
          type="button"
          aria-pressed={nome === atual}
          className={cn(
            "min-h-10 border px-3 text-sm transition-colors",
            nome === atual ? "border-brand bg-brand-soft text-brand" : "border-line text-ink-2 hover:text-ink",
            focusRing,
          )}
          onClick={() => onEscolher(nome)}
        >
          {nome === descricao.trim() ? `Original: ${nome}` : nome}
        </button>
      ))}
    </div>
  );
}

/** O valor de cada parte, sempre no sentido da linha: a pessoa digita o valor sem sinal. */
function centavosDaParte(texto: string, sinal: number) {
  const valor = reaisParaCentavos(texto);
  return valor === null || valor === 0 ? null : Math.abs(valor) * sinal;
}

export function DialogoDeDivisao({
  linha,
  sessoes,
  sessaoInicial,
  ocupado,
  onDividir,
  onFechar,
  onCriarSessao,
}: {
  linha: LinhaConferencia | null;
  sessoes: SessaoDaDivisao[];
  sessaoInicial: string;
  ocupado: boolean;
  onDividir: (partes: ParteParaDividir[]) => void;
  onFechar: () => void;
  onCriarSessao?: (termo: string, escolher: (id: string) => void) => void;
}) {
  return (
    <Dialogo aberto={linha !== null} largura="larga" aria-labelledby="titulo-dividir" onClose={onFechar}>
      {linha ? (
        <CorpoDaDivisao
          key={`${linha.statementId}:${linha.line}`}
          linha={linha}
          sessoes={sessoes}
          sessaoInicial={sessaoInicial}
          ocupado={ocupado}
          onDividir={onDividir}
          onFechar={onFechar}
          onCriarSessao={onCriarSessao}
        />
      ) : null}
    </Dialogo>
  );
}

function CorpoDaDivisao({
  linha,
  sessoes,
  sessaoInicial,
  ocupado,
  onDividir,
  onFechar,
  onCriarSessao,
}: {
  linha: LinhaConferencia;
  sessoes: SessaoDaDivisao[];
  sessaoInicial: string;
  ocupado: boolean;
  onDividir: (partes: ParteParaDividir[]) => void;
  onFechar: () => void;
  onCriarSessao?: (termo: string, escolher: (id: string) => void) => void;
}) {
  const { resultado } = useCalculadora();
  const [comCalculadora, setComCalculadora] = useState(false);
  const nomeInicial = linha.names[0] ?? "";
  const [partes, setPartes] = useState<Parte[]>([
    { texto: "", sessionId: sessaoInicial, nome: nomeInicial, tipo: RASCUNHO_UNICO },
    { texto: "", sessionId: "", nome: nomeInicial, tipo: RASCUNHO_UNICO },
  ]);
  const sinal = linha.cents < 0 ? -1 : 1;
  const total = Math.abs(linha.cents);
  const valores = partes.map((parte) => centavosDaParte(parte.texto, sinal));
  const soma = valores.reduce<number>((acumulado, valor) => acumulado + Math.abs(valor ?? 0), 0);
  const restante = total - soma;
  // O tipo de cada parte, conferido com o valor dela. A parte que paga a transação da sessão Fixo não cria lançamento.
  const sessaoDa = (parte: Parte) => sessoes.find((sessao) => sessao.id === parte.sessionId);
  const tipoDaParte = (parte: Parte, indice: number) =>
    rascunhoAceito(parte.tipo, valores[indice] ?? linha.cents, sessaoDa(parte)?.categories);
  const errosDoTipo = partes.map((parte, indice) => {
    const valor = valores[indice];
    return valor === null || sessaoDa(parte)?.fixa ? null : erroDoTipoDaLinha(tipoDoRascunho(tipoDaParte(parte, indice)), valor);
  });
  const prontas =
    valores.every((valor) => valor !== null) && partes.every((parte) => parte.sessionId) && errosDoTipo.every((erro) => erro === null);
  const pode = prontas && restante === 0 && !ocupado;

  function mudar(indice: number, mudanca: Partial<Parte>) {
    setPartes((atual) => atual.map((parte, posicao) => (posicao === indice ? { ...parte, ...mudanca } : parte)));
  }

  function enviar() {
    if (!pode) return;
    onDividir(
      partes.map((parte, indice) => {
        const nome = parte.nome.trim();
        const tipo = tipoDoRascunho(tipoDaParte(parte, indice));
        return {
          cents: valores[indice] as number,
          sessionId: parte.sessionId,
          ...(nome && nome !== linha.description.trim() ? { nome } : {}),
          ...(tipo.category !== "unique" ? { tipo } : {}),
        };
      }),
    );
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-1">
        <h2 id="titulo-dividir" className="font-display text-lg">
          Dividir {linha.cents < 0 ? "a saída" : "a entrada"} de {formatarReais(Math.abs(linha.cents))}
        </h2>
        <p className="text-sm text-ink-2">
          {linha.description || "Linha do extrato"}. Cada parte vira um lançamento pago, na sessão e com o nome que você
          escolher. Para dividir por uma conta, abra a calculadora e use o resultado.
        </p>
      </div>

      <ol className="grid gap-3">
        {partes.map((parte, indice) => {
          const valor = valores[indice];
          const invalido = parte.texto.trim() !== "" && valor === null;
          const fixa = sessoes.find((sessao) => sessao.id === parte.sessionId)?.fixa ?? null;
          return (
            <li key={indice} className="grid gap-2 border border-line p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="etiqueta text-ink-2">Parte {indice + 1}</span>
                {partes.length > 2 ? (
                  <Button
                    variant="quiet"
                    className="ml-auto"
                    onClick={() => setPartes((atual) => atual.filter((_, posicao) => posicao !== indice))}
                  >
                    Remover
                  </Button>
                ) : null}
              </div>
              <div className="grid gap-2 tab:grid-cols-3">
                <div className="grid gap-1">
                  <CampoValor
                    className={cn(campo, "w-full", invalido && "border-neg")}
                    aria-label={`Valor da parte ${indice + 1}`}
                    aria-invalid={invalido}
                    value={parte.texto}
                    onChange={(texto) => mudar(indice, { texto })}
                  />
                  <span className="flex flex-wrap gap-1">
                    {restante > 0 ? (
                      <button
                        type="button"
                        className={cn("etiqueta px-1 text-brand hover:underline", focusRing)}
                        onClick={() => mudar(indice, { texto: centavosParaReais(Math.abs(valor ?? 0) + restante) })}
                      >
                        + restante
                      </button>
                    ) : null}
                    {resultado !== null && resultado !== 0 ? (
                      <button
                        type="button"
                        className={cn("etiqueta px-1 text-brand hover:underline", focusRing)}
                        title="O valor guardado na calculadora"
                        onClick={() => mudar(indice, { texto: centavosParaReais(Math.round(Math.abs(resultado) * 100)) })}
                      >
                        Calculadora
                      </button>
                    ) : null}
                  </span>
                </div>
                <BuscaSessao
                  className="min-w-0 tab:col-span-2"
                  sessoes={sessoes}
                  valor={parte.sessionId}
                  rotulo={`Sessão da parte ${indice + 1}`}
                  onEscolher={(id) => mudar(indice, { sessionId: id })}
                  onCriar={onCriarSessao}
                />
                {fixa ? null : (
                  <TipoDaLinhaCampos
                    className="tab:col-span-3"
                    rotulo={`Tipo da parte ${indice + 1}`}
                    cents={valor ?? linha.cents}
                    aceitas={sessaoDa(parte)?.categories}
                    valor={tipoDaParte(parte, indice)}
                    onChange={(tipo) => mudar(indice, { tipo })}
                  />
                )}
                {errosDoTipo[indice] ? <p className="text-sm text-neg tab:col-span-3">{errosDoTipo[indice]}</p> : null}
              </div>
              {fixa ? (
                <div className="flex flex-wrap items-center gap-2 text-sm text-ink-2">
                  <span className="min-w-0 flex-1">
                    Esta parte paga a transação do fixo, de {formatarReais(Math.abs(fixa.cents))}, com o valor da parte. Ela
                    continua com o nome dela.
                  </span>
                  {valor === null || Math.abs(valor) !== Math.abs(fixa.cents) ? (
                    <Button variant="quiet" onClick={() => mudar(indice, { texto: centavosParaReais(Math.abs(fixa.cents)) })}>
                      Usar {formatarReais(Math.abs(fixa.cents))}
                    </Button>
                  ) : null}
                </div>
              ) : (
                <input
                  className={cn(campo, "w-full")}
                  aria-label={`Nome da parte ${indice + 1}`}
                  placeholder={`Nome: ${linha.description || "como no extrato"}`}
                  maxLength={160}
                  value={parte.nome}
                  onChange={(event) => mudar(indice, { nome: event.target.value })}
                />
              )}
              {!fixa && linha.names.length ? (
                <NomesLembrados
                  descricao={linha.description}
                  nomes={linha.names}
                  valor={parte.nome}
                  onEscolher={(nome) => mudar(indice, { nome })}
                />
              ) : null}
            </li>
          );
        })}
      </ol>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          disabled={partes.length >= MAXIMO_DE_PARTES}
          onClick={() => setPartes((atual) => [...atual, { texto: "", sessionId: "", nome: nomeInicial, tipo: RASCUNHO_UNICO }])}
        >
          Mais uma parte
        </Button>
        <Button variant="quiet" aria-pressed={comCalculadora} onClick={() => setComCalculadora((atual) => !atual)}>
          {comCalculadora ? "Esconder a calculadora" : "Calculadora"}
        </Button>
      </div>

      {comCalculadora ? (
        <div className="border border-line">
          <PainelDaCalculadora />
        </div>
      ) : null}

      <dl className="grid gap-2 border border-line p-3 text-sm">
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-ink-2">Valor da linha</dt>
          <dd className="font-display font-bold">{formatarReais(total)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-ink-2">Soma das partes</dt>
          <dd className="font-display font-bold">{formatarReais(soma)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-4 border-t border-line pt-2">
          <dt className="text-ink-2">{restante >= 0 ? "Falta dividir" : "Passou do valor"}</dt>
          <dd className={cn("font-display font-bold", restante === 0 ? "text-pos" : "text-neg")}>{formatarReais(Math.abs(restante))}</dd>
        </div>
      </dl>

      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="quiet" onClick={onFechar}>
          Cancelar
        </Button>
        <Button variant="primary" carregando={ocupado} disabled={!pode} onClick={enviar}>
          {ocupado ? "Dividindo" : `Dividir em ${partes.length}`}
        </Button>
      </div>
    </div>
  );
}
