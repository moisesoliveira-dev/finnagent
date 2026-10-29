"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import {
  INFO_DOS_AGENTES,
  type AcaoDoAssistente,
  type AgenteIa,
  type MensagemDoChat,
  type ParteDaMensagem,
  type PerguntaDoAssistente,
} from "@finnagent/contracts";
import { Button } from "../../components/ui/button";
import { campo, cn, focusRing } from "../../components/ui/cn";
import { curvaCheia, mola } from "../../components/ui/movimento";
import { CartaoDePlano } from "./plano";
import { TextoFormatado } from "./texto-formatado";

const entrada = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: curvaCheia,
};

function nomeDo(agente: AgenteIa | null) {
  return agente ? INFO_DOS_AGENTES[agente].nome : "Assistente";
}

/** O quadrado amarelo da marca. Enquanto o assistente trabalha, ele gira devagar, como um prumo procurando o eixo. */
function Selo({ vivo }: { vivo: boolean }) {
  return (
    <motion.span
      aria-hidden
      className="size-3 shrink-0 bg-cta"
      animate={vivo ? { rotate: [0, 90, 90, 180] } : { rotate: 0 }}
      transition={vivo ? { duration: 1.6, repeat: Infinity, ease: "easeInOut", times: [0, 0.4, 0.6, 1] } : mola}
    />
  );
}

function Cursor() {
  return (
    <motion.span
      aria-hidden
      className="ml-1 inline-block h-4 w-2 translate-y-1 bg-brand"
      animate={{ opacity: [1, 0] }}
      transition={{ duration: 0.6, repeat: Infinity, repeatType: "reverse" }}
    />
  );
}

export function Trabalhando({ agente }: { agente: AgenteIa | null }) {
  const frase = agente === "coordenador" || !agente ? "Lendo o pedido" : `${nomeDo(agente)} está trabalhando`;
  return (
    <motion.div {...entrada} role="status" className="flex items-center gap-3 text-sm text-ink-2">
      <span className="flex gap-1" aria-hidden>
        {[0, 1, 2].map((ponto) => (
          <motion.span
            key={ponto}
            className="size-2 bg-ink-2"
            animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 0.9, repeat: Infinity, delay: ponto * 0.15, ease: "easeInOut" }}
          />
        ))}
      </span>
      <AnimatePresence mode="wait" initial={false}>
        <motion.span key={frase} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}>
          {frase}…
        </motion.span>
      </AnimatePresence>
    </motion.div>
  );
}

const ICONE_DA_ACAO = {
  feita: { classe: "text-pos", caminho: "M5 12l4 4L19 7" },
  falhou: { classe: "text-neg", caminho: "M6 6l12 12M18 6L6 18" },
  cancelada: { classe: "text-ink-2", caminho: "M6 12h12" },
} as const;

