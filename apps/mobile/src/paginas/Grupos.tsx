import { IonButton, IonCheckbox, IonIcon, useIonViewWillEnter } from "@ionic/react";
import { ROTULO_DO_TIPO_DE_SESSAO, TIPOS_SESSAO, type Grupo, type GruposResposta, type Sessao, type TipoSessao, type ViradaResposta } from "@finnagent/contracts";
import { addOutline, arrowBack, cashOutline, folderOpenOutline, pricetagOutline } from "ionicons/icons";
import { useEffect, useRef, useState } from "react";
import { enviar, ler, pedir } from "../api/cliente";
import { centavosDe, paraCampo, reais } from "../api/formato";
import { AreaDeTexto, Campo } from "../componentes/Campo";
import { Estado, Vazio } from "../componentes/Estado";
import { Folha } from "../componentes/Folha";
import { ItemOrdenavel, ListaOrdenavel } from "../componentes/Ordenavel";
import { Pagina } from "../componentes/Pagina";
import { Fichas, Selecao } from "../componentes/Selecao";
import { useAcao } from "../useAcao";
import { useDados } from "../useDados";

type Pendente = Extract<ViradaResposta, { pendente: true }>;
type RascunhoDeGrupo = { id: string | null; name: string; description: string };
type RascunhoDeSessao = { id: string | null; groupId: string; name: string; description: string; justification: string; kind: TipoSessao; limit: string };

