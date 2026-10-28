"use client";

import { motion } from "motion/react";
import { useState } from "react";
import {
  ESPECIALISTAS_IA,
  INFO_DA_LEITURA,
  INFO_DOS_AGENTES,
  INFO_DOS_PROVEDORES,
  ferramentasDo,
  type ConfiguracaoDeIa,
  type ConfiguracaoDoAssistente,
  type EscolhaDeModelo,
  type FuncaoDeModelo,
} from "@finnagent/contracts";
import { Chip } from "../../../components/ui/chip";
import { cn, focusRing } from "../../../components/ui/cn";
import { Cascata, Expandir, Passo, Seta } from "../../../components/ui/movimento";
import { SeletorDeModelo, rotuloDaEscolha } from "./pecas";

function CartaoDeAgente({
  funcao,
  nome,
  resumo,
  configuracao,
  rascunho,
  destaque = false,
  onEscolher,
}: {
  funcao: FuncaoDeModelo;
  nome: string;
  resumo: string;
  configuracao: ConfiguracaoDeIa;
  rascunho: ConfiguracaoDoAssistente;
  destaque?: boolean;
  onEscolher: (escolha: EscolhaDeModelo | null) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const propria = rascunho.funcoes[funcao] ?? null;
  const efetiva = rotuloDaEscolha(propria ?? rascunho.padrao, configuracao.provedores);
  const ferramentas = funcao === "leitor" || funcao === "coordenador" ? [] : ferramentasDo(funcao);
  const idDaLista = `ferramentas-${funcao}`;
  const leitor = funcao === "leitor";

  return (
    <motion.article
      whileHover={{ y: -2 }}
      className={cn("grid h-full content-start gap-3 border bg-surface p-4", destaque ? "border-brand" : "border-line")}
    >
      <header className="flex items-start justify-between gap-2">
        <div className="grid gap-1">
          <p className={cn("etiqueta", destaque ? "text-brand" : "text-ink")}>{nome}</p>
          <p className="text-sm text-ink-2">{resumo}</p>
        </div>
        {propria ? <Chip tone="ok">Próprio</Chip> : <Chip>Padrão</Chip>}
      </header>
      <label htmlFor={`modelo-${funcao}`} className="sr-only">
        Modelo de {nome}
      </label>
      <SeletorDeModelo
        id={`modelo-${funcao}`}
        provedores={configuracao.provedores}
        valor={propria}
        rotuloDoPadrao={`Usar o padrão${rascunho.padrao ? ` (${rascunho.padrao.model})` : ""}`}
        desativado={!configuracao.podeEditar}
        filtrar={leitor ? (provedor) => INFO_DOS_PROVEDORES[provedor.kind].leExtratos : undefined}
        onMudar={onEscolher}
      />
      <p className="text-sm text-ink-2">
        {efetiva ? (
          <>
            Usa <span className="font-mono text-ink">{efetiva}</span>
          </>
        ) : (
          <span className="text-neg">Sem modelo: escolha um ou defina o padrão.</span>
        )}
      </p>
      {leitor ? <p className="text-sm text-ink-2">Por enquanto, só provedores no formato da OpenAI leem arquivos.</p> : null}
      {ferramentas.length ? (
        <div className="grid gap-2 border-t border-line pt-3">
          <button
            type="button"
            aria-expanded={aberto}
            aria-controls={idDaLista}
            onClick={() => setAberto((atual) => !atual)}
            className={cn("etiqueta flex min-h-10 items-center justify-between gap-2 text-ink-2 hover:text-ink", focusRing)}
          >
            {ferramentas.length} ações que ele faz
            <Seta aberto={aberto} />
          </button>
          <Expandir aberto={aberto} id={idDaLista}>
            <ul className="grid gap-1 pb-1 text-sm">
              {ferramentas.map((ferramenta) => (
                <li key={ferramenta.nome} className="flex items-start gap-2">
                  <span
                    aria-hidden
                    className={cn("mt-2 size-1 shrink-0", ferramenta.destrutiva ? "bg-neg" : ferramenta.leitura ? "bg-ink-2" : "bg-brand")}
                  />
                  <span>
                    {ferramenta.descricao}
                    {ferramenta.destrutiva ? <span className="text-neg"> Pede confirmação.</span> : null}
                  </span>
                </li>
              ))}
            </ul>
          </Expandir>
        </div>
      ) : null}
    </motion.article>
  );
}

export function Agentes({
  configuracao,
  rascunho,
  onMudar,
}: {
  configuracao: ConfiguracaoDeIa;
  rascunho: ConfiguracaoDoAssistente;
  onMudar: (rascunho: ConfiguracaoDoAssistente) => void;
}) {
  const escolher = (funcao: FuncaoDeModelo) => (escolha: EscolhaDeModelo | null) => {
    const funcoes = { ...rascunho.funcoes };
    if (escolha) funcoes[funcao] = escolha;
    else delete funcoes[funcao];
    onMudar({ ...rascunho, funcoes });
  };
  const semProvedores = configuracao.provedores.every((provedor) => provedor.models.length === 0);

  return (
    <div className="grid gap-6">
      <div className="grid max-w-prose gap-1">
        <h2 className="font-display text-lg">Agentes</h2>
        <p className="text-sm text-ink-2">
          O assistente é uma equipe. O coordenador lê o pedido e passa para o especialista certo, e eles passam a vez entre
          si quando o pedido mistura áreas. Cada um pode usar um modelo diferente: um modelo rápido e barato no coordenador
          e um mais forte na análise, por exemplo.
        </p>
      </div>

      {semProvedores ? (
        <p className="border border-dashed border-pending-line bg-pending-soft p-4 text-sm">
          Conecte um provedor com pelo menos um modelo na seção Provedores para escolher os modelos aqui.
        </p>
      ) : null}

      <section aria-labelledby="titulo-padrao" className="grid gap-3 border border-line bg-surface p-4">
        <div className="grid gap-1">
          <h3 id="titulo-padrao" className="font-semibold">
            Modelo padrão
          </h3>
          <p className="text-sm text-ink-2">Quem não tiver modelo próprio usa este.</p>
        </div>
        <SeletorDeModelo
          id="modelo-padrao"
          provedores={configuracao.provedores}
          valor={rascunho.padrao}
          rotuloDoPadrao=""
          desativado={!configuracao.podeEditar}
          onMudar={(escolha) => onMudar({ ...rascunho, padrao: escolha })}
        />
      </section>

      <Cascata className="grid gap-0" intervalo={0.05}>
        <Passo className="mx-auto w-full max-w-md">
          <CartaoDeAgente
            funcao="coordenador"
            nome={INFO_DOS_AGENTES.coordenador.nome}
            resumo={INFO_DOS_AGENTES.coordenador.resumo}
            configuracao={configuracao}
            rascunho={rascunho}
            destaque
            onEscolher={escolher("coordenador")}
          />
        </Passo>
        {/* As linhas do coordenador até a equipe se desenham quando a seção aparece. */}
        <motion.span
          aria-hidden
          className="mx-auto block h-6 w-px origin-top bg-line"
          initial={{ scaleY: 0 }}
          animate={{ scaleY: 1 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        />
        <motion.span
          aria-hidden
          className="mx-auto hidden h-px w-2/3 bg-line desk:block"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.5, delay: 0.5 }}
        />
        <div className="grid gap-3 pt-6 tab:grid-cols-2 desk:grid-cols-3">
          {ESPECIALISTAS_IA.map((agente) => (
            <Passo key={agente}>
              <CartaoDeAgente
                funcao={agente}
                nome={INFO_DOS_AGENTES[agente].nome}
                resumo={INFO_DOS_AGENTES[agente].resumo}
                configuracao={configuracao}
                rascunho={rascunho}
                onEscolher={escolher(agente)}
              />
            </Passo>
          ))}
        </div>
      </Cascata>

      <div className="grid gap-3 border-t border-line pt-6">
        <p className="etiqueta text-ink-2">Fora do chat</p>
        <div className="grid tab:grid-cols-2">
          <CartaoDeAgente
            funcao="leitor"
            nome={INFO_DA_LEITURA.nome}
            resumo={INFO_DA_LEITURA.resumo}
            configuracao={configuracao}
            rascunho={rascunho}
            onEscolher={escolher("leitor")}
          />
        </div>
      </div>
    </div>
  );
}
