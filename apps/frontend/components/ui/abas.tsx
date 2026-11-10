"use client";

import { motion } from "motion/react";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ComponentProps,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { cn, focusRing } from "./cn";
import { Painel, useCurva } from "./movimento";

export type Aba<T extends string> = { id: T; label: string };

type Validavel = HTMLElement & { reportValidity?: () => boolean };

/**
 * Formulário em abas. Os painéis ficam todos montados, então os campos de uma aba escondida continuam
 * no envio e na validação do navegador. Se o campo inválido está em outra aba, ela abre e o aviso aparece nele;
 * a aba com problema ganha um ponto até o campo ficar certo.
 */
export function useAbas<T extends string>(abas: readonly Aba<T>[], inicial: T) {
  const [escolhida, setEscolhida] = useState<T>(inicial);
  const [direcao, setDirecao] = useState(0);
  const [erros, setErros] = useState<T[]>([]);
  const tentou = useRef(false);
  const relato = useRef<"livre" | "trocando" | "aqui">("livre");
  const prefixo = useId();
  const aba = abas.some((item) => item.id === escolhida) ? escolhida : (abas[0]?.id ?? inicial);
  const atual = useRef(aba);
  useEffect(() => {
    atual.current = aba;
  }, [aba]);

  const abasInvalidas = useCallback((form: HTMLFormElement) => {
    const ids = new Set<T>();
    form.querySelectorAll<HTMLElement>(":invalid").forEach((el) => {
      if (el instanceof HTMLFormElement || el instanceof HTMLFieldSetElement) return;
      const id = el.closest<HTMLElement>("[data-aba]")?.dataset.aba;
      if (id) ids.add(id as T);
    });
    return [...ids];
  }, []);

  const escolher = useCallback((id: T, sentido = 0) => {
    setDirecao(sentido);
    setEscolhida(id);
    document.getElementById(`${prefixo}-painel-${id}`)?.closest(".dialog-corpo")?.scrollTo({ top: 0 });
  }, [prefixo]);

  /** Leva à aba e marca o problema dela, para a validação que o navegador não faz (como o valor). */
  const mostrarErro = useCallback(
    (id: T) => {
      tentou.current = true;
      setErros((lista) => (lista.includes(id) ? lista : [...lista, id]));
      if (id !== atual.current) escolher(id);
    },
    [escolher],
  );

  const reiniciar = useCallback((id: T = inicial) => {
    tentou.current = false;
    setErros([]);
    setDirecao(0);
    setEscolhida(id);
  }, [inicial]);

  function aoInvalidar(event: FormEvent<HTMLFormElement>) {
    tentou.current = true;
    if (relato.current === "trocando") {
      event.preventDefault();
      return;
    }
    if (relato.current === "aqui") return;
    const alvo = event.target as Validavel;
    const id = alvo.closest<HTMLElement>("[data-aba]")?.dataset.aba as T | undefined;
    setErros(abasInvalidas(event.currentTarget));
    if (id && id !== atual.current) {
      event.preventDefault();
      relato.current = "trocando";
      escolher(id);
      window.setTimeout(() => {
        window.requestAnimationFrame(() => {
          alvo.focus();
          alvo.reportValidity?.();
          relato.current = "livre";
        });
      }, 0);
      return;
    }
    relato.current = "aqui";
    window.setTimeout(() => {
      relato.current = "livre";
    }, 0);
  }

  function aoMudar(event: FormEvent<HTMLFormElement>) {
    if (!tentou.current) return;
    const form = event.currentTarget;
    window.setTimeout(() => setErros(abasInvalidas(form)), 0);
  }

  return { aba, direcao, erros, prefixo, abas, escolher, mostrarErro, reiniciar, aoInvalidar, aoMudar };
}

export type ControleDeAbas<T extends string> = ReturnType<typeof useAbas<T>>;

