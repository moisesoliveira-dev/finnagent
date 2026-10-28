"use client";

import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import {
  AJUSTES_DE_DIA_UTIL,
  CALENDARIO_NACIONAL,
  LEMBRETES,
  PADROES_DE_VENCIMENTO,
  REGRA_SEM_AJUSTE,
  ROTULO_DO_AJUSTE,
  ROTULO_DO_PADRAO,
  ajustarAoDiaUtil,
  rotuloDoGoogle,
  type AjusteDeDiaUtil,
  type AgendaGoogle,
  type Configuracoes,
  type EstadoGoogle,
  type FusoAgenda,
  type Lembrete,
  type Preferencias,
  type Retencao,
  type Tema,
} from "@finnagent/contracts";
import { Button } from "../../components/ui/button";
import { Carregando } from "../../components/ui/esqueleto";
import { Segmentado } from "../../components/ui/segmentado";
import { Dialogo } from "../../components/ui/dialogo";
import { mola, Seta } from "../../components/ui/movimento";
import { Chip } from "../../components/ui/chip";
import { campo, cn, focusRing } from "../../components/ui/cn";
import { PageHeader } from "../../components/ui/page-header";
import { aplicarTema, segurarTema } from "../../components/ui/tema";
import { useToast } from "../../components/ui/toast";
import { rotuloDoFuso } from "../agenda/itens";
import { FeriadosDaConta } from "./feriados";
import { PainelDeIa } from "./ia/painel-de-ia";
import { Usuarios } from "./usuarios";

type Secao =
  | "conta"
  | "aparencia"
  | "financas"
  | "financas-vencimentos"
  | "financas-feriados"
  | "google"
  | "ia-provedores"
  | "ia-agentes"
  | "ia-comportamento"
  | "notificacoes"
  | "eventos"
  | "usuarios"
  | "dados";

type No = {
  id: string;
  rotulo: string;
  secao?: Secao;
  filhos?: No[];
};

type Visivel = {
  id: string;
  rotulo: string;
  secao?: Secao;
  grupo: boolean;
  aberto: boolean;
  pai: string | null;
};

const ARVORE: No[] = [
  {
    id: "geral",
    rotulo: "Geral",
    filhos: [
      { id: "conta", rotulo: "Conta", secao: "conta" },
      { id: "aparencia", rotulo: "Aparência", secao: "aparencia" },
      { id: "usuarios", rotulo: "Usuários", secao: "usuarios" },
    ],
  },
  {
    id: "financas",
    rotulo: "Finanças",
    filhos: [
      { id: "financas-geral", rotulo: "Geral", secao: "financas" },
      { id: "financas-vencimentos", rotulo: "Vencimentos", secao: "financas-vencimentos" },
      { id: "financas-feriados", rotulo: "Feriados", secao: "financas-feriados" },
    ],
  },
  {
    id: "integracoes",
    rotulo: "Integrações",
    filhos: [{ id: "google", rotulo: "Google Calendar", secao: "google" }],
  },
  {
    id: "ia",
    rotulo: "Inteligência artificial",
    filhos: [
      { id: "ia-provedores", rotulo: "Provedores", secao: "ia-provedores" },
      { id: "ia-agentes", rotulo: "Agentes", secao: "ia-agentes" },
      { id: "ia-comportamento", rotulo: "Comportamento", secao: "ia-comportamento" },
    ],
  },
  { id: "notificacoes", rotulo: "Notificações", secao: "notificacoes" },
  {
    id: "sistema",
    rotulo: "Sistema",
    filhos: [
      { id: "eventos", rotulo: "Eventos e histórico", secao: "eventos" },
      { id: "dados", rotulo: "Dados e privacidade", secao: "dados" },
    ],
  },
];

/** Seções que a URL pode pedir, lidas da própria árvore. */
const SECOES: Secao[] = ARVORE.flatMap((no) => (no.filhos ?? [no]).flatMap((item) => (item.secao ? [item.secao] : [])));

const ABERTOS = { geral: true, financas: true, integracoes: true, ia: true, sistema: true };

const TODOS_ABERTOS = Object.fromEntries(ARVORE.map((no) => [no.id, true]));

const FUSOS: Array<[FusoAgenda, string]> = [
  ["America/Sao_Paulo", "GMT−3"],
  ["America/Manaus", "GMT−4"],
  ["America/Rio_Branco", "GMT−5"],
  ["America/Noronha", "GMT−2"],
  ["UTC", "GMT+0"],
];

const field = cn(campo, "w-full");


function achatar(nos: No[], abertos: Record<string, boolean>, pai: string | null = null): Visivel[] {
  const lista: Visivel[] = [];
  for (const no of nos) {
    const aberto = Boolean(abertos[no.id]);
    lista.push({
      id: no.id,
      rotulo: no.rotulo,
      secao: no.secao,
      grupo: Boolean(no.filhos),
      aberto,
      pai,
    });
    if (no.filhos && aberto) lista.push(...achatar(no.filhos, abertos, no.id));
  }
  return lista;
}

