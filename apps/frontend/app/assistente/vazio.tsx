"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { INFO_DOS_AGENTES, type EspecialistaIa } from "@finnagent/contracts";
import { cn, focusRing } from "../../components/ui/cn";
import { Cascata, Passo } from "../../components/ui/movimento";

const SUGESTOES: Array<{ agente: EspecialistaIa; texto: string }> = [
  { agente: "analise", texto: "Quanto gastei este mês e com o quê?" },
  { agente: "financas", texto: "Lance R$ 45,90 de mercado hoje" },
  { agente: "agenda", texto: "Marque dentista na sexta às 15h" },
  { agente: "metas", texto: "Crie uma meta de R$ 5.000 para viagem até julho" },
  { agente: "organizacao", texto: "Quais grupos e sessões eu tenho?" },
  { agente: "extratos", texto: "O que falta conferir no extrato deste mês?" },
];

export function Vazio({
  configurado,
  podeConfigurar,
  nome,
  onSugerir,
}: {
  configurado: boolean;
  podeConfigurar: boolean;
  nome: string;
  onSugerir: (texto: string) => void;
}) {
  return (
    <Cascata className="grid gap-8 py-8" intervalo={0.06}>
      <Passo className="grid justify-items-start gap-3">
        <motion.span
          aria-hidden
          className="size-6 bg-cta"
          initial={{ rotate: -45, scale: 0.6 }}
          animate={{ rotate: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 180, damping: 12 }}
        />
        <h2 className="font-display text-xl tab:text-2xl">{nome ? `Como posso ajudar, ${nome}?` : "Como posso ajudar?"}</h2>
        <p className="max-w-prose text-ink-2">
          Peça em português, como pediria a alguém. Uma equipe de especialistas faz o trabalho no sistema por você e pergunta
          quando precisar escolher.
        </p>
      </Passo>

      {!configurado ? (
        <Passo className="grid gap-3 border border-dashed border-pending-line bg-pending-soft p-4">
          <p className="etiqueta text-pending">Falta um passo</p>
          <p>
            {podeConfigurar
              ? "Conecte um provedor de IA (OpenAI, Anthropic, Gemini, OpenRouter, Ollama...) e escolha o modelo."
              : "O usuário master da conta precisa conectar um provedor de IA."}
          </p>
          {podeConfigurar ? (
            <Link href="/configuracoes?secao=ia-provedores" className="font-medium text-brand underline-offset-4 hover:underline">
              Configurar a inteligência artificial
            </Link>
          ) : null}
        </Passo>
      ) : null}

      <div role="group" className="grid gap-3 tab:grid-cols-2 desk:grid-cols-3" aria-label="Sugestões">
        {SUGESTOES.map((sugestao) => (
          <Passo key={sugestao.texto}>
            <motion.button
              type="button"
              disabled={!configurado}
              whileHover={configurado ? { y: -3 } : undefined}
              whileTap={configurado ? { scale: 0.98 } : undefined}
              onClick={() => onSugerir(sugestao.texto)}
              className={cn(
                "grid h-full w-full gap-2 border border-line bg-surface p-4 text-left transition-colors hover:border-brand disabled:cursor-default disabled:opacity-50",
                focusRing,
              )}
            >
              <span className="etiqueta text-brand">{INFO_DOS_AGENTES[sugestao.agente].nome}</span>
              <span>{sugestao.texto}</span>
            </motion.button>
          </Passo>
        ))}
      </div>
    </Cascata>
  );
}
