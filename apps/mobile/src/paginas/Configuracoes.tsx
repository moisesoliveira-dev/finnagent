import { IonButton, IonIcon, IonToggle, useIonViewWillEnter } from "@ionic/react";
import {
  AJUSTES_DE_DIA_UTIL,
  FUSOS_AGENDA,
  LEMBRETES,
  PADROES_DE_VENCIMENTO,
  RETENCOES,
  ROTULO_DO_AJUSTE,
  ROTULO_DO_PADRAO,
  SENHA_MINIMA,
  rotuloDoGoogle,
  type AjusteDeDiaUtil,
  type Configuracoes as DadosDasConfiguracoes,
  type Feriado,
  type FeriadoLocal,
  type FusoAgenda,
  type Lembrete,
  type Preferencias,
  type Retencao,
  type Tema,
  type UsuarioDaConta,
} from "@finnagent/contracts";
import {
  arrowBack,
  calendarOutline,
  chevronForward,
  cloudUploadOutline,
  documentTextOutline,
  logoGoogle,
  mailOutline,
  notificationsOutline,
  peopleOutline,
  personOutline,
  pulseOutline,
  sparklesOutline,
  timeOutline,
  trashOutline,
  colorPaletteOutline,
  informationCircleOutline,
  checkmark,
} from "ionicons/icons";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { enviar, pedir } from "../api/cliente";
import { sessaoAtual } from "../api/sessao";
import pacote from "../../package.json";
import { aplicarTema } from "../tema/tema";
import { MESES } from "../api/formato";
import { Campo, CampoDeSenha } from "../componentes/Campo";
import { Data } from "../componentes/Data";
import { Estado } from "../componentes/Estado";
import { Folha } from "../componentes/Folha";
import { Pagina } from "../componentes/Pagina";
import { Selecao } from "../componentes/Selecao";
import { useAcao } from "../useAcao";
import { useDados } from "../useDados";

type Secao = "conta" | "aparencia" | "financas" | "feriados" | "google" | "avisos" | "usuarios" | "eventos" | "dados";

const ROTULO_DO_FUSO: Record<FusoAgenda, string> = {
  "America/Sao_Paulo": "Brasília (GMT−3)",
  "America/Manaus": "Manaus (GMT−4)",
  "America/Rio_Branco": "Rio Branco (GMT−5)",
  "America/Noronha": "Noronha (GMT−2)",
  UTC: "UTC (GMT+0)",
};

const ROTULO_DO_LEMBRETE: Record<Lembrete, string> = { "15m": "15 minutos antes", "1h": "1 hora antes", "1d": "1 dia antes" };
const ROTULO_DA_RETENCAO: Record<Retencao, string> = { "90d": "90 dias", "1a": "1 ano", sempre: "Sem limite" };
const ROTULO_DO_TEMA: Record<Tema, string> = { auto: "Automático", light: "Claro", dark: "Escuro" };

function formularioDe(dados: DadosDasConfiguracoes): Preferencias {
  const { google: _google, googleSecretConfigured: _segredo, googleConnected: _conectado, googleAccount: _conta, googleCalendars: _agendas, aiKeyConfigured: _chave, ...preferencias } = dados;
  return { ...preferencias, googleClientSecret: "", limparSegredoGoogle: false, aiApiKey: "", limparChaveIa: false };
}

