"use client";

import { AnimatePresence, motion } from "motion/react";
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useId, useMemo, useState, type ReactNode } from "react";
import { cn, focusRing } from "../ui/cn";
import { Icone } from "../ui/icone";
import { useCurva } from "../ui/movimento";
import { Segmentado } from "../ui/segmentado";
import { avaliar, formatarNumero } from "./expressao";

type Modo = "basica" | "avancada";
type Canto = "inferior-direito" | "inferior-esquerdo" | "superior-direito" | "superior-esquerdo";
type Conta = { expressao: string; valor: number };

const CANTOS: Canto[] = ["inferior-direito", "inferior-esquerdo", "superior-esquerdo", "superior-direito"];

const POSICAO: Record<Canto, string> = {
  "inferior-direito": "bottom-4 tab:right-4",
  "inferior-esquerdo": "bottom-4 tab:left-4",
  "superior-direito": "top-4 tab:right-4",
  "superior-esquerdo": "top-4 tab:left-4",
};

const NOME_DO_CANTO: Record<Canto, string> = {
  "inferior-direito": "embaixo à direita",
  "inferior-esquerdo": "embaixo à esquerda",
  "superior-direito": "em cima à direita",
  "superior-esquerdo": "em cima à esquerda",
};

type Estado = {
  aberta: boolean;
  fixada: boolean;
  alternar: () => void;
  fechar: () => void;
  /** O último resultado calculado, para outros campos usarem. Nulo antes da primeira conta. */
  resultado: number | null;
};

const Contexto = createContext<(Estado & { interno: Interno }) | null>(null);

type Interno = {
  expressao: string;
  setExpressao: (valor: string | ((atual: string) => string)) => void;
  modo: Modo;
  setModo: (modo: Modo) => void;
  canto: Canto;
  moverCanto: () => void;
  setFixada: (valor: boolean) => void;
  minimizada: boolean;
  setMinimizada: (valor: boolean) => void;
  historico: Conta[];
  memoria: number;
  setMemoria: (valor: number | ((atual: number) => number)) => void;
  calcular: () => void;
  setResultado: (valor: number | null) => void;
};

/**
 * A calculadora vale para o app inteiro e guarda a conta, a memória e o histórico enquanto a pessoa navega. Nada
 * vai para o navegador nem para o servidor: fechou o app, recomeça do zero. Fixada, ela fica aberta ao trocar de tela.
 */
