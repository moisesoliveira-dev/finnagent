"use client";

import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "motion/react";
import { useEffect, useState } from "react";
import { Chip } from "../ui/chip";
import { cn } from "../ui/cn";
import { Money } from "../ui/money";
import { Cascata, ItemAnimado, ListaAnimada, Passo, curvaCheia, curvaSaida, mola } from "../ui/movimento";
import { PendingAction } from "../ui/pending-action";
import { Stat } from "../ui/stat";
import { FioDePrumo } from "./fio-de-prumo";

const garantias = [
  "Cada conta enxerga só os próprios dados",
  "Senha guardada com scrypt, nunca em texto",
  "Sessão em cookie httpOnly, que o navegador não deixa o JavaScript ler",
];

const frase = ["Seu", "dia", "e", "seu", "dinheiro,", "no", "mesmo", "lugar."];

export function Marca({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2 font-display text-lg font-bold tracking-titulo text-ink", className)}>
      {/* O quadrado cai no lugar, como um peso de prumo. */}
      <motion.span
        aria-hidden
        suppressHydrationWarning
        className="size-3 shrink-0 bg-cta"
        initial={{ y: -16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ ...mola, delay: 0.1 }}
      />
      Prumo
    </div>
  );
}

function Linha({ evento = false, children }: { evento?: boolean; children: React.ReactNode }) {
  return (
    <ItemAnimado
      className={cn(
        "flex min-w-0 items-center gap-3 border-b border-line px-4 py-3 last:border-b-0",
        evento && "border-l-4 border-l-event",
      )}
    >
      {children}
    </ItemAnimado>
  );
}

/**
 * Conta do zero até o valor, para o exemplo parecer vivo. Quem pede menos movimento chega ao valor
 * final de uma vez. O primeiro desenho é sempre o mesmo, no servidor e no cliente, para não quebrar a hidratação.
 */
function ValorAnimado({ cents, atraso = 0 }: { cents: number; atraso?: number }) {
  const reduzir = useReducedMotion();
  const [valor, setValor] = useState(0);

  useEffect(() => {
    const contagem = animate(0, cents, {
      duration: reduzir ? 0 : 1.5,
      delay: reduzir ? 0 : atraso,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (passo) => setValor(Math.round(passo)),
    });
    return () => contagem.stop();
  }, [cents, atraso, reduzir]);

  return <Money cents={valor} />;
}

/** A sugestão da IA que a pessoa confirma, em ciclo, para contar como o produto funciona. */
function SugestaoDaIa({ aceita }: { aceita: boolean }) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={aceita ? "aceita" : "aberta"}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0, transition: curvaCheia }}
        exit={{ opacity: 0, y: -8, transition: curvaSaida }}
      >
        <PendingAction state={aceita ? "done" : "open"} title="Mercado em Alimentação">
          <p className="text-sm text-ink-2">
            {aceita ? "Confirmado por você. Entrou no extrato." : "Categoria sugerida a partir do seu extrato."}
          </p>
        </PendingAction>
      </motion.div>
    </AnimatePresence>
  );
}