/** Grupos e as sessões de cada um: criar, editar, mover de grupo e apagar. É onde cada lançamento entra. */
export function Grupos() {
  const { dados, erro, carregando, recarregar } = useDados<GruposResposta>("/api/grupos");
  const { ocupado, agir, confirmar } = useAcao();
  const [grupo, setGrupo] = useState<RascunhoDeGrupo | null>(null);
  const [sessao, setSessao] = useState<RascunhoDeSessao | null>(null);
  const [erroDaFolha, setErroDaFolha] = useState("");
  // A ordem que a pessoa arrasta mora aqui; o servidor devolve a gravada e ela volta a valer a cada carga.
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [todasAsSessoes, setTodasAsSessoes] = useState<Sessao[]>([]);
  const gruposRef = useRef<Grupo[]>([]);
  const sessoesRef = useRef<Sessao[]>([]);
  gruposRef.current = grupos;
  sessoesRef.current = todasAsSessoes;

  useEffect(() => {
    if (!dados) return;
    setGrupos(dados.groups);
    setTodasAsSessoes(dados.sessions);
  }, [dados]);

  useIonViewWillEnter(() => {
    if (dados) void recarregar();
  });

  // As encerradas ficam no fim do grupo, fora da ordem arrastável; as ativas seguem a ordem escolhida.
  const ativasDo = (id: string) => todasAsSessoes.filter((item) => item.groupId === id && !item.endedAt);
  const encerradasDo = (id: string) => todasAsSessoes.filter((item) => item.groupId === id && item.endedAt);
  const sessoesDo = (id: string) => [...ativasDo(id), ...encerradasDo(id)];

  async function gravarOrdem(caminho: string, corpo: unknown) {
    const ok = await agir("ordem", () => enviar(caminho, corpo, "PUT"), "Ordem salva.");
    if (!ok) await recarregar();
  }

  const soltarGrupos = () => void gravarOrdem("/api/grupos/ordem", { ids: gruposRef.current.map((item) => item.id) });

  function moverGrupo(id: string, passo: -1 | 1) {
    const lista = [...gruposRef.current];
    const de = lista.findIndex((item) => item.id === id);
    const para = de + passo;
    if (de < 0 || para < 0 || para >= lista.length) return;
    [lista[de], lista[para]] = [lista[para] as Grupo, lista[de] as Grupo];
    gruposRef.current = lista;
    setGrupos(lista);
    void gravarOrdem("/api/grupos/ordem", { ids: lista.map((item) => item.id) });
  }

  // A ordem vale dentro do grupo: troca só as ativas dele e deixa o resto onde está.
  function trocarSessoes(groupId: string, ativas: Sessao[]) {
    const lista = [
      ...sessoesRef.current.filter((item) => item.groupId !== groupId),
      ...ativas,
      ...sessoesRef.current.filter((item) => item.groupId === groupId && item.endedAt),
    ];
    sessoesRef.current = lista;
    setTodasAsSessoes(lista);
  }

  const idsDoGrupo = (groupId: string) => sessoesDoRef(groupId).map((item) => item.id);
  const sessoesDoRef = (groupId: string) => [
    ...sessoesRef.current.filter((item) => item.groupId === groupId && !item.endedAt),
    ...sessoesRef.current.filter((item) => item.groupId === groupId && item.endedAt),
  ];

  const soltarSessoes = (groupId: string) => void gravarOrdem("/api/sessoes/ordem", { groupId, ids: idsDoGrupo(groupId) });

  function moverSessao(groupId: string, id: string, passo: -1 | 1) {
    const ativas = sessoesRef.current.filter((item) => item.groupId === groupId && !item.endedAt);
    const de = ativas.findIndex((item) => item.id === id);
    const para = de + passo;
    if (de < 0 || para < 0 || para >= ativas.length) return;
    [ativas[de], ativas[para]] = [ativas[para] as Sessao, ativas[de] as Sessao];
    trocarSessoes(groupId, ativas);
    void gravarOrdem("/api/sessoes/ordem", { groupId, ids: idsDoGrupo(groupId) });
  }

  async function salvarGrupo() {
    if (!grupo) return;
    if (!grupo.name.trim()) return setErroDaFolha("Dê um nome ao grupo.");
    setErroDaFolha("");
    const corpo = { name: grupo.name.trim(), description: grupo.description.trim() };
    const ok = await agir(
      "grupo",
      () => (grupo.id ? enviar(`/api/grupos/${grupo.id}`, corpo, "PATCH") : enviar("/api/grupos", { id: crypto.randomUUID(), ...corpo })),
      grupo.id ? "Grupo salvo." : "Grupo criado.",
    );
    if (ok) {
      setGrupo(null);
      await recarregar();
    }
  }

  async function salvarSessao() {
    if (!sessao) return;
    if (!sessao.name.trim()) return setErroDaFolha("Dê um nome à sessão.");
    if (!sessao.groupId) return setErroDaFolha("Escolha um grupo.");
    const limitCents = sessao.kind === "acumulo" && sessao.limit.trim() ? centavosDe(sessao.limit) : null;
    if (sessao.kind === "acumulo" && sessao.limit.trim() && limitCents === null) return setErroDaFolha("Informe o limite em reais.");
    setErroDaFolha("");
    const corpo = {
      name: sessao.name.trim(),
      description: sessao.description.trim(),
      justification: sessao.justification.trim(),
      groupId: sessao.groupId,
      kind: sessao.kind,
      limitCents: limitCents || null,
    };
    const ok = await agir(
      "sessao",
      () => (sessao.id ? enviar(`/api/sessoes/${sessao.id}`, corpo, "PATCH") : enviar("/api/sessoes", { id: crypto.randomUUID(), ...corpo })),
      sessao.id ? "Sessão salva." : "Sessão criada.",
    );
    if (ok) {
      setSessao(null);
      await recarregar();
    }
  }

  function apagarGrupo(item: RascunhoDeGrupo) {
    if (!item.id) return;
    const id = item.id;
    const sessoes = sessoesDo(id).length;
    const texto =
      sessoes > 0
        ? `O grupo "${item.name}" e as sessões dele serão removidos. As linhas do extrato ligadas a eles voltam para a Conferência. Não pode ser desfeito.`
        : `O grupo "${item.name}" será removido. Não pode ser desfeito.`;
    confirmar("Excluir este grupo?", texto, "Excluir grupo", () =>
      void agir("apagar", () => pedir(`/api/grupos/${id}`, { method: "DELETE" }), "Grupo excluído.").then(async (ok) => {
        if (!ok) return;
        setGrupo(null);
        await recarregar();
      }),
    );
  }

  function apagarSessao(item: RascunhoDeSessao) {
    if (!item.id) return;
    const id = item.id;
    const texto = `A sessão "${item.name}" será excluída e o fim fica na data de hoje. As linhas do extrato ligadas a ela voltam para a Conferência. Não pode ser desfeito.`;
    confirmar("Excluir esta sessão?", texto, "Excluir sessão", () =>
      void agir("apagar", () => pedir(`/api/sessoes/${id}`, { method: "DELETE" }), "Sessão excluída.").then(async (ok) => {
        if (!ok) return;
        setSessao(null);
        await recarregar();
      }),
    );
  }

  const abrirSessao = (item: Sessao) =>
    setSessao({
      id: item.id,
      groupId: item.groupId,
      name: item.name,
      description: item.description,
      justification: item.justification,
      kind: item.kind,
      limit: item.limitCents ? paraCampo(item.limitCents) : "",
    });

  return (
    <Pagina
      titulo="Grupos e sessões"
      etiqueta="Onde cada lançamento entra"
      aoAtualizar={recarregar}
      semPerfil
      fim={
        <>
          <IonButton aria-label="Novo grupo" onClick={() => setGrupo({ id: null, name: "", description: "" })}>
            <IonIcon slot="icon-only" icon={addOutline} />
          </IonButton>
          <IonButton routerLink="/financas" routerDirection="back" aria-label="Voltar">
            <IonIcon slot="icon-only" icon={arrowBack} />
          </IonButton>
        </>
      }
    >
      <div className="pagina">
        <Virada aoConfirmar={recarregar} />
        <Estado carregando={carregando} erro={erro} tem={Boolean(dados)} aoTentar={() => void recarregar()} />
        {dados && dados.groups.length === 0 ? (
          <Vazio icone={folderOpenOutline} titulo="Nenhum grupo ainda" texto="Um grupo junta sessões, como Casa ou Renda. Cada lançamento entra numa sessão.">
            <IonButton className="principal" onClick={() => setGrupo({ id: null, name: "", description: "" })}>
              Criar grupo
            </IonButton>
          </Vazio>
        ) : null}
        {dados ? (
          <>
            {grupos.length > 1 ? <p className="fraco">Segure a alça ao lado do nome e arraste para mudar a ordem dos grupos e das sessões.</p> : null}
            <ListaOrdenavel itens={grupos} aoMudar={setGrupos} className="pagina sem-margem">
              {grupos.map((item: Grupo) => (
                <ItemOrdenavel key={item.id} valor={item} nome={item.name} aoSoltar={soltarGrupos} aoMover={(passo) => moverGrupo(item.id, passo)} className="secao ordenavel">
                  {(alca) => (
                    <>
                      <div className="titulo-do-dia com-alca">
                        {alca}
                        <button type="button" className="botao-link" onClick={() => setGrupo({ id: item.id, name: item.name, description: item.description })}>
                          <strong>{item.name}</strong>
                        </button>
                        <IonButton
                          size="small"
                          fill="clear"
                          onClick={() => setSessao({ id: null, groupId: item.id, name: "", description: "", justification: "", kind: "acumulo", limit: "" })}
                        >
                          + Sessão
                        </IonButton>
                      </div>
                      {item.description ? <span className="fraco">{item.description}</span> : null}
                      <div className="lista">
                        {sessoesDo(item.id).length === 0 ? <div className="linha fraco">Sem sessões.</div> : null}
                        <ListaOrdenavel itens={ativasDo(item.id)} aoMudar={(novas) => trocarSessoes(item.id, novas)}>
                          {ativasDo(item.id).map((sessaoDoGrupo) => (
                            <ItemOrdenavel
                              key={sessaoDoGrupo.id}
                              valor={sessaoDoGrupo}
                              nome={sessaoDoGrupo.name}
                              aoSoltar={() => soltarSessoes(item.id)}
                              aoMover={(passo) => moverSessao(item.id, sessaoDoGrupo.id, passo)}
                              className="linha ordenavel"
                            >
                              {(alcaDaSessao) => (
                                <>
                                  {alcaDaSessao}
                                  <button type="button" className="linha-conteudo" onClick={() => abrirSessao(sessaoDoGrupo)}>
                                    <span className="texto">
                                      <span>{sessaoDoGrupo.name}</span>
                                      <span className="etiqueta">
                                        {ROTULO_DO_TIPO_DE_SESSAO[sessaoDoGrupo.kind]}
                                        {sessaoDoGrupo.limitCents ? ` · limite ${reais(sessaoDoGrupo.limitCents)}` : ""}
                                      </span>
                                    </span>
                                  </button>
                                </>
                              )}
                            </ItemOrdenavel>
                          ))}
                        </ListaOrdenavel>
                        {encerradasDo(item.id).map((sessaoDoGrupo) => (
                          <button key={sessaoDoGrupo.id} type="button" className="linha linha-botao" onClick={() => abrirSessao(sessaoDoGrupo)}>
                            <span className="texto">
                              <span>{sessaoDoGrupo.name}</span>
                              <span className="etiqueta">{ROTULO_DO_TIPO_DE_SESSAO[sessaoDoGrupo.kind]}</span>
                            </span>
                            <span className="chip">Encerrada</span>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </ItemOrdenavel>
              ))}
            </ListaOrdenavel>
          </>
        ) : null}
      </div>

      <Folha aberta={grupo !== null} titulo={grupo?.id ? "Editar grupo" : "Novo grupo"} aoFechar={() => (setGrupo(null), setErroDaFolha(""))}>
        {grupo ? (
          <>
            <Campo icone={folderOpenOutline} rotulo="Nome" value={grupo.name} onMudar={(name) => setGrupo({ ...grupo, name })} placeholder="Casa, Renda, Lazer" maxLength={80} />
            <AreaDeTexto rotulo="Descrição" value={grupo.description} onMudar={(description) => setGrupo({ ...grupo, description })} linhas={2} maxLength={160} />
            {erroDaFolha ? <p className="erro">{erroDaFolha}</p> : null}
            <IonButton expand="block" className="principal" disabled={Boolean(ocupado)} onClick={() => void salvarGrupo()}>
              {grupo.id ? "Salvar" : "Criar grupo"}
            </IonButton>
            {grupo.id ? (
              <IonButton expand="block" fill="clear" color="danger" disabled={Boolean(ocupado)} onClick={() => apagarGrupo(grupo)}>
                Excluir o grupo
              </IonButton>
            ) : null}
          </>
        ) : null}
      </Folha>

      <Folha aberta={sessao !== null} titulo={sessao?.id ? "Editar sessão" : "Nova sessão"} aoFechar={() => (setSessao(null), setErroDaFolha(""))}>
        {sessao ? (
          <>
            <Campo icone={pricetagOutline} rotulo="Nome" value={sessao.name} onMudar={(name) => setSessao({ ...sessao, name })} placeholder="Salário, Mercado, Aluguel" maxLength={80} />
            <Selecao rotulo="Grupo" valor={sessao.groupId} opcoes={(dados?.groups ?? []).map((item) => ({ id: item.id, texto: item.name }))} aoMudar={(groupId) => setSessao({ ...sessao, groupId })} />
            <div className="campo">
              <span className="etiqueta">Tipo</span>
              <Fichas rotulo="Tipo" valor={sessao.kind} opcoes={TIPOS_SESSAO.map((kind) => ({ id: kind, texto: ROTULO_DO_TIPO_DE_SESSAO[kind] }))} aoMudar={(kind) => setSessao({ ...sessao, kind })} />
              <span className="fraco">{sessao.kind === "valor" ? "Fixo guarda uma transação por mês." : "Acúmulo junta várias transações no mês."}</span>
            </div>
            {sessao.kind === "acumulo" ? (
              <Campo icone={cashOutline} rotulo="Limite de saídas por mês (opcional)" value={sessao.limit} onMudar={(limit) => setSessao({ ...sessao, limit })} inputMode="decimal" placeholder="Sem limite" />
            ) : null}
            <AreaDeTexto rotulo="Descrição" value={sessao.description} onMudar={(description) => setSessao({ ...sessao, description })} linhas={2} maxLength={160} />
            <AreaDeTexto rotulo="Por que existe" value={sessao.justification} onMudar={(justification) => setSessao({ ...sessao, justification })} linhas={2} maxLength={160} />
            {erroDaFolha ? <p className="erro">{erroDaFolha}</p> : null}
            <IonButton expand="block" className="principal" disabled={Boolean(ocupado)} onClick={() => void salvarSessao()}>
              {sessao.id ? "Salvar" : "Criar sessão"}
            </IonButton>
            {sessao.id ? (
              <IonButton expand="block" fill="clear" color="danger" disabled={Boolean(ocupado)} onClick={() => apagarSessao(sessao)}>
                Excluir a sessão
              </IonButton>
            ) : null}
          </>
        ) : null}
      </Folha>
    </Pagina>
  );
}

/** Na virada do ano: o que continua no ano novo. Desmarcado, o grupo ou a sessão encerra em 31/12. */
function Virada({ aoConfirmar }: { aoConfirmar: () => Promise<void> }) {
  const { ocupado, agir } = useAcao();
  const [virada, setVirada] = useState<Pendente | null>(null);
  const [grupos, setGrupos] = useState<string[]>([]);
  const [sessoes, setSessoes] = useState<string[]>([]);

  useEffect(() => {
    let vivo = true;
    void ler<ViradaResposta>("/api/grupos/virada")
      .then((resposta) => {
        if (!vivo || !resposta.pendente) return;
        setVirada(resposta);
        setGrupos(resposta.groups.map((item) => item.id));
        setSessoes(resposta.groups.flatMap((item) => item.sessions.map((sessao) => sessao.id)));
      })
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, []);

  if (!virada) return null;

  async function confirmar() {
    if (!virada) return;
    const sessionIds = virada.groups.flatMap((item) => (grupos.includes(item.id) ? item.sessions.filter((sessao) => sessoes.includes(sessao.id)).map((sessao) => sessao.id) : []));
    const ok = await agir("virada", () => enviar("/api/grupos/virada", { year: virada.year, groupIds: grupos, sessionIds }), "Grupos e sessões atualizados para o ano novo.");
    if (ok) {
      setVirada(null);
      await aoConfirmar();
    }
  }

  return (
    <div className="cartao secao destaque">
      <strong>Revisar o ano {virada.year}</strong>
      <span className="fraco">Tudo continua como está. Se algum grupo ou sessão acabou com o ano, desmarque: ele encerra em 31/12/{virada.year - 1}.</span>
      {virada.groups.map((item) => {
        const marcado = grupos.includes(item.id);
        return (
          <div key={item.id} className="secao" style={{ gap: 4 }}>
            <IonCheckbox
              labelPlacement="end"
              justify="start"
              checked={marcado}
              onIonChange={(evento) => {
                const sim = evento.detail.checked;
                setGrupos((atual) => (sim ? [...atual, item.id] : atual.filter((id) => id !== item.id)));
              }}
            >
              <strong>{item.name}</strong>
            </IonCheckbox>
            {item.sessions.map((sessao) => (
              <IonCheckbox
                key={sessao.id}
                labelPlacement="end"
                justify="start"
                style={{ marginLeft: 28 }}
                disabled={!marcado}
                checked={marcado && sessoes.includes(sessao.id)}
                onIonChange={(evento) => {
                  const sim = evento.detail.checked;
                  setSessoes((atual) => (sim ? [...atual, sessao.id] : atual.filter((id) => id !== sessao.id)));
                }}
              >
                {sessao.name}
              </IonCheckbox>
            ))}
          </div>
        );
      })}
      <IonButton className="principal" disabled={Boolean(ocupado)} onClick={() => void confirmar()}>
        Confirmar o ano novo
      </IonButton>
    </div>
  );
}