/** As configurações da conta, as mesmas do web, uma seção por folha. A inteligência artificial tem a página dela. */
export function Configuracoes() {
  const { dados, erro, carregando, recarregar } = useDados<DadosDasConfiguracoes>("/api/configuracoes");
  const { ocupado, agir } = useAcao();
  const [secao, setSecao] = useState<Secao | null>(null);
  const [form, setForm] = useState<Preferencias | null>(null);
  const master = sessaoAtual()?.user.role === "master";

  useIonViewWillEnter(() => {
    if (dados) void recarregar();
  });

  // O tema é a mesma preferência do site: o que está salvo na conta vale aqui também.
  useEffect(() => {
    if (dados) aplicarTema(dados.theme);
  }, [dados]);

  /** Troca o tema na hora e grava na conta; se o servidor recusar, volta ao que estava. */
  async function escolherTema(tema: Tema) {
    if (!dados) return;
    aplicarTema(tema);
    const ok = await agir("tema", () => enviar("/api/configuracoes", { ...formularioDe(dados), theme: tema }, "PUT"));
    if (ok) {
      setSecao(null);
      await recarregar();
    } else {
      aplicarTema(dados.theme);
    }
  }

  // Cada folha parte do que está salvo: fechar sem salvar descarta.
  function abrir(qual: Secao) {
    if (dados) setForm(formularioDe(dados));
    setSecao(qual);
  }

  const mudar = <K extends keyof Preferencias>(campo: K, valor: Preferencias[K]) => setForm((atual) => (atual ? { ...atual, [campo]: valor } : atual));

  async function salvar() {
    if (!form) return;
    const ok = await agir("salvar", () => enviar("/api/configuracoes", form, "PUT"), "Alterações salvas.");
    if (ok) {
      setSecao(null);
      await recarregar();
    }
  }

  const botaoSalvar = (
    <IonButton expand="block" className="principal" disabled={Boolean(ocupado)} onClick={() => void salvar()}>
      Salvar
    </IonButton>
  );

  type Linha = { id: Secao; icone: string; titulo: string; texto: string } | { para: string; icone: string; titulo: string; texto: string };
  // As configurações em grupos, como as de um aparelho: cada grupo com o título dele e as linhas abaixo.
  const grupos: Array<{ titulo: string; linhas: Linha[] }> = [
    {
      titulo: "Conta",
      linhas: [
        { id: "conta", icone: personOutline, titulo: "Conta", texto: "Nome e fuso" },
        { id: "usuarios", icone: peopleOutline, titulo: "Usuários", texto: master ? "Quem mais usa a conta" : "Só o master gerencia" },
      ],
    },
    {
      titulo: "Aparência",
      linhas: [{ id: "aparencia", icone: colorPaletteOutline, titulo: "Tema", texto: dados ? ROTULO_DO_TEMA[dados.theme] : "" }],
    },
    {
      titulo: "Assistente",
      linhas: [{ para: "/configuracoes/ia", icone: sparklesOutline, titulo: "Inteligência artificial", texto: "Provedores, agentes e comportamento" }],
    },
    {
      titulo: "Finanças e agenda",
      linhas: [
        { id: "financas", icone: calendarOutline, titulo: "Finanças e vencimentos", texto: "Início do workflow e o ajuste em dia não útil" },
        { id: "feriados", icone: calendarOutline, titulo: "Feriados", texto: "Na agenda e os feriados da sua cidade" },
        { id: "google", icone: logoGoogle, titulo: "Google Agenda", texto: dados ? rotuloDoGoogle(dados.google) : "" },
      ],
    },
    {
      titulo: "Avisos",
      linhas: [{ id: "avisos", icone: notificationsOutline, titulo: "Lembretes e vencimentos", texto: "Os avisos do Início" }],
    },
    {
      titulo: "Dados",
      linhas: [
        { id: "eventos", icone: pulseOutline, titulo: "Eventos e histórico", texto: "Por quanto tempo guardar o histórico" },
        { id: "dados", icone: documentTextOutline, titulo: "Dados e privacidade", texto: "Importar, desfazer a conferência, recomeçar" },
      ],
    },
  ];

  return (
    <Pagina
      titulo="Configurações"
      etiqueta="Da conta"
      aoAtualizar={recarregar}
      semPerfil
      fim={
        <IonButton routerLink="/perfil" routerDirection="back" aria-label="Voltar">
          <IonIcon slot="icon-only" icon={arrowBack} />
        </IonButton>
      }
    >
      <div className="pagina">
        <Estado carregando={carregando} erro={erro} tem={Boolean(dados)} aoTentar={() => void recarregar()} />
        {grupos.map((grupo) => (
          <div key={grupo.titulo} className="secao">
            <span className="etiqueta">{grupo.titulo}</span>
            <div className="lista">
              {grupo.linhas.map((linha) =>
                "para" in linha ? (
                  <Link key={linha.para} to={linha.para} className="linha atalho-de-linha">
                    <IonIcon icon={linha.icone} aria-hidden />
                    <span className="texto" style={{ flex: 1 }}>
                      <strong>{linha.titulo}</strong>
                      <span className="etiqueta">{linha.texto}</span>
                    </span>
                    <IonIcon icon={chevronForward} aria-hidden />
                  </Link>
                ) : (
                  <button key={linha.id} type="button" className="linha linha-botao atalho-de-linha" disabled={!dados} onClick={() => abrir(linha.id)}>
                    <IonIcon icon={linha.icone} aria-hidden />
                    <span className="texto" style={{ flex: 1 }}>
                      <strong>{linha.titulo}</strong>
                      <span className="etiqueta">{linha.texto}</span>
                    </span>
                    <IonIcon icon={chevronForward} aria-hidden />
                  </button>
                ),
              )}
            </div>
          </div>
        ))}

        <div className="secao">
          <span className="etiqueta">Sobre</span>
          <div className="lista">
            <div className="linha">
              <IonIcon icon={informationCircleOutline} aria-hidden />
              <span className="texto" style={{ flex: 1 }}>
                <strong>Prumo</strong>
                <span className="etiqueta">Versão {pacote.version}</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      <Folha aberta={secao === "conta"} titulo="Conta" aoFechar={() => setSecao(null)}>
        {form ? (
          <>
            <Campo icone={personOutline} rotulo="Nome da conta" value={form.name} onMudar={(valor) => mudar("name", valor)} maxLength={80} />
            <Selecao rotulo="Fuso" valor={form.timezone} opcoes={FUSOS_AGENDA.map((fuso) => ({ id: fuso, texto: ROTULO_DO_FUSO[fuso] }))} aoMudar={(valor) => mudar("timezone", valor as FusoAgenda)} />
            {botaoSalvar}
          </>
        ) : null}
      </Folha>

      <Folha aberta={secao === "aparencia"} titulo="Tema" aoFechar={() => setSecao(null)}>
        <p className="fraco">Vale para o site e para este aplicativo. Automático segue o tema do celular.</p>
        <div className="lista">
          {(["auto", "light", "dark"] as const).map((tema) => (
            <button key={tema} type="button" className="linha linha-botao" disabled={Boolean(ocupado)} aria-pressed={dados?.theme === tema} onClick={() => void escolherTema(tema)}>
              <span className="texto" style={{ flex: 1 }}>
                <strong>{ROTULO_DO_TEMA[tema]}</strong>
              </span>
              {dados?.theme === tema ? <IonIcon icon={checkmark} aria-hidden /> : null}
            </button>
          ))}
        </div>
      </Folha>

      <Folha aberta={secao === "financas"} titulo="Finanças e vencimentos" aoFechar={() => setSecao(null)}>
        {form ? (
          <>
            <Data rotulo="Início do workflow" valor={form.workflowDate} aoMudar={(valor) => mudar("workflowDate", valor)} />
            <p className="fraco">A visão geral mostra os meses a partir desta data, ano a ano. Os valores ficam em real.</p>
            <h2 className="etiqueta">Quando o vencimento cai em dia não útil</h2>
            {PADROES_DE_VENCIMENTO.map((padrao) => (
              <Selecao
                key={padrao}
                rotulo={`${ROTULO_DO_PADRAO[padrao].nome} (${ROTULO_DO_PADRAO[padrao].exemplo})`}
                valor={form.vencimentos[padrao]}
                opcoes={AJUSTES_DE_DIA_UTIL.map((ajuste) => ({ id: ajuste, texto: ROTULO_DO_AJUSTE[ajuste] }))}
                aoMudar={(valor) => mudar("vencimentos", { ...form.vencimentos, [padrao]: valor as AjusteDeDiaUtil })}
              />
            ))}
            {botaoSalvar}
          </>
        ) : null}
      </Folha>

      <Folha aberta={secao === "feriados"} titulo="Feriados" aoFechar={() => setSecao(null)}>
        {form ? (
          <>
            <IonToggle checked={form.feriadosNaAgenda} onIonChange={(evento) => mudar("feriadosNaAgenda", evento.detail.checked)} labelPlacement="start" justify="space-between">
              Feriados na agenda
            </IonToggle>
            <IonToggle
              checked={form.feriadosNaAgenda && form.facultativosNaAgenda}
              disabled={!form.feriadosNaAgenda}
              onIonChange={(evento) => mudar("facultativosNaAgenda", evento.detail.checked)}
              labelPlacement="start"
              justify="space-between"
            >
              Pontos facultativos também
            </IonToggle>
            {botaoSalvar}
            {secao === "feriados" ? <FeriadosLocais /> : null}
          </>
        ) : null}
      </Folha>

      <Folha aberta={secao === "google"} titulo="Google Agenda" aoFechar={() => setSecao(null)}>
        {form && dados ? (
          <>
            <div className="cartao">
              <span className={`chip ${dados.google === "sincronizado" ? "ok" : dados.google === "erro" ? "neg" : ""}`} style={{ justifySelf: "start" }}>
                {rotuloDoGoogle(dados.google)}
              </span>
              {dados.googleAccount ? <span className="fraco">{dados.googleAccount}</span> : null}
              {dados.googleConnected ? (
                <div className="acoes-da-folha">
                  <IonButton size="small" fill="outline" disabled={Boolean(ocupado)} onClick={() => void agir("sincronizar", () => enviar("/api/agenda/sincronizar", {}), "Agenda sincronizada.").then(() => recarregar())}>
                    Sincronizar agora
                  </IonButton>
                  <IonButton
                    size="small"
                    fill="clear"
                    color="danger"
                    disabled={Boolean(ocupado)}
                    onClick={() => void agir("desconectar", () => enviar("/api/configuracoes/google/desconectar", {}), "Google Agenda desconectado.").then(() => recarregar())}
                  >
                    Desconectar
                  </IonButton>
                </div>
              ) : (
                // A autorização do Google abre no navegador e volta para o site: o app não segue esse caminho.
                <span className="fraco">Para conectar, entre no Prumo pelo navegador e use Configurações, Google Calendar. Depois de conectado, a sincronização funciona aqui.</span>
              )}
            </div>
            {dados.googleConnected ? (
              <>
                <Selecao
                  rotulo="Agenda Google da agenda Pessoal"
                  valor={form.googleCalendarPersonal}
                  vazio="Não sincronizar"
                  opcoes={dados.googleCalendars.map((agenda) => ({ id: agenda.id, texto: agenda.name }))}
                  aoMudar={(valor) => mudar("googleCalendarPersonal", valor)}
                />
                <Selecao
                  rotulo="Agenda Google da agenda Trabalho"
                  valor={form.googleCalendarWork}
                  vazio="Não sincronizar"
                  opcoes={dados.googleCalendars.map((agenda) => ({ id: agenda.id, texto: agenda.name }))}
                  aoMudar={(valor) => mudar("googleCalendarWork", valor)}
                />
              </>
            ) : null}
            <IonToggle checked={form.personalCalendar} onIonChange={(evento) => mudar("personalCalendar", evento.detail.checked)} labelPlacement="start" justify="space-between">
              Mostrar a agenda Pessoal
            </IonToggle>
            <IonToggle checked={form.workCalendar} onIonChange={(evento) => mudar("workCalendar", evento.detail.checked)} labelPlacement="start" justify="space-between">
              Mostrar a agenda Trabalho
            </IonToggle>
            <IonToggle checked={form.showEntries} onIonChange={(evento) => mudar("showEntries", evento.detail.checked)} labelPlacement="start" justify="space-between">
              Lançamentos na agenda
            </IonToggle>
            <Campo icone={logoGoogle} rotulo="ID do cliente OAuth" value={form.googleClientId} onMudar={(valor) => mudar("googleClientId", valor)} autoCapitalize="none" />
            <CampoDeSenha
              rotulo={dados.googleSecretConfigured && !form.limparSegredoGoogle ? "Segredo do cliente (já salvo; vazio mantém)" : "Segredo do cliente"}
              value={form.googleClientSecret}
              onMudar={(valor) => setForm({ ...form, googleClientSecret: valor, limparSegredoGoogle: false })}
              autoComplete="new-password"
            />
            {botaoSalvar}
          </>
        ) : null}
      </Folha>

      <Folha aberta={secao === "avisos"} titulo="Lembretes e vencimentos" aoFechar={() => setSecao(null)}>
        {form ? (
          <>
            <IonToggle checked={form.reminders} onIonChange={(evento) => mudar("reminders", evento.detail.checked)} labelPlacement="start" justify="space-between">
              Lembretes de compromissos
            </IonToggle>
            <Selecao rotulo="Antecedência do lembrete" valor={form.reminder} opcoes={LEMBRETES.map((item) => ({ id: item, texto: ROTULO_DO_LEMBRETE[item] }))} aoMudar={(valor) => mudar("reminder", valor as Lembrete)} desabilitado={!form.reminders} />
            <IonToggle checked={form.dueAlerts} onIonChange={(evento) => mudar("dueAlerts", evento.detail.checked)} labelPlacement="start" justify="space-between">
              Vencimentos de lançamentos
            </IonToggle>
            <IonToggle checked={form.appAlerts} onIonChange={(evento) => mudar("appAlerts", evento.detail.checked)} labelPlacement="start" justify="space-between">
              No topo do Início
            </IonToggle>
            <IonToggle checked={form.emailAlerts} onIonChange={(evento) => mudar("emailAlerts", evento.detail.checked)} labelPlacement="start" justify="space-between">
              Por e-mail
            </IonToggle>
            <p className="fraco">O que chega como notificação, por tipo e por canal, fica em Perfil, Avisos.</p>
            {botaoSalvar}
          </>
        ) : null}
      </Folha>

      <Folha aberta={secao === "usuarios"} titulo="Usuários" aoFechar={() => setSecao(null)}>
        {secao === "usuarios" ? <Usuarios master={master} /> : null}
      </Folha>

      <Folha aberta={secao === "eventos"} titulo="Eventos e histórico" aoFechar={() => setSecao(null)}>
        {form ? (
          <>
            <Selecao rotulo="Guardar o histórico de processamento por" valor={form.history} opcoes={RETENCOES.map((item) => ({ id: item, texto: ROTULO_DA_RETENCAO[item] }))} aoMudar={(valor) => mudar("history", valor as Retencao)} />
            <p className="fraco">Os eventos continuam. A lista de histórico mostra as tentativas dentro desse prazo.</p>
            {botaoSalvar}
            <IonButton expand="block" fill="outline" routerLink="/configuracoes/eventos" onClick={() => setSecao(null)}>
              Ver os eventos
            </IonButton>
          </>
        ) : null}
      </Folha>

      <Folha aberta={secao === "dados"} titulo="Dados e privacidade" aoFechar={() => setSecao(null)}>
        {secao === "dados" ? <Dados /> : null}
      </Folha>
    </Pagina>
  );
}