function rotuloDa(secao: Secao) {
  const lista = achatar(ARVORE, TODOS_ABERTOS);
  const item = lista.find((atual) => atual.secao === secao);
  const pai = item?.pai ? lista.find((atual) => atual.id === item.pai) : null;
  // "Geral" se repete em Geral e em Finanças: o nome do grupo desfaz a dúvida no botão do celular.
  return item ? (pai && item.rotulo === "Geral" ? `${pai.rotulo} · ${item.rotulo}` : item.rotulo) : "Conta";
}

function formularioDe(dados: Configuracoes): Preferencias {
  return {
    name: dados.name,
    timezone: dados.timezone,
    theme: dados.theme,
    workflowDate: dados.workflowDate,
    personalCalendar: dados.personalCalendar,
    workCalendar: dados.workCalendar,
    showEntries: dados.showEntries,
    categorize: dados.categorize,
    pendingHours: dados.pendingHours,
    reminder: dados.reminder,
    reminders: dados.reminders,
    dueAlerts: dados.dueAlerts,
    emailAlerts: dados.emailAlerts,
    appAlerts: dados.appAlerts,
    history: dados.history,
    googleClientId: dados.googleClientId,
    googleClientSecret: "",
    limparSegredoGoogle: false,
    googleCalendarPersonal: dados.googleCalendarPersonal,
    googleCalendarWork: dados.googleCalendarWork,
    aiModels: dados.aiModels,
    aiModel: dados.aiModel,
    aiApiKey: "",
    limparChaveIa: false,
    vencimentos: dados.vencimentos,
    feriadosNaAgenda: dados.feriadosNaAgenda,
    facultativosNaAgenda: dados.facultativosNaAgenda,
  };
}

const dataCurta = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit", timeZone: "UTC" });

function proximoDia(iso: string) {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
}