function Acao({ acao }: { acao: AcaoDoAssistente }) {
  return (
    <motion.li
      layout
      {...entrada}
      className={cn(
        "grid gap-1 border bg-surface px-3 py-2 text-sm",
        acao.estado === "falhou" ? "border-neg" : "border-line",
      )}
    >
      <span className="flex min-w-0 items-center gap-2">
        <span className="grid size-4 shrink-0 place-items-center">
          <AnimatePresence mode="wait" initial={false}>
            {acao.estado === "executando" ? (
              <motion.span
                key="girando"
                aria-hidden
                className="size-3 rounded-full border-2 border-pending-line border-t-pending"
                animate={{ rotate: 360 }}
                // A saída tem transição própria: herdando o giro infinito, ela nunca terminaria e o ✓ não entraria.
                exit={{ opacity: 0, scale: 0.4, transition: { duration: 0.12 } }}
                transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
              />
            ) : (
              <motion.svg
                key={acao.estado}
                viewBox="0 0 24 24"
                className={cn("size-4", ICONE_DA_ACAO[acao.estado].classe)}
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
                aria-hidden
                initial={{ scale: 0.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={mola}
              >
                <motion.path
                  d={ICONE_DA_ACAO[acao.estado].caminho}
                  strokeLinecap="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.3 }}
                />
              </motion.svg>
            )}
          </AnimatePresence>
        </span>
        <span className={cn("min-w-0 truncate", acao.estado === "cancelada" && "text-ink-2 line-through")}>{acao.rotulo}</span>
        <span className="sr-only">
          {{ executando: "em andamento", feita: "feito", falhou: "falhou", cancelada: "cancelado" }[acao.estado]}
        </span>
      </span>
      {acao.detalhe ? <span className="pl-6 text-ink-2">{acao.detalhe}</span> : null}
    </motion.li>
  );
}

function CartaoDePergunta({
  pergunta,
  ativa,
  onResponder,
}: {
  pergunta: PerguntaDoAssistente;
  ativa: boolean;
  onResponder: (escolha: string) => void;
}) {
  const [outra, setOutra] = useState("");
  const aberta = pergunta.resposta === null;
  const confirmacao = pergunta.tipo === "confirmacao";
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={mola}
      className={cn(
        "grid gap-3 border p-4",
        aberta ? "border-dashed border-pending-line bg-pending-soft" : "border-line bg-surface",
      )}
    >
      <p className={cn("etiqueta", aberta ? "text-pending" : "text-ink-2")}>
        {confirmacao ? (aberta ? "Confirme antes" : "Confirmação") : aberta ? "Preciso de uma escolha" : "Pergunta"}
      </p>
      <p className="font-semibold">{pergunta.texto}</p>
      <div className="grid gap-2 tab:grid-cols-2">
        {pergunta.opcoes.map((opcao) => {
          const escolhida = pergunta.resposta === opcao.rotulo;
          const perigo = confirmacao && opcao.rotulo === "Confirmar";
          return (
            <motion.button
              key={opcao.rotulo}
              type="button"
              disabled={!aberta || !ativa}
              whileHover={aberta && ativa ? { y: -2 } : undefined}
              whileTap={aberta && ativa ? { scale: 0.98 } : undefined}
              onClick={() => onResponder(opcao.rotulo)}
              className={cn(
                "grid min-h-10 gap-1 border px-3 py-2 text-left transition-colors disabled:cursor-default",
                focusRing,
                escolhida
                  ? "border-brand bg-brand-soft"
                  : aberta
                    ? perigo
                      ? "border-neg bg-surface hover:bg-neg-soft"
                      : "border-line bg-surface hover:border-brand"
                    : "border-line bg-surface opacity-50",
              )}
            >
              <span className={cn("flex items-center gap-2 font-medium", perigo && !escolhida && "text-neg", escolhida && "text-brand")}>
                {escolhida ? (
                  <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden>
                    <path d="M5 12l4 4L19 7" strokeLinecap="round" />
                  </svg>
                ) : null}
                {opcao.rotulo}
              </span>
              {opcao.descricao ? <span className="text-sm text-ink-2">{opcao.descricao}</span> : null}
            </motion.button>
          );
        })}
      </div>
      {aberta && !confirmacao && ativa ? (
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (outra.trim()) onResponder(outra.trim());
          }}
        >
          <label htmlFor={`outra-${pergunta.id}`} className="sr-only">
            Outra resposta
          </label>
          <input
            id={`outra-${pergunta.id}`}
            value={outra}
            maxLength={300}
            placeholder="Outra resposta"
            className={cn(campo, "flex-1")}
            onChange={(event) => setOutra(event.target.value)}
          />
          <Button type="submit" disabled={!outra.trim()}>
            Responder
          </Button>
        </form>
      ) : null}
      {pergunta.resposta && !pergunta.opcoes.some((opcao) => opcao.rotulo === pergunta.resposta) ? (
        <p className="text-sm text-ink-2">Resposta: {pergunta.resposta}</p>
      ) : null}
    </motion.div>
  );
}

