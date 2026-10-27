"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { SENHA_MINIMA } from "@finnagent/contracts";
import { useEffect, useId, useRef, useState } from "react";
import { Aparecer } from "../ui/movimento";
import { Button } from "../ui/button";
import { cn } from "../ui/cn";
import { useToast } from "../ui/toast";
import { CampoDeSenha } from "./campo-de-senha";
import { CampoDeTexto } from "./campo-de-texto";
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
    troca: "Ainda não tem conta?",
    trocaLink: "Criar conta",
    trocaPara: "/cadastro",
  },
  cadastro: {
    etiqueta: "Nova conta",
    titulo: "Crie sua conta",
    subtitulo: "Leva menos de um minuto. Seus dados ficam só na sua conta.",
    enviar: "Criar conta",
    enviando: "Criando…",
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
}: {
  modo: Modo;
  proximo: string;
  expirou?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const texto = textos[modo];
  const base = useId();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [invalido, setInvalido] = useState<Campo | null>(null);
  const [enviando, setEnviando] = useState(false);
  const nomeRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const senhaRef = useRef<HTMLInputElement>(null);
  const forca = forcaDaSenha(senha);
  const ids = { name: `${base}-nome`, email: `${base}-email`, password: `${base}-senha`, forca: `${base}-forca` };

  useEffect(() => {
    if (expirou) toast.alerta("Sua sessão expirou. Entre de novo.");
  }, [expirou, toast]);

  function recusar(campoComErro: Campo, mensagem: string) {
    setInvalido(campoComErro);
    toast.erro(mensagem);
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
        senhaRef.current?.focus();
        return;
      }
      // Mantém o botão travado: a tela troca em seguida, e um segundo clique não deve reenviar.
      router.replace(proximo);
      router.refresh();
    } catch {
      setEnviando(false);
      toast.erro("Não foi possível conectar. Confira a internet e tente de novo.");
    }
  }

  const alternar = proximo === "/" ? texto.trocaPara : `${texto.trocaPara}?proximo=${encodeURIComponent(proximo)}`;

  return (
    <Aparecer className="grid w-full min-w-0 max-w-sm gap-6">
      <div className="grid gap-3">
        <p className="etiqueta text-brand">{texto.etiqueta}</p>
        <h1 className="font-display text-xl tab:text-2xl">{texto.titulo}</h1>
        <p className="text-ink-2">{texto.subtitulo}</p>
      </div>

      <form onSubmit={enviar} noValidate className="grid gap-4">
        {modo === "cadastro" ? (
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
        ) : null}

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
                  <span key={parte} className={cn("h-1", forca.nivel >= parte ? tomDaForca[forca.nivel] : "bg-line")} />
                ))}
              </div>
              <p className="text-sm text-ink-2" aria-live="polite">
                {forca.rotulo ? `Senha ${forca.rotulo.toLowerCase()}. ` : ""}Use {SENHA_MINIMA} ou mais caracteres.
              </p>
            </div>
          ) : null}
        </CampoDeSenha>

        <Button type="submit" variant="primary" disabled={enviando} aria-busy={enviando} className="w-full">
          {enviando ? texto.enviando : texto.enviar}
        </Button>
      </form>

      <div className="grid gap-3 border-t border-line pt-6">
        <p className="text-sm text-ink-2">
          {texto.troca}{" "}
          <Link href={alternar} className="font-medium text-brand underline-offset-4 hover:underline">
            {texto.trocaLink}
          </Link>
        </p>
        <p className="etiqueta text-ink-2">Sessão válida por 7 dias neste aparelho</p>
      </div>
    </Aparecer>
  );
}