/** Um exemplo concreto do ajuste: o próximo dia sem banco a partir de hoje e para onde o vencimento iria. */
function exemploDoAjuste(ajuste: AjusteDeDiaUtil) {
  const agora = new Date();
  let data = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}-${String(agora.getDate()).padStart(2, "0")}`;
  for (let tentativa = 0; tentativa < 15 && CALENDARIO_NACIONAL.ehUtil(data, "bancaria"); tentativa += 1) {
    data = proximoDia(data);
  }
  const feriado = CALENDARIO_NACIONAL.feriadoDe(data)[0]?.nome;
  const dia = dataCurta.format(new Date(`${data}T12:00:00Z`));
  const fim = ajustarAoDiaUtil(data, { ...REGRA_SEM_AJUSTE, ajuste }, CALENDARIO_NACIONAL);
  const origem = feriado ? `${dia} (${feriado})` : dia;
  if (fim === data) return `Ex.: vence em ${origem} mesmo assim.`;
  return `Ex.: em vez de ${origem}, vence ${dataCurta.format(new Date(`${fim}T12:00:00Z`))}.`;
}

function opcoesDoCalendario(lista: AgendaGoogle[], atual: string) {
  if (!atual || lista.some((agenda) => agenda.id === atual)) return lista;
  return [{ id: atual, name: atual }, ...lista];
}

export function Painel() {
  const toast = useToast();
  const [secao, setSecao] = useState<Secao>("conta");
  const [abertos, setAbertos] = useState<Record<string, boolean>>(ABERTOS);
  const [foco, setFoco] = useState("conta");
  const [menu, setMenu] = useState(false);
  const [form, setForm] = useState<Preferencias | null>(null);
  const [salvo, setSalvo] = useState<Preferencias | null>(null);
  const [google, setGoogle] = useState<EstadoGoogle>("desconectado");
  const [googleSecretConfigured, setGoogleSecretConfigured] = useState(false);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [googleAccount, setGoogleAccount] = useState("");
  const [googleCalendars, setGoogleCalendars] = useState<AgendaGoogle[]>([]);
  const [retorno, setRetorno] = useState("");
  const [falhou, setFalhou] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erroNome, setErroNome] = useState("");
  const [erroData, setErroData] = useState("");
  const [confirmacao, setConfirmacao] = useState<"excluir" | "desconectar" | "importar" | null>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [transferindo, setTransferindo] = useState(false);
  const [palavra, setPalavra] = useState("");
  const [permissao, setPermissao] = useState("");
  const arvore = useRef<HTMLUListElement>(null);
  const seletor = useRef<HTMLInputElement>(null);
  const sujoRef = useRef(false);
  const salvoRef = useRef<Preferencias | null>(null);
  const sujo = Boolean(form && salvo && JSON.stringify(form) !== JSON.stringify(salvo));
  sujoRef.current = sujo;
  salvoRef.current = salvo;
  segurarTema(true);

  function aplicar(dados: Configuracoes) {
    const base = formularioDe(dados);
    setForm(base);
    setSalvo(base);
    setGoogle(dados.google);
    setGoogleSecretConfigured(dados.googleSecretConfigured);
    setGoogleConnected(dados.googleConnected);
    setGoogleAccount(dados.googleAccount);
    setGoogleCalendars(dados.googleCalendars);
    aplicarTema(base.theme);
  }

  function carregar() {
    setFalhou(false);
    return fetch("/api/configuracoes")
      .then(async (resposta) => {
        const corpo = (await resposta.json().catch(() => ({}))) as Configuracoes & { message?: string };
        if (!resposta.ok) throw new Error(corpo.message || "Não foi possível carregar as configurações.");
        return corpo;
      })
      .then((dados) => aplicar(dados))
      .catch(() => setFalhou(true));
  }

  useEffect(() => {
    let vivo = true;
    fetch("/api/configuracoes")
      .then(async (resposta) => {
        const corpo = (await resposta.json().catch(() => ({}))) as Configuracoes & { message?: string };
        if (!resposta.ok) throw new Error(corpo.message || "falha");
        return corpo;
      })
      .then((dados) => {
        if (!vivo) return;
        aplicar(dados);
      })
      .catch(() => {
        if (vivo) setFalhou(true);
      });
    return () => {
      vivo = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      segurarTema(false);
      if (sujoRef.current && salvoRef.current) aplicarTema(salvoRef.current.theme);
    };
  }, []);

  useEffect(() => {
    setRetorno(`${window.location.origin}/api/configuracoes/google/retorno`);
    const params = new URLSearchParams(window.location.search);
    const pedida = params.get("secao");
    if (pedida && SECOES.includes(pedida as Secao)) setSecao(pedida as Secao);
    const resultado = params.get("google");
    if (resultado === "conectado") toast.sucesso("Google Calendar conectado");
    if (resultado === "erro") toast.erro("Não foi possível conectar o Google Calendar.");
    if (resultado) {
      const url = new URL(window.location.href);
      url.searchParams.delete("google");
      window.history.replaceState(null, "", `${url.pathname}${url.search}`);
    }
  }, [toast]);

  useEffect(() => {
    if (typeof Notification === "undefined") return;
    setPermissao(Notification.permission);
  }, []);

  useEffect(() => {
    const ativo = arvore.current?.querySelector<HTMLButtonElement>("[data-foco='true']");
    if (
      ativo &&
      document.activeElement &&
      arvore.current?.contains(document.activeElement) &&
      document.activeElement !== ativo
    ) {
      ativo.focus();
    }
  }, [foco, abertos]);

  function alterar<K extends keyof Preferencias>(chave: K, valor: Preferencias[K]) {
    setForm((atual) => (atual ? { ...atual, [chave]: valor } : atual));
  }

  function mudarTema(tema: Tema) {
    alterar("theme", tema);
    aplicarTema(tema);
  }

  function descartar() {
    if (!salvo) return;
    setForm(salvo);
    setErroNome("");
    setErroData("");
    aplicarTema(salvo.theme);
  }

  function escolher(item: Visivel) {
    if (item.secao) {
      setSecao(item.secao);
      setFoco(item.id);
      setMenu(false);
      return;
    }
    setFoco(item.id);
    setAbertos((atual) => ({ ...atual, [item.id]: !atual[item.id] }));
  }

  function aoTeclar(event: React.KeyboardEvent<HTMLUListElement>) {
    const lista = achatar(ARVORE, abertos);
    const indice = lista.findIndex((item) => item.id === foco);
    const atual = lista[indice];
    if (!atual) return;
    const proximo = lista[indice + 1];
    const anterior = lista[indice - 1];
    if (event.key === "ArrowDown" && proximo) {
      event.preventDefault();
      setFoco(proximo.id);
    } else if (event.key === "ArrowUp" && anterior) {
      event.preventDefault();
      setFoco(anterior.id);
    } else if (event.key === "Home") {
      event.preventDefault();
      setFoco(lista[0].id);
    } else if (event.key === "End") {
      event.preventDefault();
      setFoco(lista[lista.length - 1].id);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      if (atual.grupo && !atual.aberto) setAbertos((estado) => ({ ...estado, [atual.id]: true }));
      else if (atual.grupo && proximo) setFoco(proximo.id);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      if (atual.grupo && atual.aberto) setAbertos((estado) => ({ ...estado, [atual.id]: false }));
      else if (atual.pai) setFoco(atual.pai);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      escolher(atual);
    }
  }

  async function salvar(event: React.FormEvent) {
    event.preventDefault();
    if (!form) return;
    setSalvando(true);
    setErroNome("");
    setErroData("");
    try {
      const resposta = await fetch("/api/configuracoes", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const corpo = (await resposta.json().catch(() => ({}))) as Configuracoes & { message?: string };
      if (!resposta.ok) {
        const mensagem = corpo.message || "Não foi possível salvar as configurações.";
        if (mensagem.includes("nome")) {
          setErroNome(mensagem);
          setSecao("conta");
          setFoco("conta");
        } else if (mensagem.includes("data")) {
          setErroData(mensagem);
          setSecao("financas");
          setFoco("financas-geral");
        }
        toast.erro(mensagem);
        return;
      }
      aplicar(corpo);
      toast.sucesso("Alterações salvas");
    } catch {
      toast.erro("Não foi possível salvar as configurações.");
    } finally {
      setSalvando(false);
    }
  }

  async function sincronizar() {
    try {
      const resposta = await fetch("/api/agenda/sincronizar", { method: "POST" });
      const corpo = (await resposta.json().catch(() => ({}))) as { message?: string };
      if (!resposta.ok) throw new Error(corpo.message || "Não foi possível sincronizar.");
      toast.sucesso("Agenda sincronizada");
      await carregar();
    } catch (error) {
      toast.erro(error instanceof Error ? error.message : "Não foi possível sincronizar.");
    }
  }

  async function exportar() {
    setTransferindo(true);
    try {
      const resposta = await fetch("/api/dados/exportar");
      if (!resposta.ok) {
        const corpo = (await resposta.json().catch(() => ({}))) as { message?: string };
        throw new Error(corpo.message || "Não foi possível exportar os dados.");
      }
      const url = URL.createObjectURL(await resposta.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = `prumo-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      toast.sucesso("Dados exportados");
    } catch (error) {
      toast.erro(error instanceof Error ? error.message : "Não foi possível exportar os dados.");
    } finally {
      setTransferindo(false);
    }
  }

  async function importar() {
    if (!arquivo) return;
    setTransferindo(true);
    try {
      const resposta = await fetch("/api/dados/importar", { method: "POST", body: await arquivo.text() });
      const corpo = (await resposta.json().catch(() => ({}))) as { message?: string; entries?: number };
      if (!resposta.ok) throw new Error(corpo.message || "Não foi possível importar os dados.");
      toast.sucesso(`Dados importados: ${corpo.entries ?? 0} lançamentos`);
      await carregar();
    } catch (error) {
      toast.erro(error instanceof Error ? error.message : "Não foi possível importar os dados.");
    } finally {
      setTransferindo(false);
      setArquivo(null);
      setConfirmacao(null);
    }
  }

  function confirmarAcao() {
    if (confirmacao === "importar") {
      void importar();
      return;
    }
    if (confirmacao === "excluir") {
      toast.alerta("A exclusão da conta ainda não está disponível.");
      setPalavra("");
      setConfirmacao(null);
      return;
    }
    void desconectarGoogle();
  }

  function conectarGoogle() {
    if (!form || sujo) {
      toast.alerta("Salve o ID e o segredo antes de conectar.");
      return;
    }
    if (!form.googleClientId.trim() || !googleSecretConfigured) {
      toast.alerta("Informe o ID e o segredo do cliente Google.");
      return;
    }
    window.location.assign("/api/configuracoes/google/conectar");
  }

  async function desconectarGoogle() {
    try {
      const resposta = await fetch("/api/configuracoes/google/desconectar", { method: "POST" });
      const corpo = (await resposta.json().catch(() => ({}))) as Configuracoes & { message?: string };
      if (!resposta.ok) throw new Error(corpo.message || "Não foi possível desconectar o Google Calendar.");
      aplicar(corpo);
      toast.sucesso("Google Calendar desconectado");
    } catch (error) {
      toast.erro(error instanceof Error ? error.message : "Não foi possível desconectar o Google Calendar.");
    } finally {
      setPalavra("");
      setConfirmacao(null);
    }
  }

  const lista = achatar(ARVORE, abertos);
  const exigePalavra = confirmacao === "excluir";
  const podeConfirmar = !exigePalavra || palavra === "EXCLUIR";

  return (
    <>
      <PageHeader title="Configurações" subtitle="Ajuste sua conta, integrações e como o assistente trabalha." />
      {falhou ? (
        <div className="grid max-w-prose gap-4">
          <p>Não foi possível carregar as configurações.</p>
          <Button variant="primary" onClick={() => void carregar()}>
            Tentar de novo
          </Button>
        </div>
      ) : !form ? (
        <Carregando texto="Carregando configurações." linhas={4} />
      ) : (
        <div className="grid items-start gap-6 desk:grid-cols-4">
          <nav className="grid min-w-0 gap-2 desk:sticky desk:top-4 desk:col-span-1" aria-label="Seções das configurações">
            <Button
              className="w-full justify-between desk:hidden"
              aria-expanded={menu}
              aria-controls="arvore-configuracoes"
              onClick={() => setMenu((aberto) => !aberto)}
            >
              <span>{rotuloDa(secao)}</span>
              <Seta aberto={menu} />
            </Button>
            <ul
              id="arvore-configuracoes"
              ref={arvore}
              role="tree"
              aria-label="Configurações"
              className={cn(
                "gap-1 rounded-lg border border-line bg-surface p-2",
                menu ? "grid" : "hidden desk:grid",
              )}
              onKeyDown={aoTeclar}
            >
              {lista.map((item) => (
                <li key={item.id} role="none" className={item.pai ? "pl-4" : undefined}>
                  <button
                    type="button"
                    role="treeitem"
                    data-foco={item.id === foco ? "true" : "false"}
                    tabIndex={item.id === foco ? 0 : -1}
                    aria-expanded={item.grupo ? item.aberto : undefined}
                    aria-selected={item.secao ? item.secao === secao : undefined}
                    aria-level={item.pai ? 2 : 1}
                    className={cn(
                      "etiqueta relative flex min-h-10 w-full min-w-0 items-center gap-2 px-3 text-left transition-colors",
                      item.secao === secao ? "text-brand" : item.grupo ? "text-ink" : "text-ink-2 hover:text-ink",
                      focusRing,
                    )}
                    onClick={() => escolher(item)}
                  >
                    {item.secao === secao ? (
                      <motion.span layoutId="secao" className="absolute inset-y-2 left-0 w-0.5 bg-brand" transition={mola} />
                    ) : null}
                    <span className="flex w-4 shrink-0 justify-center">
                      {item.grupo ? <Seta aberto={item.aberto} /> : null}
                    </span>
                    <span className="min-w-0">{item.rotulo}</span>
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          <div className="grid min-w-0 gap-6 desk:col-span-3">
          <form hidden={secao === "usuarios" || secao.startsWith("ia-")} className="grid min-w-0 gap-6" onSubmit={(event) => void salvar(event)}>
            <section hidden={secao !== "conta"} className="grid rounded-lg border border-line bg-surface p-6" aria-labelledby="titulo-conta">
              <h2 id="titulo-conta" className="mb-3 font-display text-lg">Conta</h2>
              <Linha id="nome" titulo="Nome" dica="Como a conta aparece no Prumo.">
                <input
                  id="nome"
                  value={form.name}
                  autoComplete="name"
                  aria-invalid={erroNome ? true : undefined}
                  aria-describedby={erroNome ? "nome-erro nome-dica" : "nome-dica"}
                  className={field}
                  onChange={(event) => {
                    setErroNome("");
                    alterar("name", event.target.value);
                  }}
                />
                {erroNome ? (
                  <p id="nome-erro" className="text-sm text-neg" role="alert">
                    {erroNome}
                  </p>
                ) : null}
              </Linha>
              <Linha id="email" titulo="E-mail" dica="O Prumo ainda não entra por e-mail." grupo>
                <span className="text-sm text-ink-2">Não cadastrado</span>
              </Linha>
              <Linha id="fuso" titulo="Fuso horário" dica="Pessoal e Trabalho usam este mesmo fuso.">
                <select
                  id="fuso"
                  value={form.timezone}
                  aria-describedby="fuso-dica"
                  className={field}
                  onChange={(event) => alterar("timezone", event.target.value as FusoAgenda)}
                >
                  {FUSOS.map(([fuso, offset]) => (
                    <option key={fuso} value={fuso}>
                      {rotuloDoFuso(fuso)} ({offset})
                    </option>
                  ))}
                </select>
              </Linha>
            </section>

            <section hidden={secao !== "aparencia"} className="grid rounded-lg border border-line bg-surface p-6" aria-labelledby="titulo-aparencia">
              <h2 id="titulo-aparencia" className="mb-3 font-display text-lg">Aparência</h2>
              <Linha id="tema" titulo="Tema" dica="Automático segue o sistema. A escolha vale como prévia até você salvar." grupo>
                <Segmentado
                  id="tema"
                  radio
                  aria-labelledby="tema-rotulo"
                  aria-describedby="tema-dica"
                  opcoes={[
                    { id: "auto", label: "Automático" },
                    { id: "light", label: "Claro" },
                    { id: "dark", label: "Escuro" },
                  ]}
                  valor={form.theme}
                  onEscolher={(id) => mudarTema(id)}
                />
              </Linha>
            </section>

            <section hidden={secao !== "financas"} className="grid rounded-lg border border-line bg-surface p-6" aria-labelledby="titulo-financas">
              <h2 id="titulo-financas" className="mb-3 font-display text-lg">Finanças</h2>
              <Linha id="workflow" titulo="Início do workflow" dica="A visão geral mostra os meses a partir desta data, ano a ano.">
                <input
                  id="workflow"
                  type="date"
                  value={form.workflowDate}
                  aria-invalid={erroData ? true : undefined}
                  aria-describedby={erroData ? "workflow-erro workflow-dica" : "workflow-dica"}
                  className={field}
                  onChange={(event) => {
                    setErroData("");
                    alterar("workflowDate", event.target.value);
                  }}
                />
                {erroData ? (
                  <p id="workflow-erro" className="text-sm text-neg" role="alert">
                    {erroData}
                  </p>
                ) : null}
              </Linha>
              <Linha id="moeda" titulo="Moeda" dica="Os valores do Prumo ficam em real." grupo>
                <span className="text-sm text-ink-2">Real brasileiro (BRL)</span>
              </Linha>
            </section>

            <section hidden={secao !== "financas-vencimentos"} className="grid rounded-lg border border-line bg-surface p-6" aria-labelledby="titulo-vencimentos">
              <h2 id="titulo-vencimentos" className="mb-1 font-display text-lg">Vencimentos</h2>
              <p className="mb-3 max-w-prose text-sm text-ink-2">
                O que um lançamento novo faz quando o dia cai em fim de semana ou feriado. No formulário dá para trocar
                por Nº dia útil, último dia útil ou contagem da CLT. Mudar aqui não altera o que já foi lançado.
              </p>
              {PADROES_DE_VENCIMENTO.map((padrao) => (
                <Linha
                  key={padrao}
                  id={`vencimento-${padrao}`}
                  titulo={ROTULO_DO_PADRAO[padrao].nome}
                  dica={`${ROTULO_DO_PADRAO[padrao].exemplo}. ${exemploDoAjuste(form.vencimentos[padrao])}`}
                >
                  <select
                    id={`vencimento-${padrao}`}
                    value={form.vencimentos[padrao]}
                    aria-describedby={`vencimento-${padrao}-dica`}
                    className={field}
                    onChange={(event) =>
                      alterar("vencimentos", { ...form.vencimentos, [padrao]: event.target.value as AjusteDeDiaUtil })
                    }
                  >
                    {AJUSTES_DE_DIA_UTIL.map((ajuste) => (
                      <option key={ajuste} value={ajuste}>
                        {ROTULO_DO_AJUSTE[ajuste]}
                      </option>
                    ))}
                  </select>
                </Linha>
              ))}
            </section>

            <section hidden={secao !== "financas-feriados"} className="grid rounded-lg border border-line bg-surface p-6" aria-labelledby="titulo-feriados">
              <h2 id="titulo-feriados" className="mb-3 font-display text-lg">Feriados na agenda</h2>
              <Linha id="feriados-agenda" titulo="Mostrar feriados na agenda" dica="Nacionais e os da sua cidade aparecem no dia, na grade e na lista.">
                <Interruptor id="feriados-agenda" checked={form.feriadosNaAgenda} onChange={(valor) => alterar("feriadosNaAgenda", valor)} />
              </Linha>
              <Linha
                id="facultativos-agenda"
                titulo="Mostrar pontos facultativos"
                dica="Carnaval, Quarta-feira de Cinzas, Corpus Christi e outros dias em que nem todo mundo para."
              >
                <Interruptor
                  id="facultativos-agenda"
                  checked={form.feriadosNaAgenda && form.facultativosNaAgenda}
                  disabled={!form.feriadosNaAgenda}
                  onChange={(valor) => alterar("facultativosNaAgenda", valor)}
                />
              </Linha>
            </section>

            <section hidden={secao !== "google"} className="grid rounded-lg border border-line bg-surface p-6" aria-labelledby="titulo-google">
              <h2 id="titulo-google" className="mb-3 font-display text-lg">Google Calendar</h2>
              <p className="mb-3 text-sm text-ink-2">
                Crie um cliente OAuth no Google Cloud com leitura do Calendar e autorize a URI de redirecionamento.
              </p>
              {retorno ? <p className="mb-3 text-sm text-ink-2">URI de redirecionamento: {retorno}</p> : null}
              <Linha id="google-cliente" titulo="ID do cliente" dica="O identificador do cliente OAuth. Salve antes de conectar.">
                <input
                  id="google-cliente"
                  value={form.googleClientId}
                  autoComplete="off"
                  aria-describedby="google-cliente-dica"
                  className={field}
                  onChange={(event) => alterar("googleClientId", event.target.value)}
                />
              </Linha>
              <Linha id="google-segredo" titulo="Segredo do cliente" dica="Fica só no Prumo. O campo vazio mantém o segredo já salvo.">
                <span className="flex w-full min-w-0 flex-wrap items-center gap-2">
                  <input
                    id="google-segredo"
                    type="password"
                    value={form.googleClientSecret}
                    autoComplete="new-password"
                    placeholder={googleSecretConfigured && !form.limparSegredoGoogle ? "Segredo já salvo" : ""}
                    aria-describedby="google-segredo-dica"
                    className={cn(field, "w-auto min-w-0 flex-1")}
                    onChange={(event) =>
                      setForm((atual) =>
                        atual
                          ? { ...atual, googleClientSecret: event.target.value, limparSegredoGoogle: false }
                          : atual,
                      )
                    }
                  />
                  {googleSecretConfigured && !form.limparSegredoGoogle ? (
                    <Button
                      onClick={() =>
                        setForm((atual) =>
                          atual ? { ...atual, googleClientSecret: "", limparSegredoGoogle: true } : atual,
                        )
                      }
                    >
                      Remover segredo
                    </Button>
                  ) : null}
                </span>
              </Linha>
              <Linha
                id="conexao"
                titulo="Conexão"
                dica={
                  google === "erro"
                    ? "Não foi possível ler os calendários. Confira o cliente ou conecte de novo."
                    : googleConnected
                      ? "A sincronização traz os compromissos para a agenda."
                      : "Depois de salvar o cliente, conecte a conta Google."
                }
                grupo
              >
                <span className="flex flex-wrap items-center gap-2">
                  <Chip tone={google === "sincronizado" ? "ok" : google === "erro" ? "neg" : "default"}>{rotuloDoGoogle(google)}</Chip>
                  {googleAccount ? <span className="text-sm text-ink-2">{googleAccount}</span> : null}
                  {googleConnected ? (
                    <>
                      <Button onClick={() => void sincronizar()}>Sincronizar agora</Button>
                      <Button variant="danger" onClick={() => setConfirmacao("desconectar")}>
                        Desconectar
                      </Button>
                    </>
                  ) : (
                    <Button variant="primary" onClick={conectarGoogle}>
                      Conectar Google Calendar
                    </Button>
                  )}
                </span>
              </Linha>
              <Linha id="google-pessoal" titulo="Calendário do Google para Pessoal" dica="Os eventos deste calendário entram na agenda Pessoal.">
                <select
                  id="google-pessoal"
                  value={form.googleCalendarPersonal}
                  aria-describedby="google-pessoal-dica"
                  className={field}
                  onChange={(event) => alterar("googleCalendarPersonal", event.target.value)}
                >
                  <option value="">Não sincronizar</option>
                  {opcoesDoCalendario(googleCalendars, form.googleCalendarPersonal).map((agenda) => (
                    <option key={agenda.id} value={agenda.id}>
                      {agenda.name}
                    </option>
                  ))}
                </select>
              </Linha>
              <Linha id="google-trabalho" titulo="Calendário do Google para Trabalho" dica="Os eventos deste calendário entram na agenda Trabalho.">
                <select
                  id="google-trabalho"
                  value={form.googleCalendarWork}
                  aria-describedby="google-trabalho-dica"
                  className={field}
                  onChange={(event) => alterar("googleCalendarWork", event.target.value)}
                >
                  <option value="">Não sincronizar</option>
                  {opcoesDoCalendario(googleCalendars, form.googleCalendarWork).map((agenda) => (
                    <option key={agenda.id} value={agenda.id}>
                      {agenda.name}
                    </option>
                  ))}
                </select>
              </Linha>
              <Linha id="cal-pessoal" titulo="Agenda Pessoal" dica="Mostra os compromissos desse calendário na agenda.">
                <Interruptor
                  id="cal-pessoal"
                  checked={form.personalCalendar}
                  onChange={(valor) => alterar("personalCalendar", valor)}
                />
              </Linha>
              <Linha id="cal-trabalho" titulo="Agenda Trabalho" dica="Mostra os compromissos desse calendário na agenda.">
                <Interruptor
                  id="cal-trabalho"
                  checked={form.workCalendar}
                  onChange={(valor) => alterar("workCalendar", valor)}
                />
              </Linha>
              <Linha id="lancamentos" titulo="Mostrar lançamentos previstos na agenda" dica="Exibe datas de transações junto dos compromissos.">
                <Interruptor id="lancamentos" checked={form.showEntries} onChange={(valor) => alterar("showEntries", valor)} />
              </Linha>
            </section>


            <section hidden={secao !== "notificacoes"} className="grid rounded-lg border border-line bg-surface p-6" aria-labelledby="titulo-notificacoes">
              <h2 id="titulo-notificacoes" className="mb-3 font-display text-lg">Notificações</h2>
              <Linha id="lembretes" titulo="Lembretes de compromissos" dica="A antecedência vale quando os lembretes estão ligados.">
                <span className="flex w-full min-w-0 flex-wrap items-center gap-2">
                  <select
                    id="antecedencia"
                    aria-label="Antecedência do lembrete"
                    value={form.reminder}
                    className={cn(field, "w-auto min-w-0 flex-1")}
                    onChange={(event) => alterar("reminder", event.target.value as Lembrete)}
                  >
                    {LEMBRETES.map((lembrete) => (
                      <option key={lembrete} value={lembrete}>
                        {lembrete === "15m" ? "15 minutos antes" : lembrete === "1h" ? "1 hora antes" : "1 dia antes"}
                      </option>
                    ))}
                  </select>
                  <Interruptor id="lembretes" checked={form.reminders} onChange={(valor) => alterar("reminders", valor)} />
                </span>
              </Linha>
              <Linha id="vencimentos" titulo="Vencimentos de lançamentos" dica="Avisa quando uma transação prevista está para vencer.">
                <Interruptor id="vencimentos" checked={form.dueAlerts} onChange={(valor) => alterar("dueAlerts", valor)} />
              </Linha>
              <Linha id="email-aviso" titulo="Por e-mail" dica="Depende de um e-mail na conta, que ainda não existe.">
                <Interruptor id="email-aviso" checked={form.emailAlerts} onChange={(valor) => alterar("emailAlerts", valor)} />
              </Linha>
              <Linha
                id="aplicativo"
                titulo="No aplicativo"
                dica={
                  permissao === "denied"
                    ? "O navegador bloqueou as notificações deste site."
                    : "Guarda a preferência de aviso dentro do Prumo."
                }
              >
                <Interruptor id="aplicativo" checked={form.appAlerts} onChange={(valor) => alterar("appAlerts", valor)} />
              </Linha>
              <Linha id="cobrar" titulo="Cobrar lançamentos não informados" dica="A IA avisa quando faltar registrar algo que consta no extrato.">
                <span className="flex flex-wrap items-center gap-2">
                  <Chip>Em breve</Chip>
                  <Interruptor id="cobrar" checked={false} disabled onChange={() => undefined} />
                </span>
              </Linha>
            </section>

            <section hidden={secao !== "eventos"} className="grid rounded-lg border border-line bg-surface p-6" aria-labelledby="titulo-eventos">
              <h2 id="titulo-eventos" className="mb-3 font-display text-lg">Eventos e histórico</h2>
              <Linha id="retencao" titulo="Guardar o histórico de processamento por" dica="Os eventos continuam. A lista de histórico mostra as tentativas dentro desse prazo.">
                <select
                  id="retencao"
                  value={form.history}
                  aria-describedby="retencao-dica"
                  className={field}
                  onChange={(event) => alterar("history", event.target.value as Retencao)}
                >
                  <option value="90d">90 dias</option>
                  <option value="1a">1 ano</option>
                  <option value="sempre">Sem limite</option>
                </select>
              </Linha>
            </section>

            <section hidden={secao !== "dados"} className="grid rounded-lg border border-line bg-surface p-6" aria-labelledby="titulo-dados">
              <h2 id="titulo-dados" className="mb-3 font-display text-lg">Dados e privacidade</h2>
              <Linha id="exportar" titulo="Exportar meus dados" dica="Lançamentos, sessões, grupos, agenda, extratos e metas em um arquivo. Senhas e chaves não vão junto." grupo>
                <Button onClick={() => void exportar()} disabled={transferindo}>Exportar</Button>
              </Linha>
              <Linha id="importar" titulo="Importar dados" dica="Carrega um arquivo exportado do Prumo. Os dados atuais são substituídos pelos do arquivo." grupo>
                <input
                  ref={seletor}
                  type="file"
                  accept="application/json,.json"
                  hidden
                  onChange={(event) => {
                    const escolhido = event.target.files?.[0] ?? null;
                    event.target.value = "";
                    if (!escolhido) return;
                    setArquivo(escolhido);
                    setConfirmacao("importar");
                  }}
                />
                <Button onClick={() => seletor.current?.click()} disabled={transferindo}>Importar</Button>
              </Linha>
              <Linha id="excluir" titulo="Excluir minha conta" dica="Apaga todos os seus dados. Não pode ser desfeito." grupo>
                <Button
                  variant="danger"
                  onClick={() => {
                    setPalavra("");
                    setConfirmacao("excluir");
                  }}
                >
                  Excluir conta
                </Button>
              </Linha>
            </section>

            {sujo ? (
              <div role="status" className="sticky bottom-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-brand bg-surface p-4">
                <p>Você tem alterações não salvas.</p>
                <span className="flex flex-wrap gap-2">
                  <Button variant="quiet" onClick={descartar} disabled={salvando}>
                    Descartar
                  </Button>
                  <Button type="submit" variant="primary" disabled={salvando}>
                    Salvar alterações
                  </Button>
                </span>
              </div>
            ) : null}
          </form>
          <FeriadosDaConta visivel={secao === "financas-feriados"} />
          <Usuarios visivel={secao === "usuarios"} />
          <PainelDeIa secao={secao} />
          </div>
        </div>
      )}

      <Dialogo
        aberto={confirmacao !== null}
        aria-labelledby="titulo-confirmacao"
        onCancel={(event) => {
          event.preventDefault();
          setPalavra("");
          setArquivo(null);
          setConfirmacao(null);
        }}
      >
        <div className="dialog-corpo grid gap-4">
          <h2 id="titulo-confirmacao" className="font-display text-lg">
            {confirmacao === "desconectar"
              ? "Desconectar o Google Calendar?"
              : confirmacao === "importar"
                ? "Importar os dados?"
                : "Excluir a conta?"}
          </h2>
          <p>
            {confirmacao === "desconectar"
              ? "Os compromissos deixam de ser sincronizados. Os lançamentos continuam no Prumo."
              : confirmacao === "importar"
                ? `Tudo o que você tem hoje (grupos, sessões, lançamentos, compromissos, extratos e metas) será substituído pelo conteúdo de ${arquivo?.name ?? "o arquivo"}. Isso não pode ser desfeito.`
                : "Todos os seus dados seriam apagados e essa ação não pode ser desfeita."}
          </p>
          {exigePalavra ? (
            <div className="grid gap-1">
              <label htmlFor="confirmar-exclusao" className="text-sm font-semibold">
                Digite EXCLUIR para confirmar
              </label>
              <input
                id="confirmar-exclusao"
                value={palavra}
                autoComplete="off"
                className={field}
                onChange={(event) => setPalavra(event.target.value)}
              />
            </div>
          ) : null}
        </div>
        <div className="dialog-acoes">
          <Button
            variant="quiet"
            onClick={() => {
              setPalavra("");
              setArquivo(null);
              setConfirmacao(null);
            }}
          >
            Cancelar
          </Button>
          <Button variant="danger" disabled={!podeConfirmar || transferindo} onClick={confirmarAcao}>
            {confirmacao === "desconectar" ? "Desconectar" : confirmacao === "importar" ? "Substituir meus dados" : "Excluir conta"}
          </Button>
        </div>
      </Dialogo>
    </>
  );
}

function Linha({
  id,
  titulo,
  dica,
  grupo = false,
  children,
}: {
  id: string;
  titulo: string;
  dica: string;
  grupo?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 border-t border-line py-4 tab:flex-row tab:items-center tab:gap-6">
      <div className="grid min-w-0 gap-1 tab:flex-1">
        {grupo ? (
          <span id={`${id}-rotulo`} className="font-semibold">
            {titulo}
          </span>
        ) : (
          <label htmlFor={id} className="font-semibold">
            {titulo}
          </label>
        )}
        <p id={`${id}-dica`} className="max-w-prose text-sm text-ink-2">
          {dica}
        </p>
      </div>
      <div className="grid min-w-0 justify-items-stretch gap-2 tab:flex-1 tab:justify-items-end">{children}</div>
    </div>
  );
}

function Interruptor({
  id,
  checked,
  disabled = false,
  onChange,
}: {
  id: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (valor: boolean) => void;
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-describedby={`${id}-dica`}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn("inline-flex h-10 w-12 shrink-0 items-center", disabled && "opacity-50", focusRing)}
    >
      <span
        aria-hidden
        className={cn(
          "relative h-6 w-12 rounded-full border",
          checked ? "border-brand bg-brand" : "border-line bg-surface-2",
        )}
      >
        <motion.span
          className={cn("absolute top-1 left-1 size-4 rounded-full", checked ? "bg-brand-ink" : "bg-surface")}
          initial={false}
          animate={{ x: checked ? 24 : 0 }}
          transition={mola}
        />
      </span>
    </button>
  );
}