function Parte({
  parte,
  ultima,
  viva,
  perguntaAtiva,
  onResponder,
}: {
  parte: ParteDaMensagem;
  ultima: boolean;
  viva: boolean;
  perguntaAtiva: boolean;
  onResponder: (perguntaId: string, escolha: string) => void;
}) {
  if (parte.tipo === "texto") {
    return (
      <div className="flex min-w-0 items-end">
        <TextoFormatado texto={parte.texto} />
        {viva && ultima ? <Cursor /> : null}
      </div>
    );
  }
  if (parte.tipo === "acao") return <Acao acao={parte.acao} />;
  if (parte.tipo === "agente") {
    return (
      <motion.p {...entrada} className="etiqueta flex items-center gap-2 text-ink-2">
        <span aria-hidden className="h-px w-6 bg-line" />
        {nomeDo(parte.agente)} assumiu
      </motion.p>
    );
  }
  if (parte.pergunta.tipo === "plano" && parte.pergunta.plano) {
    return (
      <CartaoDePlano
        pergunta={parte.pergunta}
        plano={parte.pergunta.plano}
        ativa={perguntaAtiva}
        onResponder={(escolha) => onResponder(parte.pergunta.id, escolha)}
      />
    );
  }
  return (
    <CartaoDePergunta
      pergunta={parte.pergunta}
      ativa={perguntaAtiva}
      onResponder={(escolha) => onResponder(parte.pergunta.id, escolha)}
    />
  );
}

/** Ações seguidas ficam juntas numa lista. */
function agrupar(partes: ParteDaMensagem[]) {
  const grupos: Array<{ tipo: "acoes"; itens: AcaoDoAssistente[] } | { tipo: "parte"; parte: ParteDaMensagem; indice: number }> = [];
  partes.forEach((parte, indice) => {
    const ultimo = grupos[grupos.length - 1];
    if (parte.tipo === "acao") {
      if (ultimo?.tipo === "acoes") ultimo.itens.push(parte.acao);
      else grupos.push({ tipo: "acoes", itens: [parte.acao] });
    } else {
      grupos.push({ tipo: "parte", parte, indice });
    }
  });
  return grupos;
}

export function Mensagem({
  mensagem,
  viva,
  agenteAtual,
  podeResponder,
  onResponder,
}: {
  mensagem: MensagemDoChat;
  viva: boolean;
  agenteAtual: AgenteIa | null;
  podeResponder: boolean;
  onResponder: (perguntaId: string, escolha: string) => void;
}) {
  if (mensagem.role === "user") {
    const texto = mensagem.partes.map((parte) => (parte.tipo === "texto" ? parte.texto : "")).join("");
    return (
      <motion.li {...entrada} className="flex justify-end">
        <p className="max-w-prose min-w-0 border border-line bg-surface-2 px-4 py-3 whitespace-pre-wrap break-words">{texto}</p>
      </motion.li>
    );
  }

  const ultima = mensagem.partes[mensagem.partes.length - 1];
  const esperando = viva && (!ultima || ultima.tipo !== "texto" || !ultima.texto);
  const grupos = agrupar(mensagem.partes.filter((parte, indice) => !(parte.tipo === "agente" && indice === 0)));
  return (
    <motion.li {...entrada} className="grid min-w-0 gap-3">
      <span className="flex items-center gap-2">
        <Selo vivo={viva} />
        <span className="etiqueta text-ink-2">{nomeDo(mensagem.agente ?? (viva ? agenteAtual : null))}</span>
      </span>
      <div className="grid min-w-0 gap-3 pl-6">
        {grupos.map((grupo, posicao) =>
          grupo.tipo === "acoes" ? (
            <ul key={`acoes-${posicao}`} className="grid gap-1" aria-label="Ações do assistente">
              {grupo.itens.map((acao) => (
                <Acao key={acao.id} acao={acao} />
              ))}
            </ul>
          ) : (
            <Parte
              key={`parte-${grupo.indice}`}
              parte={grupo.parte}
              ultima={grupo.indice === mensagem.partes.length - 1}
              viva={viva}
              perguntaAtiva={podeResponder}
              onResponder={onResponder}
            />
          ),
        )}
        <AnimatePresence>{esperando ? <Trabalhando key="trabalhando" agente={agenteAtual} /> : null}</AnimatePresence>
      </div>
    </motion.li>
  );
}