function Linha({ titulo, texto, children }: { titulo: string; texto: string; children: ReactNode }) {
  return (
    <section className="cartao secao">
      <strong>{titulo}</strong>
      <span className="fraco">{texto}</span>
      {children}
    </section>
  );
}

/** Os feriados da cidade da pessoa: entram no cálculo do dia útil. Os nacionais vêm prontos. */
function FeriadosLocais() {
  const ano = new Date().getFullYear();
  const { dados, erro, carregando, recarregar } = useDados<{ feriados: Feriado[]; locais: FeriadoLocal[] }>(`/api/feriados?year=${ano}`);
  const { ocupado, agir, avisar } = useAcao();
  const [nome, setNome] = useState("");
  const [dia, setDia] = useState("1");
  const [mes, setMes] = useState("1");

  const ajustados = (redatados: number) =>
    redatados === 0 ? "" : redatados === 1 ? " As datas pendentes de 1 lançamento foram ajustadas." : ` As datas pendentes de ${redatados} lançamentos foram ajustadas.`;

  async function adicionar() {
    if (!nome.trim()) return;
    let redatados = 0;
    const ok = await agir("feriado", async () => {
      redatados = (await enviar<{ redatados: number }>("/api/feriados", { nome: nome.trim(), dia: Number(dia), mes: Number(mes) })).redatados;
    });
    if (ok) {
      setNome("");
      avisar(`Feriado adicionado.${ajustados(redatados)}`);
      await recarregar();
    }
  }

  async function remover(local: FeriadoLocal) {
    let redatados = 0;
    const ok = await agir(`remover-${local.id}`, async () => {
      redatados = (await pedir<{ redatados: number }>(`/api/feriados/${local.id}`, { method: "DELETE" })).redatados;
    });
    if (ok) {
      avisar(`${local.nome} saiu dos feriados.${ajustados(redatados)}`);
      await recarregar();
    }
  }

  return (
    <section className="secao">
      <h2 className="etiqueta">Feriados da sua cidade</h2>
      <Estado carregando={carregando} erro={erro} tem={Boolean(dados)} aoTentar={() => void recarregar()} />
      {dados ? (
        <div className="lista">
          {dados.locais.length === 0 ? <div className="linha fraco">Nenhum feriado local.</div> : null}
          {dados.locais.map((local) => (
            <div key={local.id} className="linha">
              <span className="texto">
                <span>{local.nome}</span>
                <span className="etiqueta">
                  {String(local.dia).padStart(2, "0")} de {MESES[local.mes - 1]}
                </span>
              </span>
              <IonButton fill="clear" color="danger" aria-label={`Remover ${local.nome}`} disabled={Boolean(ocupado)} onClick={() => void remover(local)}>
                <IonIcon slot="icon-only" icon={trashOutline} />
              </IonButton>
            </div>
          ))}
        </div>
      ) : null}
      <Campo icone={calendarOutline} rotulo="Nome do feriado" value={nome} onMudar={setNome} placeholder="Aniversário da cidade" maxLength={80} />
      <div className="grade">
        <Selecao rotulo="Dia" valor={dia} opcoes={Array.from({ length: 31 }, (_, indice) => ({ id: String(indice + 1), texto: String(indice + 1) }))} aoMudar={setDia} />
        <Selecao rotulo="Mês" valor={mes} opcoes={MESES.map((nomeDoMes, indice) => ({ id: String(indice + 1), texto: nomeDoMes }))} aoMudar={setMes} />
      </div>
      <IonButton expand="block" fill="outline" disabled={Boolean(ocupado) || !nome.trim()} onClick={() => void adicionar()}>
        Adicionar feriado
      </IonButton>
    </section>
  );
}

