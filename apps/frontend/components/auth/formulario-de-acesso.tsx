"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { SENHA_MINIMA } from "@finnagent/contracts";
import { AnimatePresence, animate, motion, useReducedMotion } from "motion/react";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "../ui/button";
import { cn } from "../ui/cn";
import { Cascata, Passo, mola } from "../ui/movimento";
import { useToast } from "../ui/toast";
import { CampoDeSenha } from "./campo-de-senha";
import { CampoDeTexto } from "./campo-de-texto";
import { definirEstadoDoAcesso } from "./estado-do-acesso";
import { forcaDaSenha } from "./forca-da-senha";

type Modo = "entrar" | "cadastro";
type Campo = "name" | "email" | "password";

const textos = {
  entrar: {
    etiqueta: "Acesso",
    titulo: "Entre no Prumo",
    subtitulo: "Use o e-mail e a senha da sua conta.",
    enviar: "Entrar",
    enviando: "Entrando…",
    pronto: "Pronto",
    troca: "Ainda não tem conta?",
    trocaLink: "Criar conta",
    trocaPara: "/cadastro",
  },
  cadastro: {
    etiqueta: "Nova conta",
    titulo: "Crie sua conta",
    subtitulo: "Você será o master da conta e poderá adicionar outras pessoas. Seus dados ficam só nela.",
    enviar: "Criar conta",
    enviando: "Criando…",
    pronto: "Conta criada",
    troca: "Já tem conta?",
    trocaLink: "Entrar",
    trocaPara: "/login",
  },
} as const;

const tomDaForca = ["bg-line", "bg-neg", "bg-pending", "bg-pos", "bg-pos"] as const;

