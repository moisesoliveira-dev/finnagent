"use client";

import { SENHA_MINIMA, type UsuarioDaConta } from "@finnagent/contracts";
import { useEffect, useRef, useState } from "react";
import { CampoDeSenha } from "../../components/auth/campo-de-senha";
import { CampoDeTexto } from "../../components/auth/campo-de-texto";
import { Button } from "../../components/ui/button";
import { Chip } from "../../components/ui/chip";
import { Dialogo } from "../../components/ui/dialogo";
import { ItemAnimado, ListaAnimada } from "../../components/ui/movimento";
import { useToast } from "../../components/ui/toast";

type Campo = "name" | "email" | "password";

async function ler<T>(resposta: Response, padrao: string) {
  const corpo = (await resposta.json().catch(() => ({}))) as T & { message?: string };
  if (!resposta.ok) throw new Error(corpo.message || padrao);
  return corpo;
}

async function buscar() {
  const eu = await ler<UsuarioDaConta>(await fetch("/api/auth/eu"), "Não foi possível carregar o usuário.");
  const lista =
    eu.role === "master" ? await ler<UsuarioDaConta[]>(await fetch("/api/usuarios"), "Falha ao listar.") : [];
  return { eu, lista };
}

/** Usuários da conta. Só o master lista, cria e remove; o membro vê só o aviso. */
export function Usuarios({ visivel }: { visivel: boolean }) {
  const toast = useToast();
  const [eu, setEu] = useState<UsuarioDaConta | null>(null);
  const [lista, setLista] = useState<UsuarioDaConta[]>([]);
  const [falhou, setFalhou] = useState(false);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [invalido, setInvalido] = useState<Campo | null>(null);
  const [apagando, setApagando] = useState<UsuarioDaConta | null>(null);
  const [enviando, setEnviando] = useState(false);
  const novo = useRef<HTMLDialogElement>(null);
  const exclusao = useRef<HTMLDialogElement>(null);
  const nomeRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const senhaRef = useRef<HTMLInputElement>(null);

  function aplicar(dados: { eu: UsuarioDaConta; lista: UsuarioDaConta[] }) {
    setEu(dados.eu);
    setLista(dados.lista);
    setFalhou(false);
  }

  function carregar() {
    return buscar()
      .then(aplicar)
      .catch(() => setFalhou(true));
  }

  useEffect(() => {
    let vivo = true;
    buscar()
      .then((dados) => {
        if (vivo) aplicar(dados);
      })
      .catch(() => {
        if (vivo) setFalhou(true);
      });
    return () => {
      vivo = false;
    };
  }, []);

  function recusar(campo: Campo, mensagem: string) {
    setInvalido(campo);
    toast.erro(mensagem);
    ({ name: nomeRef, email: emailRef, password: senhaRef })[campo].current?.focus();
  }

  function abrir() {
    setNome("");
    setEmail("");
    setSenha("");
    setInvalido(null);
    novo.current?.showModal();
  }

  async function criar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (enviando) return;
    setInvalido(null);
    if (!nome.trim()) return recusar("name", "Informe o nome.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return recusar("email", "Informe um e-mail válido.");
    if (senha.length < SENHA_MINIMA) return recusar("password", `A senha precisa ter ao menos ${SENHA_MINIMA} caracteres.`);
    setEnviando(true);
    try {
      await ler(
        await fetch("/api/usuarios", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: nome, email, password: senha }),
        }),
        "Não foi possível criar o usuário.",
      );
      toast.sucesso(`${nome.trim()} agora tem acesso`);
      novo.current?.close();
      await carregar();
    } catch (error) {
      toast.erro(error instanceof Error ? error.message : "Não foi possível criar o usuário.");
    } finally {
      setEnviando(false);
    }
  }

  async function remover() {
    if (!apagando) return;
    setEnviando(true);
    try {
      const resposta = await fetch(`/api/usuarios/${apagando.id}`, { method: "DELETE" });
      if (!resposta.ok) await ler(resposta, "Não foi possível remover o usuário.");
      toast.sucesso(`${apagando.name} foi removido`);
      exclusao.current?.close();
      await carregar();
    } catch (error) {
      toast.erro(error instanceof Error ? error.message : "Não foi possível remover o usuário.");
    } finally {
      setEnviando(false);
    }
  }

  const master = eu?.role === "master";

  return (
    <section hidden={!visivel} className="grid gap-4 rounded-lg border border-line bg-surface p-6" aria-labelledby="titulo-usuarios">
      <h2 id="titulo-usuarios" className="font-display text-lg">
        Usuários
      </h2>

      {falhou ? (
        <div className="grid justify-items-start gap-3">
          <p>Não foi possível carregar os usuários.</p>
          <Button onClick={() => void carregar()}>Tentar de novo</Button>
        </div>
      ) : !eu ? (
        <p className="text-ink-2">Carregando…</p>
      ) : !master ? (
        <p className="max-w-prose text-ink-2">
          Você usa esta conta como membro. Só o usuário master cria e remove usuários.
        </p>
      ) : (
        <>
          <p className="max-w-prose text-sm text-ink-2">
            Você é o usuário master desta conta, e cada conta tem um só. Quem você adicionar entra com e-mail e senha e vê
            os mesmos dados.
          </p>
          <ListaAnimada className="overflow-hidden rounded-lg border border-line">
            {lista.map((usuario) => (
              <ItemAnimado
                key={usuario.id}
                className="flex min-w-0 items-center gap-3 border-b border-line px-4 py-3 last:border-b-0"
              >
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="truncate font-medium">{usuario.name}</span>
                  <span className="truncate text-sm text-ink-2">{usuario.email}</span>
                </div>
                <Chip tone={usuario.role === "master" ? "ok" : "default"}>
                  {usuario.role === "master" ? "Master" : "Membro"}
                </Chip>
                {usuario.role === "membro" ? (
                  <Button
                    variant="danger"
                    onClick={() => {
                      setApagando(usuario);
                      exclusao.current?.showModal();
                    }}
                  >
                    Remover
                  </Button>
                ) : null}
              </ItemAnimado>
            ))}
          </ListaAnimada>
          <div>
            <Button variant="primary" onClick={abrir}>
              Adicionar usuário
            </Button>
          </div>
        </>
      )}

      <Dialogo ref={novo} aria-labelledby="titulo-novo-usuario">
        <form onSubmit={(event) => void criar(event)} noValidate>
          <div className="dialog-corpo grid gap-4">
            <h2 id="titulo-novo-usuario" className="font-display text-lg">
              Adicionar usuário
            </h2>
            <CampoDeTexto
              id="usuario-nome"
              rotulo="Nome"
              inputRef={nomeRef}
              name="name"
              value={nome}
              autoComplete="off"
              maxLength={80}
              invalido={invalido === "name"}
              onChange={(event) => setNome(event.target.value)}
            />
            <CampoDeTexto
              id="usuario-email"
              rotulo="E-mail"
              inputRef={emailRef}
              name="email"
              type="email"
              inputMode="email"
              value={email}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              maxLength={254}
              invalido={invalido === "email"}
              onChange={(event) => setEmail(event.target.value)}
            />
            <CampoDeSenha
              id="usuario-senha"
              rotulo="Senha inicial"
              inputRef={senhaRef}
              autoComplete="new-password"
              value={senha}
              invalido={invalido === "password"}
              onChange={setSenha}
            >
              <p className="text-sm text-ink-2">
                Passe esta senha à pessoa. Use {SENHA_MINIMA} ou mais caracteres.
              </p>
            </CampoDeSenha>
          </div>
          <div className="dialog-acoes">
            <Button type="button" variant="quiet" onClick={() => novo.current?.close()}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" disabled={enviando}>
              Adicionar
            </Button>
          </div>
        </form>
      </Dialogo>

      <Dialogo ref={exclusao} aria-labelledby="titulo-remover-usuario" onClose={() => setApagando(null)}>
        <div className="dialog-corpo grid gap-4">
          <h2 id="titulo-remover-usuario" className="font-display text-lg">
            Remover este usuário?
          </h2>
          <p>
            {apagando?.name} perde o acesso agora. Os dados da conta continuam com você.
          </p>
        </div>
        <div className="dialog-acoes">
          <Button variant="quiet" onClick={() => exclusao.current?.close()}>
            Cancelar
          </Button>
          <Button variant="danger" disabled={enviando} onClick={() => void remover()}>
            Remover
          </Button>
        </div>
      </Dialogo>
    </section>
  );
}