/** Faixa de abas no topo do diálogo: ativa em azul com a barra embaixo, como a navegação. Rola na horizontal. */
export function FaixaDeAbas<T extends string>({
  controle,
  className,
  ...props
}: Omit<ComponentProps<"div">, "children" | "role"> & { controle: ControleDeAbas<T> }) {
  const { abas, aba, erros, prefixo, escolher } = controle;
  const curva = useCurva();
  const faixa = useRef<HTMLDivElement>(null);
  const indice = abas.findIndex((item) => item.id === aba);

  useEffect(() => {
    const lista = faixa.current;
    const botao = lista?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!lista || !botao || lista.scrollWidth <= lista.clientWidth) return;
    const inicio = botao.offsetLeft - lista.offsetLeft;
    const fim = inicio + botao.offsetWidth;
    if (inicio < lista.scrollLeft) lista.scrollTo({ left: inicio - 24 });
    else if (fim > lista.scrollLeft + lista.clientWidth) lista.scrollTo({ left: fim - lista.clientWidth + 24 });
  }, [aba]);

  function teclar(event: KeyboardEvent<HTMLDivElement>) {
    const passos: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1 };
    let proximo: number | null = null;
    if (event.key in passos) proximo = (indice + passos[event.key] + abas.length) % abas.length;
    if (event.key === "Home") proximo = 0;
    if (event.key === "End") proximo = abas.length - 1;
    if (proximo == null) return;
    event.preventDefault();
    const alvo = abas[proximo];
    if (!alvo) return;
    escolher(alvo.id, Math.sign(proximo - indice));
    faixa.current?.querySelector<HTMLElement>(`#${CSS.escape(`${prefixo}-aba-${alvo.id}`)}`)?.focus();
  }

  return (
    <div
      ref={faixa}
      role="tablist"
      className={cn("sem-barra -mx-6 flex shrink-0 overflow-x-auto border-b border-line px-6", className)}
      onKeyDown={teclar}
      {...props}
    >
      {abas.map((item, posicao) => {
        const ativa = item.id === aba;
        const comErro = erros.includes(item.id);
        return (
          <button
            key={item.id}
            id={`${prefixo}-aba-${item.id}`}
            type="button"
            role="tab"
            aria-selected={ativa}
            aria-controls={`${prefixo}-painel-${item.id}`}
            tabIndex={ativa ? 0 : -1}
            className={cn(
              "etiqueta-botao relative inline-flex min-h-10 shrink-0 items-center gap-2 px-3 whitespace-nowrap transition-colors",
              focusRing,
              ativa ? "text-brand" : "text-ink-2 hover:text-ink",
            )}
            onClick={() => escolher(item.id, Math.sign(posicao - indice))}
          >
            {item.label}
            {comErro ? (
              <>
                <span aria-hidden className="size-2 shrink-0 rounded-full bg-neg" />
                <span className="sr-only">, com erro</span>
              </>
            ) : null}
            {ativa ? (
              <motion.span
                layoutId={`${prefixo}-barra`}
                className="absolute inset-x-0 bottom-0 h-0.5 bg-brand"
                transition={curva}
              />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function PainelDeAba<T extends string>({
  controle,
  id,
  className,
  children,
}: {
  controle: ControleDeAbas<T>;
  id: T;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Painel
      ativo={controle.aba === id}
      direcao={controle.direcao}
      id={`${controle.prefixo}-painel-${id}`}
      role="tabpanel"
      aria-labelledby={`${controle.prefixo}-aba-${id}`}
      data-aba={id}
      className={cn("grid min-w-0 content-start gap-8", className)}
    >
      {children}
    </Painel>
  );
}

/** Grupo de campos com título. Duas colunas do tablet em diante; `inteiro` ocupa a linha toda. */
export function Secao({
  titulo,
  colunas = 2,
  children,
}: {
  titulo: string;
  colunas?: 1 | 2;
  children: ReactNode;
}) {
  return (
    <section className="grid min-w-0 gap-3">
      <h3 className="flex items-center gap-3 text-ink-2">
        <span className="etiqueta shrink-0">{titulo}</span>
        <span aria-hidden className="h-px min-w-0 flex-1 bg-line" />
      </h3>
      <div className={cn("grid min-w-0 gap-4", colunas === 2 && "tab:grid-cols-2")}>{children}</div>
    </section>
  );
}

/** Classe do item que ocupa as duas colunas da `Secao`. */
export const inteiro = "tab:col-span-2";