export function FormularioDeAcesso({
  modo,
  proximo,
  expirou = false,
  semLogin = false,
}: {
  modo: Modo;
  proximo: string;
  expirou?: boolean;
  /** Desenvolvimento: o login não é exigido. Só a tela de entrada mostra o atalho. */
  semLogin?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const reduzir = useReducedMotion();
  const texto = textos[modo];
  const base = useId();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [invalido, setInvalido] = useState<Campo | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [concluido, setConcluido] = useState(false);
  const nomeRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const senhaRef = useRef<HTMLInputElement>(null);
  const caixaRef = useRef<HTMLDivElement>(null);
  const forca = forcaDaSenha(senha);
  const ids = { name: `${base}-nome`, email: `${base}-email`, password: `${base}-senha`, forca: `${base}-forca` };
  const rotuloDoBotao = concluido ? texto.pronto : enviando ? texto.enviando : texto.enviar;

  useEffect(() => {
    if (expirou) toast.alerta("Sua sessão expirou. Entre de novo.");
  }, [expirou, toast]);

  // O fio de prumo do painel volta ao repouso se a pessoa sair da tela no meio do envio.
  useEffect(() => () => definirEstadoDoAcesso("ocioso"), []);

  /** O formulário chacoalha e o fio de prumo treme: o erro se vê, além de aparecer no aviso. */
  function reagirAoErro() {
    definirEstadoDoAcesso("erro");
    window.setTimeout(() => definirEstadoDoAcesso("ocioso"), 900);
    if (reduzir || !caixaRef.current) return;
    animate(caixaRef.current, { x: [0, -10, 10, -8, 8, -4, 0] }, { duration: 0.45, ease: "easeOut" });
  }

  function recusar(campoComErro: Campo, mensagem: string) {
    setInvalido(campoComErro);
    toast.erro(mensagem);
    reagirAoErro();
    const alvo = { name: nomeRef, email: emailRef, password: senhaRef }[campoComErro];
    alvo.current?.focus();
  }

  async function enviar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (enviando) return;
    setInvalido(null);
    if (modo === "cadastro" && !nome.trim()) return recusar("name", "Informe seu nome.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return recusar("email", "Informe um e-mail válido.");
    if (!senha) return recusar("password", "Informe a senha.");
    if (modo === "cadastro" && senha.length < SENHA_MINIMA) {
      return recusar("password", `A senha precisa ter ao menos ${SENHA_MINIMA} caracteres.`);
    }

    setEnviando(true);
    definirEstadoDoAcesso("enviando");
    try {
      const resposta = await fetch(`/api/auth/${modo}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(modo === "cadastro" ? { name: nome, email, password: senha } : { email, password: senha }),
      });
      const corpo = (await resposta.json().catch(() => ({}))) as { message?: string };
      if (!resposta.ok) {
        setSenha("");
        setEnviando(false);
        if (resposta.status === 409) return recusar("email", corpo.message ?? "Já existe uma conta com este e-mail.");
        if (resposta.status === 400) return recusar(modo === "cadastro" ? "password" : "email", corpo.message ?? "Confira os dados.");
        toast.erro(corpo.message ?? "Não foi possível entrar. Tente de novo.");
        reagirAoErro();
        senhaRef.current?.focus();
        return;
      }
      // O prumo assenta e o botão confirma antes de a tela trocar. O botão segue travado: um segundo clique não reenvia.
      setConcluido(true);
      definirEstadoDoAcesso("ok");
      if (!reduzir) await new Promise((resolver) => window.setTimeout(resolver, 600));
      router.replace(proximo);
      router.refresh();
    } catch {
      setEnviando(false);
      toast.erro("Não foi possível conectar. Confira a internet e tente de novo.");
      reagirAoErro();
    }
  }

  const alternar = proximo === "/" ? texto.trocaPara : `${texto.trocaPara}?proximo=${encodeURIComponent(proximo)}`;

  return (
    <Cascata className="grid w-full min-w-0 max-w-sm gap-6" atraso={0.25}>
      <Passo className="grid gap-3">
        <p className="etiqueta text-brand">{texto.etiqueta}</p>
        <h1 className="font-display text-xl tab:text-2xl">{texto.titulo}</h1>
        <p className="text-ink-2">{texto.subtitulo}</p>
      </Passo>

      {semLogin ? (
        <Passo role="note" className="grid gap-3 border border-pending-line bg-pending-soft p-4">
          <p className="etiqueta text-pending">Modo desenvolvimento</p>
          <p className="text-sm">O login não é exigido neste ambiente.</p>
          <Link href={proximo} className="text-sm font-medium text-brand underline-offset-4 hover:underline">
            Continuar sem entrar
          </Link>
        </Passo>
      ) : null}

      <div ref={caixaRef}>
        <form onSubmit={enviar} noValidate className="grid gap-4">
          {modo === "cadastro" ? (
            <Passo>
              <CampoDeTexto
                id={ids.name}
                rotulo="Nome"
                inputRef={nomeRef}
                name="name"
                type="text"
                value={nome}
                autoComplete="name"
                autoFocus
                maxLength={80}
                invalido={invalido === "name"}
                onChange={(event) => setNome(event.target.value)}
              />
            </Passo>
          ) : null}

          <Passo>
            <CampoDeTexto
              id={ids.email}
              rotulo="E-mail"
              inputRef={emailRef}
              name="email"
              type="email"
              inputMode="email"
              value={email}
              autoComplete={modo === "entrar" ? "username" : "email"}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              autoFocus={modo === "entrar"}
              maxLength={254}
              invalido={invalido === "email"}
              onChange={(event) => setEmail(event.target.value)}
            />
          </Passo>

          <Passo>
            <CampoDeSenha
              id={ids.password}
              rotulo="Senha"
              inputRef={senhaRef}
              autoComplete={modo === "entrar" ? "current-password" : "new-password"}
              value={senha}
              invalido={invalido === "password"}
              descricao={modo === "cadastro" ? ids.forca : undefined}
              onChange={setSenha}
            >
              {modo === "cadastro" ? (
                <div id={ids.forca} className="grid gap-2">
                  <div aria-hidden className="grid grid-cols-4 gap-1">
                    {[1, 2, 3, 4].map((parte) => (
                      <span key={parte} className="relative h-1 overflow-hidden bg-line">
                        {/* Cada trecho enche da esquerda para a direita, com a cor do nível. */}
                        <motion.span
                          className={cn("absolute inset-0 origin-left", tomDaForca[forca.nivel])}
                          initial={false}
                          animate={{ scaleX: forca.nivel >= parte ? 1 : 0 }}
                          transition={mola}
                        />
                      </span>
                    ))}
                  </div>
                  <p className="text-sm text-ink-2" aria-live="polite">
                    {forca.rotulo ? `Senha ${forca.rotulo.toLowerCase()}. ` : ""}Use {SENHA_MINIMA} ou mais caracteres.
                  </p>
                </div>
              ) : null}
            </CampoDeSenha>
          </Passo>

          <Passo whileTap={{ scale: 0.985 }}>
            <Button
              type="submit"
              variant="primary"
              disabled={enviando}
              aria-busy={enviando}
              className="relative w-full overflow-hidden"
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={rotuloDoBotao}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.15 }}
                >
                  {rotuloDoBotao}
                </motion.span>
              </AnimatePresence>
              {enviando && !concluido ? (
                // Barra que corre no pé do botão enquanto o servidor confere os dados.
                <motion.span
                  aria-hidden
                  className="absolute bottom-0 left-0 h-1 w-1/3 bg-cta-ink/30"
                  animate={{ x: ["-100%", "300%"] }}
                  transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
                />
              ) : null}
            </Button>
          </Passo>
        </form>
      </div>

      <Passo className="grid gap-3 border-t border-line pt-6">
        <p className="text-sm text-ink-2">
          {texto.troca}{" "}
          <Link href={alternar} className="font-medium text-brand underline-offset-4 hover:underline">
            {texto.trocaLink}
          </Link>
        </p>
        <p className="etiqueta text-ink-2">Sessão válida por 7 dias neste aparelho</p>
      </Passo>
    </Cascata>
  );
}