/** Quem mais entra na conta. Só o master lista, adiciona e remove. */
function Usuarios({ master }: { master: boolean }) {
  const { dados, erro, carregando, recarregar } = useDados<UsuarioDaConta[]>(master ? "/api/usuarios" : null);
  const { ocupado, agir, confirmar } = useAcao();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [falha, setFalha] = useState("");
  const eu = sessaoAtual()?.user.id;

  if (!master) return <p className="fraco">Você usa esta conta como membro. Só o usuário master cria e remove usuários.</p>;

  async function adicionar() {
    if (!nome.trim() || !email.trim()) return setFalha("Informe o nome e o e-mail.");
    if (senha.length < SENHA_MINIMA) return setFalha(`Use ${SENHA_MINIMA} ou mais caracteres na senha.`);
    setFalha("");
    const ok = await agir("usuario", () => enviar("/api/usuarios", { name: nome.trim(), email: email.trim(), password: senha }), `${nome.trim()} foi adicionado.`);
    if (ok) {
      setNome("");
      setEmail("");
      setSenha("");
      await recarregar();
    }
  }

  return (
    <>
      <p className="fraco">Você é o usuário master desta conta. Quem você adicionar entra com e-mail e senha e vê os mesmos dados.</p>
      <Estado carregando={carregando} erro={erro} tem={Boolean(dados)} aoTentar={() => void recarregar()} />
      {dados ? (
        <div className="lista">
          {dados.map((usuario) => (
            <div key={usuario.id} className="linha">
              <span className="texto">
                <span>{usuario.name}</span>
                <span className="etiqueta">
                  {usuario.email} · {usuario.role === "master" ? "Master" : "Membro"}
                </span>
              </span>
              {usuario.role !== "master" && usuario.id !== eu ? (
                <IonButton
                  fill="clear"
                  color="danger"
                  aria-label={`Remover ${usuario.name}`}
                  disabled={Boolean(ocupado)}
                  onClick={() =>
                    confirmar("Remover este usuário?", `${usuario.name} perde o acesso agora. Os dados da conta continuam com você.`, "Remover", () =>
                      void agir("remover", () => pedir(`/api/usuarios/${usuario.id}`, { method: "DELETE" }), `${usuario.name} foi removido.`).then(() => recarregar()),
                    )
                  }
                >
                  <IonIcon slot="icon-only" icon={trashOutline} />
                </IonButton>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
      <h2 className="etiqueta">Adicionar usuário</h2>
      <Campo icone={personOutline} rotulo="Nome" value={nome} onMudar={setNome} maxLength={80} />
      <Campo icone={mailOutline} rotulo="E-mail" type="email" inputMode="email" autoCapitalize="none" value={email} onMudar={setEmail} />
      <CampoDeSenha rotulo="Senha" value={senha} onMudar={setSenha} autoComplete="new-password" />
      <p className="fraco">Passe esta senha à pessoa. Use {SENHA_MINIMA} ou mais caracteres.</p>
      {falha ? <p className="erro">{falha}</p> : null}
      <IonButton expand="block" className="principal" disabled={Boolean(ocupado)} onClick={() => void adicionar()}>
        Adicionar
      </IonButton>
    </>
  );
}

/** Importar um arquivo exportado, desfazer a conferência e recomeçar. O que não tem volta pede a palavra. */
function Dados() {
  const { ocupado, agir, avisar } = useAcao();
  const seletor = useRef<HTMLInputElement>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [pedindo, setPedindo] = useState<"importar" | "desfazer" | "recomecar" | null>(null);
  const [palavra, setPalavra] = useState("");
  // Importar substitui os dados, mas o arquivo escolhido já é a confirmação; desfazer e recomeçar pedem a palavra, como no web.
  const esperada = pedindo === "recomecar" ? "RECOMEÇAR" : pedindo === "desfazer" ? "DESFAZER" : "";
  const confere = !esperada || palavra.trim().toUpperCase() === esperada;

  useEffect(() => setPalavra(""), [pedindo]);

  async function confirmarAcao() {
    if (!confere) return;
    if (pedindo === "importar" && arquivo) {
      const texto = await arquivo.text();
      let lancamentos = 0;
      const ok = await agir("importar", async () => {
        lancamentos = (await pedir<{ entries?: number }>("/api/dados/importar", { method: "POST", body: texto })).entries ?? 0;
      });
      if (ok) avisar(`Dados importados: ${lancamentos} lançamentos.`);
    }
    if (pedindo === "desfazer") {
      let mensagem = "";
      await agir("desfazer", async () => {
        const corpo = await enviar<{ queued?: boolean; lines?: number; reactivated?: number; names?: number; orphans?: number }>("/api/extratos/conferencia/desfazer-tudo", {});
        mensagem = corpo.queued
          ? "Começou a desfazer a conferência. Você recebe uma notificação quando terminar."
          : `Conferência desfeita: ${corpo.lines ?? 0} linhas voltaram a pendentes, ${corpo.reactivated ?? 0} reativadas, ${corpo.names ?? 0} nomes esquecidos e ${corpo.orphans ?? 0} lançamentos soltos apagados.`;
      });
      if (mensagem) avisar(mensagem);
    }
    if (pedindo === "recomecar") await agir("zerar", () => enviar("/api/dados/zerar", {}), "Dados zerados. As configurações continuam.");
    setPedindo(null);
    setArquivo(null);
  }

  return (
    <>
      <Linha titulo="Exportar meus dados" texto="O arquivo é baixado pelo site: o celular não salva o download do aplicativo. Entre no Prumo pelo navegador, em Configurações, Dados.">
        {null}
      </Linha>
      <Linha titulo="Importar dados" texto="Carrega um arquivo exportado do Prumo. Os dados atuais são substituídos pelos do arquivo.">
        <input
          ref={seletor}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(evento) => {
            const escolhido = evento.target.files?.[0] ?? null;
            evento.target.value = "";
            if (!escolhido) return;
            setArquivo(escolhido);
            setPedindo("importar");
          }}
        />
        <IonButton fill="outline" disabled={Boolean(ocupado)} onClick={() => seletor.current?.click()}>
          <IonIcon slot="start" icon={cloudUploadOutline} />
          Escolher o arquivo
        </IonButton>
      </Linha>
      <Linha
        titulo="Desfazer a conferência dos extratos"
        texto="Volta cada linha dos extratos a sem lançamento, como no dia da importação: o que a linha criou some, o que ela pagou reabre, as ignoradas voltam e os nomes lembrados são esquecidos."
      >
        <IonButton fill="outline" color="danger" disabled={Boolean(ocupado)} onClick={() => setPedindo("desfazer")}>
          Desfazer tudo
        </IonButton>
      </Linha>
      <Linha titulo="Recomeçar" texto="Apaga lançamentos, grupos, sessões, agenda, extratos, metas e o histórico. Conta, aparência, vencimentos, feriados, usuários e a inteligência artificial ficam.">
        <IonButton fill="outline" color="danger" disabled={Boolean(ocupado)} onClick={() => setPedindo("recomecar")}>
          Recomeçar
        </IonButton>
      </Linha>

      {pedindo ? (
        <section className="cartao secao destaque">
          <strong>{pedindo === "importar" ? `Importar ${arquivo?.name ?? "o arquivo"}?` : pedindo === "desfazer" ? "Desfazer a conferência?" : "Recomeçar do zero?"}</strong>
          <span className="fraco">{esperada ? `Não pode ser desfeito. Digite ${esperada} para confirmar.` : "Os dados atuais são substituídos pelos do arquivo."}</span>
          {esperada ? <Campo icone={timeOutline} rotulo="Confirmação" value={palavra} onMudar={setPalavra} autoCapitalize="characters" /> : null}
          <div className="acoes-da-folha">
            <IonButton color="danger" disabled={Boolean(ocupado) || !confere} onClick={() => void confirmarAcao()}>
              Confirmar
            </IonButton>
            <IonButton fill="clear" onClick={() => setPedindo(null)}>
              Cancelar
            </IonButton>
          </div>
        </section>
      ) : null}
    </>
  );
}