/** Lado esquerdo da tela de acesso: o que o produto faz, com um mês de exemplo. Só aparece a partir de 1100 px. */
export function PainelDaMarca() {
  const reduzir = useReducedMotion();
  const [aceita, setAceita] = useState(false);

  // Ponteiro sobre o painel: o cartão se inclina um pouco e a trama de pontos desliza em sentido contrário.
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const molex = useSpring(x, { stiffness: 90, damping: 18 });
  const moley = useSpring(y, { stiffness: 90, damping: 18 });
  const inclinarY = useTransform(molex, [-0.5, 0.5], [-5, 5]);
  const inclinarX = useTransform(moley, [-0.5, 0.5], [4, -4]);
  const tramaX = useTransform(molex, [-0.5, 0.5], [6, -6]);
  const tramaY = useTransform(moley, [-0.5, 0.5], [6, -6]);

  useEffect(() => {
    if (reduzir) return;
    let ciclo: ReturnType<typeof setInterval> | undefined;
    const inicio = setTimeout(() => {
      setAceita(true);
      ciclo = setInterval(() => setAceita((atual) => !atual), 3600);
    }, 3200);
    return () => {
      clearTimeout(inicio);
      if (ciclo) clearInterval(ciclo);
    };
  }, [reduzir]);

  function seguir(event: React.PointerEvent<HTMLElement>) {
    if (reduzir || event.pointerType !== "mouse") return;
    const caixa = event.currentTarget.getBoundingClientRect();
    x.set((event.clientX - caixa.left) / caixa.width - 0.5);
    y.set((event.clientY - caixa.top) / caixa.height - 0.5);
  }

  function soltar() {
    x.set(0);
    y.set(0);
  }

  return (
    <motion.aside
      aria-label="Sobre o Prumo"
      className="pontos sem-barra relative hidden min-w-0 flex-col justify-between gap-8 overflow-y-auto border-r border-line bg-bg px-12 py-8 desk:sticky desk:top-0 desk:flex desk:h-dvh"
      style={{ backgroundPositionX: tramaX, backgroundPositionY: tramaY }}
      onPointerMove={seguir}
      onPointerLeave={soltar}
    >
      <FioDePrumo className="pointer-events-none absolute top-0 right-12 flex h-1/3 w-3 flex-col items-center" />

      <Cascata className="contents" atraso={0.1} intervalo={0.12}>
        <Passo>
          <Marca />
        </Passo>

        <div className="grid max-w-prose gap-8">
          <div className="grid gap-4">
            <Passo>
              <p className="etiqueta text-brand">Agenda e finanças</p>
            </Passo>
            <motion.p
              suppressHydrationWarning
              className="font-display text-2xl font-bold tracking-titulo"
              initial="oculto"
              animate="visivel"
              variants={{ oculto: {}, visivel: { transition: { staggerChildren: 0.06, delayChildren: 0.35 } } }}
            >
              {frase.map((palavra, indice) => (
                // Cada palavra sobe de dentro de uma máscara, uma depois da outra.
                <span key={`${palavra}-${indice}`} className="inline-block overflow-hidden pb-1 align-bottom">
                  <motion.span
                    suppressHydrationWarning
                    className="inline-block"
                    variants={{ oculto: { y: "110%" }, visivel: { y: 0, transition: curvaCheia } }}
                  >
                    {palavra}
                    {indice < frase.length - 1 ? " " : ""}
                  </motion.span>
                </span>
              ))}
            </motion.p>
            <Passo>
              <p className="max-w-prose text-ink-2">
                Compromissos e lançamentos lado a lado. O assistente sugere, você confirma.
              </p>
            </Passo>
          </div>

          <Passo>
            <motion.figure
              suppressHydrationWarning
              className="grid border border-line bg-surface"
              style={{ rotateX: inclinarX, rotateY: inclinarY, transformPerspective: 900 }}
            >
              <figcaption className="etiqueta flex items-center justify-between border-b border-line bg-surface-2 px-4 py-3 text-ink-2">
                Outubro
                <Chip>Exemplo</Chip>
              </figcaption>
              <dl className="grid grid-cols-3 gap-4 border-b border-line p-4">
                <Stat label="Entradas">
                  <ValorAnimado cents={620000} atraso={0.9} />
                </Stat>
                <Stat label="Saídas">
                  <ValorAnimado cents={-238000} atraso={1.05} />
                </Stat>
                <Stat label="Saldo">
                  <ValorAnimado cents={382000} atraso={1.2} />
                </Stat>
              </dl>
              <ListaAnimada className="grid">
                <Linha>
                  <span className="min-w-0 flex-1 font-medium">Aluguel</span>
                  <Chip>Fixa</Chip>
                  <Money cents={-180000} />
                </Linha>
                <Linha>
                  <span className="min-w-0 flex-1 font-medium">Mercado</span>
                  <Chip tone={aceita ? "ok" : "default"}>{aceita ? "Alimentação" : "Avulsa"}</Chip>
                  <Money cents={-58000} />
                </Linha>
                <Linha evento>
                  <span className="min-w-0 flex-1 font-medium">Dentista, 15h</span>
                  <Chip>Compromisso</Chip>
                </Linha>
              </ListaAnimada>
              <div className="border-t border-line p-4">
                <SugestaoDaIa aceita={aceita} />
              </div>
            </motion.figure>
          </Passo>
        </div>

        <Passo>
          <ul className="grid gap-3">
            {garantias.map((texto) => (
              <li key={texto} className="flex items-center gap-3 text-sm text-ink-2">
                <span aria-hidden className="size-2 shrink-0 bg-brand" />
                {texto}
              </li>
            ))}
          </ul>
        </Passo>
      </Cascata>
    </motion.aside>
  );
}