export function CalculadoraProvider({ children }: { children: ReactNode }) {
  const [aberta, setAberta] = useState(false);
  const [fixada, setFixada] = useState(false);
  const [minimizada, setMinimizada] = useState(false);
  const [expressao, setExpressao] = useState("");
  const [modo, setModo] = useState<Modo>("basica");
  const [canto, setCanto] = useState<Canto>("inferior-direito");
  const [historico, setHistorico] = useState<Conta[]>([]);
  const [memoria, setMemoria] = useState(0);
  const [resultado, setResultado] = useState<number | null>(null);
  const pathname = usePathname();
  const [tela, setTela] = useState(pathname);

  // Solta, ela fecha ao trocar de tela; fixada, acompanha a pessoa. Ajuste no próprio render, sem efeito.
  if (tela !== pathname) {
    setTela(pathname);
    if (!fixada) setAberta(false);
  }

  const calcular = useCallback(() => {
    const conta = avaliar(expressao);
    if (!conta.ok) return;
    setHistorico((atual) => [{ expressao, valor: conta.valor }, ...atual].slice(0, 12));
    setResultado(conta.valor);
    setExpressao(String(conta.valor).replace(".", ","));
  }, [expressao]);

  const valor = useMemo(
    () => ({
      aberta,
      fixada,
      resultado,
      alternar: () => setAberta((atual) => !atual),
      fechar: () => setAberta(false),
      interno: {
        expressao,
        setExpressao,
        modo,
        setModo,
        canto,
        moverCanto: () => setCanto((atual) => CANTOS[(CANTOS.indexOf(atual) + 1) % CANTOS.length] ?? "inferior-direito"),
        setFixada,
        minimizada,
        setMinimizada,
        historico,
        memoria,
        setMemoria,
        calcular,
        setResultado,
      },
    }),
    [aberta, fixada, minimizada, resultado, expressao, modo, canto, historico, memoria, calcular],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useCalculadora() {
  const contexto = useContext(Contexto);
  if (!contexto) throw new Error("useCalculadora fora do CalculadoraProvider.");
  return contexto;
}

/** O botão do menu que abre e fecha a calculadora. */
export function BotaoDaCalculadora() {
  const { aberta, alternar, interno } = useCalculadora();
  const curva = useCurva();
  // O ícone fica fixo no canto de baixo e some enquanto a janela está aberta nesse mesmo canto.
  const embaixo = interno.canto === "inferior-direito";
  return (
    <AnimatePresence>
      {aberta && embaixo ? null : (
        <motion.button
          key="botao-da-calculadora"
          type="button"
          aria-label={aberta ? "Fechar a calculadora" : "Abrir a calculadora"}
          aria-pressed={aberta}
          title="Calculadora"
          onClick={alternar}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          whileTap={{ scale: 0.92 }}
          transition={curva}
          className={cn(
            "fixed right-4 bottom-4 z-30 inline-flex size-12 items-center justify-center border border-line bg-surface text-ink transition-colors hover:text-brand",
            aberta && "border-brand bg-brand-soft text-brand",
            focusRing,
          )}
        >
          <Icone name="calc" />
        </motion.button>
      )}
    </AnimatePresence>
  );
}

/** A janela flutuante, num canto da tela. Fica fora dos modais: dentro deles, use `PainelDaCalculadora`. */
export function JanelaDaCalculadora() {
  const { aberta, interno } = useCalculadora();
  const curva = useCurva();
  return (
    <AnimatePresence>
      {aberta ? (
        <motion.aside
          key="calculadora"
          aria-label="Calculadora"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={curva}
          className={cn("fixed inset-x-4 z-40 border border-line bg-surface tab:inset-x-auto tab:w-80", POSICAO[interno.canto])}
        >
          <PainelDaCalculadora flutuante />
        </motion.aside>
      ) : null}
    </AnimatePresence>
  );
}

const tecla = cn(
  "etiqueta-botao inline-flex min-h-10 items-center justify-center border border-line bg-surface px-2 text-ink transition-colors hover:bg-surface-2",
  focusRing,
);

/** O corpo da calculadora. `flutuante` mostra os controles da janela (canto, fixar, fechar). */
export function PainelDaCalculadora({ flutuante = false }: { flutuante?: boolean }) {
  const { fixada, fechar, interno } = useCalculadora();
  const { expressao, setExpressao, modo, setModo, historico, memoria, setMemoria, calcular, setResultado } = interno;
  const idDaConta = useId();
  const previa = expressao.trim() ? avaliar(expressao) : null;
  const [copiado, setCopiado] = useState(false);
  const [comHistorico, setComHistorico] = useState(false);
  // Minimizada, a janela flutuante mostra só o visor, para não cobrir a tela.
  const recolhida = flutuante && interno.minimizada;

  // O foco volta para a conta depois de cada tecla, para o teclado continuar valendo.
  function focar() {
    document.getElementById(idDaConta)?.focus();
  }

  function inserir(texto: string) {
    setExpressao((atual) => atual + texto);
    focar();
  }

  function sobreTudo(montar: (conta: string) => string) {
    setExpressao((atual) => (atual.trim() ? montar(atual.trim()) : atual));
    focar();
  }

  function valorAtual() {
    return previa?.ok ? previa.valor : null;
  }

  async function copiar() {
    const valor = valorAtual();
    if (valor === null) return;
    const texto = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(valor);
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1500);
    } catch {
      // Sem permissão para a área de transferência: o valor continua na tela.
    }
  }

  const basicas: { rotulo: string; acao: () => void; destaque?: boolean; nome?: string }[] = [
    { rotulo: "C", nome: "Limpar", acao: () => setExpressao("") },
    { rotulo: "⌫", nome: "Apagar o último", acao: () => setExpressao((atual) => atual.slice(0, -1)) },
    { rotulo: "%", nome: "Porcentagem", acao: () => inserir("%") },
    { rotulo: "÷", nome: "Dividir", acao: () => inserir(" ÷ ") },
    { rotulo: "7", acao: () => inserir("7") },
    { rotulo: "8", acao: () => inserir("8") },
    { rotulo: "9", acao: () => inserir("9") },
    { rotulo: "×", nome: "Multiplicar", acao: () => inserir(" × ") },
    { rotulo: "4", acao: () => inserir("4") },
    { rotulo: "5", acao: () => inserir("5") },
    { rotulo: "6", acao: () => inserir("6") },
    { rotulo: "−", nome: "Subtrair", acao: () => inserir(" − ") },
    { rotulo: "1", acao: () => inserir("1") },
    { rotulo: "2", acao: () => inserir("2") },
    { rotulo: "3", acao: () => inserir("3") },
    { rotulo: "+", nome: "Somar", acao: () => inserir(" + ") },
    { rotulo: "±", nome: "Trocar o sinal", acao: () => sobreTudo((conta) => (conta.startsWith("−(") && conta.endsWith(")") ? conta.slice(2, -1) : `−(${conta})`)) },
    { rotulo: "0", acao: () => inserir("0") },
    { rotulo: ",", nome: "Vírgula", acao: () => inserir(",") },
    { rotulo: "=", nome: "Calcular", acao: calcular, destaque: true },
  ];

  const avancadas: { rotulo: string; nome: string; acao: () => void }[] = [
    { rotulo: "(", nome: "Abrir parêntese", acao: () => inserir("(") },
    { rotulo: ")", nome: "Fechar parêntese", acao: () => inserir(")") },
    { rotulo: "x²", nome: "Ao quadrado", acao: () => sobreTudo((conta) => `(${conta})²`) },
    { rotulo: "xʸ", nome: "Potência", acao: () => inserir(" ^ ") },
    { rotulo: "√", nome: "Raiz quadrada", acao: () => inserir("√") },
    { rotulo: "1/x", nome: "Inverso", acao: () => sobreTudo((conta) => `1 ÷ (${conta})`) },
    { rotulo: "÷2", nome: "Dividir por 2", acao: () => sobreTudo((conta) => `(${conta}) ÷ 2`) },
    { rotulo: "÷3", nome: "Dividir por 3", acao: () => sobreTudo((conta) => `(${conta}) ÷ 3`) },
  ];

  const memorias: { rotulo: string; nome: string; acao: () => void }[] = [
    { rotulo: "MC", nome: "Limpar a memória", acao: () => setMemoria(0) },
    { rotulo: "MR", nome: "Usar a memória", acao: () => inserir(String(memoria).replace(".", ",")) },
    {
      rotulo: "M+",
      nome: "Somar à memória",
      acao: () => {
        const valor = valorAtual();
        if (valor !== null) setMemoria((atual) => atual + valor);
      },
    },
    {
      rotulo: "M−",
      nome: "Subtrair da memória",
      acao: () => {
        const valor = valorAtual();
        if (valor !== null) setMemoria((atual) => atual - valor);
      },
    },
  ];

  return (
    <div className="grid gap-3 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Segmentado<Modo>
          aria-label="Modo da calculadora"
          opcoes={[
            { id: "basica", label: "Básica" },
            { id: "avancada", label: "Avançada" },
          ]}
          valor={modo}
          onEscolher={(id) => setModo(id)}
        />
        {flutuante ? (
          <span className="ml-auto flex items-center gap-1">
            <button
              type="button"
              className={tecla}
              aria-expanded={!interno.minimizada}
              title={interno.minimizada ? "Mostrar as teclas" : "Minimizar: fica só o visor"}
              aria-label={interno.minimizada ? "Mostrar as teclas da calculadora" : "Minimizar a calculadora"}
              onClick={() => interno.setMinimizada(!interno.minimizada)}
            >
              {interno.minimizada ? "▢" : "—"}
            </button>
            <button
              type="button"
              className={cn(tecla, "hidden px-2 tab:inline-flex")}
              title={`Mudar de canto (agora ${NOME_DO_CANTO[interno.canto]})`}
              aria-label="Mudar a calculadora de canto"
              onClick={interno.moverCanto}
            >
              ⇲
            </button>
            <button
              type="button"
              className={cn(tecla, fixada && "border-brand bg-brand-soft text-brand hover:bg-brand-soft")}
              aria-pressed={fixada}
              title={fixada ? "Fixada: fica aberta ao trocar de tela" : "Fixar: fica aberta ao trocar de tela"}
              onClick={() => interno.setFixada(!fixada)}
            >
              {fixada ? "Fixada" : "Fixar"}
            </button>
            <button type="button" className={tecla} aria-label="Fechar a calculadora" onClick={fechar}>
              ✕
            </button>
          </span>
        ) : null}
      </div>

      <div className="grid gap-1 border border-line bg-surface-2 p-3">
        <input
          id={idDaConta}
          aria-label="Conta"
          inputMode="decimal"
          className="w-full bg-transparent text-right font-display text-lg font-bold tracking-titulo text-ink outline-none"
          placeholder="0"
          value={expressao}
          onChange={(event) => setExpressao(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === "=") {
              event.preventDefault();
              calcular();
            }
            if (event.key === "Escape" && expressao) {
              event.preventDefault();
              setExpressao("");
            }
          }}
        />
        <p className={cn("min-h-6 text-right text-sm tabular-nums", previa && !previa.ok ? "text-neg" : "text-ink-2")} aria-live="polite">
          {previa ? (previa.ok ? `= ${formatarNumero(previa.valor)}` : previa.erro) : memoria ? `Memória: ${formatarNumero(memoria)}` : " "}
        </p>
      </div>

      {recolhida ? null : (
      <>
      <AnimatePresence initial={false}>
        {modo === "avancada" ? (
          <motion.div
            key="avancada"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="grid gap-2 overflow-hidden"
          >
            <div className="grid grid-cols-4 gap-1">
              {avancadas.map((item) => (
                <button key={item.rotulo} type="button" className={tecla} title={item.nome} aria-label={item.nome} onClick={item.acao}>
                  {item.rotulo}
                </button>
              ))}
              {memorias.map((item) => (
                <button key={item.rotulo} type="button" className={cn(tecla, "text-ink-2")} title={item.nome} aria-label={item.nome} onClick={item.acao}>
                  {item.rotulo}
                </button>
              ))}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="grid grid-cols-4 gap-1">
        {basicas.map((item) => (
          <button
            key={item.rotulo}
            type="button"
            title={item.nome}
            aria-label={item.nome ?? item.rotulo}
            className={cn(tecla, item.destaque && "border-cta bg-cta text-cta-ink hover:bg-cta")}
            onClick={item.acao}
          >
            {item.rotulo}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={cn(tecla, "flex-1")} disabled={valorAtual() === null} onClick={() => void copiar()}>
          {copiado ? "Copiado" : "Copiar o resultado"}
        </button>
        {valorAtual() !== null ? (
          <button type="button" className={cn(tecla, "flex-1")} onClick={() => setResultado(valorAtual())} title="Guarda o valor para usar num campo de valor">
            Guardar para usar
          </button>
        ) : null}
      </div>

      {modo === "avancada" && historico.length ? (
        <button type="button" className={cn(tecla, "w-full")} aria-expanded={comHistorico} onClick={() => setComHistorico((atual) => !atual)}>
          {comHistorico ? "Esconder o histórico" : `Histórico (${historico.length})`}
        </button>
      ) : null}

      {modo === "avancada" && comHistorico && historico.length ? (
        <section aria-label="Histórico" className="grid gap-1">
          <ul className="grid max-h-40 gap-1 overflow-auto">
            {historico.map((conta, indice) => (
              <li key={`${conta.expressao}-${indice}`}>
                <button
                  type="button"
                  className={cn("flex w-full items-baseline justify-between gap-3 px-2 py-1 text-left text-sm hover:bg-surface-2", focusRing)}
                  title="Usar esta conta de novo"
                  onClick={() => setExpressao(conta.expressao)}
                >
                  <span className="min-w-0 truncate text-ink-2">{conta.expressao}</span>
                  <span className="font-bold">{formatarNumero(conta.valor)}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      </>
      )}
    </div>
  );
}
