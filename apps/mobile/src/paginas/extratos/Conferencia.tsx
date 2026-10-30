import { IonButton, IonIcon, IonRadio, IonRadioGroup, useIonToast } from "@ionic/react";
import {
  categoriaDeCompromisso,
  tipoDaCategoria,
  type AcumuloEmLote,
  type ConferenciaResposta,
  type GruposResposta,
  type LinhaConferencia,
  type ValorDoMes,
  type VinculoCruzado,
} from "@finnagent/contracts";
import { checkmarkCircleOutline, chevronDown, searchOutline } from "ionicons/icons";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import { diaEMes } from "../../api/arquivo";
import { enviar } from "../../api/cliente";
import { reais, rotuloDoMes } from "../../api/formato";
import { Campo } from "../../componentes/Campo";
import { Dinheiro, Estado, Vazio } from "../../componentes/Estado";
import { Fichas, Selecao } from "../../componentes/Selecao";
import { SeletorDeMes } from "../../componentes/SeletorDeMes";
import { toque } from "../../haptico";
import { Bloco, Cascata, Contagem, Preenchimento, Troca, curvaCheia, toqueDoDedo } from "../../movimento";
import { useDados } from "../../useDados";
import { useMes } from "../../useMes";

type Situacao = "todas" | "abertas" | "cruzadas" | "propostas";

const SITUACOES: Array<{ id: Situacao; texto: string }> = [
  { id: "todas", texto: "Todas" },
  { id: "abertas", texto: "Sem lançamento" },
  { id: "cruzadas", texto: "Cruzadas" },
  { id: "propostas", texto: "Com proposta" },
];

const chaveDa = (linha: LinhaConferencia) => `${linha.statementId}:${linha.line}`;
const textoDoVinculo = (vinculo: VinculoCruzado) => `${vinculo.description} · ${vinculo.groupName} / ${vinculo.sessionName}`;
const rotuloDoCandidato = (vinculo: VinculoCruzado) => `${tipoDaCategoria(vinculo.category)} · ${textoDoVinculo(vinculo)} · dia ${vinculo.day} · ${reais(vinculo.cents)}`;
// Fixa, parcela e empréstimo com valor diferente do extrato: a pessoa diz qual valor vale neste mês.
const pedeValorDoMes = (candidato: VinculoCruzado, cents: number) => categoriaDeCompromisso(candidato.category) && candidato.cents !== cents;

export function Conferencia() {
  const [avisar] = useIonToast();
  const { mes, direcao, mudar } = useMes();
  const caminho = `/api/extratos/conferencia?year=${mes.ano}&month=${mes.mes}`;
  const { dados: carregado, erro, carregando, recarregar } = useDados<ConferenciaResposta>(caminho);
  const grupos = useDados<GruposResposta>("/api/grupos");
  // A resposta de cada ação traz a conferência já atualizada: ela passa na frente do que foi carregado.
  const [atualizada, setAtualizada] = useState<{ caminho: string; dados: ConferenciaResposta } | null>(null);
  const dados = atualizada && atualizada.caminho === caminho ? atualizada.dados : carregado;

  const [situacao, setSituacao] = useState<Situacao>("todas");
  const [busca, setBusca] = useState("");
  const [aberta, setAberta] = useState("");
  const [escolha, setEscolha] = useState<Record<string, string>>({});
  const [par, setPar] = useState<Record<string, string>>({});
  const [valorMes, setValorMes] = useState<Record<string, ValorDoMes | "">>({});
  const [ocupado, setOcupado] = useState("");

  const sessoes = useMemo(() => {
    const nomes = new Map((grupos.dados?.groups ?? []).map((grupo) => [grupo.id, grupo.name]));
    return (grupos.dados?.sessions ?? [])
      .filter((sessao) => !sessao.endedAt && (sessao.kind !== "valor" || sessao.available))
      .map((sessao) => ({ id: sessao.id, texto: `${nomes.get(sessao.groupId) ?? "Grupo"} / ${sessao.name}` }));
  }, [grupos.dados]);

  const dizer = (mensagem: string, erroNoAviso = false) =>
    void avisar({ message: mensagem, duration: 3200, position: "top", cssClass: erroNoAviso ? "aviso-de-erro" : undefined });

  const lancamentoDa = (linha: LinhaConferencia) => par[chaveDa(linha)] ?? linha.suggestion?.entryId ?? "";
  const sessaoDa = (linha: LinhaConferencia) => escolha[chaveDa(linha)] ?? linha.sessionId ?? "";

  async function acao<T>(chave: string, fazer: () => Promise<T>, aoTerminar: (resposta: T) => void, falha: string) {
    setOcupado(chave);
    try {
      aoTerminar(await fazer());
      toque(true);
    } catch (error) {
      dizer(error instanceof Error ? error.message : falha, true);
    } finally {
      setOcupado("");
    }
  }

  const guardar = (resposta: ConferenciaResposta) => setAtualizada({ caminho, dados: resposta });

  function confirmar(linha: LinhaConferencia) {
    const chave = chaveDa(linha);
    const entryId = lancamentoDa(linha);
    const candidato = linha.candidates.find((item) => item.entryId === entryId) ?? (linha.suggestion?.entryId === entryId ? linha.suggestion : undefined);
    const valor = valorMes[chave];
    if (!entryId) return dizer("Escolha o lançamento desta linha.", true);
    if (candidato && pedeValorDoMes(candidato, linha.cents) && !valor) return dizer("Escolha o valor deste mês: o do extrato ou o do lançamento.", true);
    void acao(
      chave,
      () => enviar<ConferenciaResposta>("/api/extratos/cruzamentos", { statementId: linha.statementId, line: linha.line, entryId, ...(valor ? { valor } : {}) }),
      (resposta) => {
        guardar(resposta);
        setPar({});
        setValorMes({});
        dizer("Cruzamento confirmado. A ocorrência do mês ficou paga.");
      },
      "Não foi possível confirmar o cruzamento.",
    );
  }

  function desfazer(linha: LinhaConferencia) {
    void acao(
      chaveDa(linha),
      () => enviar<ConferenciaResposta>("/api/extratos/cruzamentos/desfazer", { statementId: linha.statementId, line: linha.line }),
      (resposta) => {
        guardar(resposta);
        dizer("Cruzamento desfeito. A ocorrência voltou a pendente.");
      },
      "Não foi possível desfazer o cruzamento.",
    );
  }

  function acumular(linha: LinhaConferencia) {
    const sessionId = sessaoDa(linha);
    if (!sessionId) return dizer("Escolha a sessão para acumular.", true);
    void acao(
      chaveDa(linha),
      () => enviar<ConferenciaResposta>("/api/extratos/acumular", { statementId: linha.statementId, line: linha.line, sessionId }),
      (resposta) => {
        guardar(resposta);
        setPar({});
        dizer("Linha lançada na sessão. O nome fica lembrado para a próxima importação.");
      },
      "Não foi possível acumular a linha.",
    );
  }

  const linhas = dados?.lines ?? [];
  const cruzadas = linhas.filter((linha) => linha.link).length;
  const entradas = linhas.reduce((soma, linha) => soma + (linha.cents > 0 ? linha.cents : 0), 0);
  const saidas = linhas.reduce((soma, linha) => soma + (linha.cents < 0 ? linha.cents : 0), 0);
  // Linhas sem lançamento que já têm sessão, escolhida agora ou sugerida: dá para lançar todas de uma vez.
  const comSessao = linhas.filter((linha) => !linha.link && Boolean(sessaoDa(linha)));

  function lancarTodas() {
    const itens = comSessao.map((linha) => ({ statementId: linha.statementId, line: linha.line, sessionId: sessaoDa(linha) }));
    void acao(
      "lote",
      () => enviar<AcumuloEmLote>("/api/extratos/acumular-lote", { items: itens }),
      (resultado) => {
        setEscolha({});
        setPar({});
        if (resultado.failed.length === 0) dizer(resultado.launched === 1 ? "1 linha lançada na sessão." : `${resultado.launched} linhas lançadas na sessão.`);
        else if (resultado.launched === 0) dizer(resultado.failed[0]?.message || "Não foi possível lançar as linhas.", true);
        else dizer(`${resultado.launched} lançadas. ${resultado.failed.length} não entraram.`, true);
        setAtualizada(null);
        void recarregar();
      },
      "Não foi possível lançar as linhas.",
    );
  }

  const termo = busca.trim().toLowerCase();
  const filtradas = linhas.filter((linha) => {
    if (termo && ![linha.description, linha.accountName, linha.filename].some((valor) => valor.toLowerCase().includes(termo))) return false;
    if (situacao === "abertas" && linha.link) return false;
    if (situacao === "cruzadas" && !linha.link) return false;
    if (situacao === "propostas" && !linha.suggestion) return false;
    return true;
  });
  const dias = [...filtradas]
    .sort((a, b) => a.date.localeCompare(b.date) || a.line - b.line)
    .reduce<Array<{ data: string; itens: LinhaConferencia[] }>>((grupo, linha) => {
      const ultimo = grupo[grupo.length - 1];
      if (ultimo?.data === linha.date) ultimo.itens.push(linha);
      else grupo.push({ data: linha.date, itens: [linha] });
      return grupo;
    }, []);

  function mudarMes(proximo: typeof mes) {
    setAtualizada(null);
    setAberta("");
    setEscolha({});
    setValorMes({});
    mudar(proximo);
  }

  return (
    <div className="secao" style={{ gap: 16 }}>
      <SeletorDeMes mes={mes} direcao={direcao} aoMudar={mudarMes} />

      <Troca chave={rotuloDoMes(mes)} direcao={direcao}>
        <Estado carregando={carregando} erro={erro} tem={Boolean(dados)} aoTentar={() => void recarregar()} />

        {dados && linhas.length === 0 ? (
          <Vazio icone={checkmarkCircleOutline} titulo="Nenhuma linha neste mês" texto="Importe o extrato do banco deste mês para conferir cada linha com um lançamento." />
        ) : null}

        {dados && linhas.length > 0 ? (
          <Cascata className="secao">
            <Bloco>
              <p className={dados.checked ? "aviso conferido" : "aviso"} role="status">
                {dados.checked
                  ? "Mês conferido. Toda linha do extrato tem lançamento."
                  : `${dados.pending} ${dados.pending === 1 ? "linha ainda não tem" : "linhas ainda não têm"} lançamento. Cruze com um lançamento ou escolha uma sessão para lançar: o mês só fica conferido quando não sobrar nenhuma.`}
              </p>
            </Bloco>

            <Bloco className="cartao">
              <span className="etiqueta">Sobra do mês no extrato</span>
              <span className="numero grande">
                <Contagem valor={entradas + saidas} formatar={reais} className={entradas + saidas < 0 ? "neg" : "pos"} />
              </span>
              <div className="secao" style={{ gap: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span className="etiqueta">Conferido</span>
                  <span className="etiqueta">
                    {cruzadas} de {linhas.length}
                  </span>
                </div>
                <div className="barra" role="progressbar" aria-valuenow={cruzadas} aria-valuemin={0} aria-valuemax={linhas.length} aria-label="Linhas conferidas">
                  <Preenchimento porcento={(cruzadas / linhas.length) * 100} />
                </div>
              </div>
              <div className="grade separada">
                <div className="secao" style={{ gap: 4 }}>
                  <span className="etiqueta">Entradas</span>
                  <span className="numero pos">{reais(entradas)}</span>
                </div>
                <div className="secao" style={{ gap: 4 }}>
                  <span className="etiqueta">Saídas</span>
                  <span className="numero neg">{reais(saidas)}</span>
                </div>
              </div>
            </Bloco>

            <Bloco>
              <Campo rotulo="Buscar" icone={searchOutline} type="search" placeholder="Nome, conta ou arquivo" value={busca} onMudar={setBusca} />
            </Bloco>
            <Bloco>
              <Fichas<Situacao> rotulo="Situação" valor={situacao} opcoes={SITUACOES} aoMudar={setSituacao} />
            </Bloco>

            {dias.length === 0 ? <p className="fraco">Nenhuma linha com esses filtros.</p> : null}

            {dias.map((dia) => (
              <Bloco key={`${situacao}-${dia.data}`} className="secao">
                <span className="etiqueta">{diaEMes(dia.data)}</span>
                <div className="secao" style={{ gap: 8 }}>
                  {dia.itens.map((linha) => {
                    const chave = chaveDa(linha);
                    const expandida = aberta === chave;
                    const entryId = lancamentoDa(linha);
                    const candidatos = linha.suggestion && !linha.candidates.some((item) => item.entryId === linha.suggestion?.entryId) ? [linha.suggestion, ...linha.candidates] : linha.candidates;
                    const escolhido = candidatos.find((item) => item.entryId === entryId);
                    const pedeValor = escolhido ? pedeValorDoMes(escolhido, linha.cents) : false;
                    return (
                      <div key={chave} className="linha-de-conferencia">
                        <button type="button" className="cabeca-da-linha" aria-expanded={expandida} onClick={() => setAberta(expandida ? "" : chave)}>
                          <span className="texto" style={{ minWidth: 0 }}>
                            <strong style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{linha.description}</strong>
                            <span className="etiqueta">{linha.accountName}</span>
                          </span>
                          <span className="texto" style={{ justifyItems: "end" }}>
                            <Dinheiro cents={linha.cents} />
                            <span className={linha.link ? "chip ok" : linha.suggestion ? "chip ia" : "chip"}>{linha.link ? "Cruzada" : linha.suggestion ? "Proposta" : "Sem lançamento"}</span>
                          </span>
                          <motion.span animate={{ rotate: expandida ? 180 : 0 }} style={{ display: "inline-flex" }}>
                            <IonIcon icon={chevronDown} aria-hidden />
                          </motion.span>
                        </button>

                        <AnimatePresence initial={false}>
                          {expandida ? (
                            <motion.div key="acoes" className="secao" style={{ gap: 16, overflow: "hidden" }} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={curvaCheia}>
                              {linha.link ? (
                                <>
                                  <p className="fraco">Cruzada com {textoDoVinculo(linha.link)} · dia {linha.link.day} · {reais(linha.link.cents)}</p>
                                  <IonButton fill="outline" color="danger" disabled={ocupado === chave} onClick={() => desfazer(linha)}>
                                    Desfazer o cruzamento
                                  </IonButton>
                                </>
                              ) : (
                                <>
                                  {candidatos.length > 0 ? (
                                    <div className="secao" style={{ gap: 12 }}>
                                      <Selecao
                                        rotulo={linha.suggestion ? `Lançamento · proposto ${linha.suggestionSource === "nome" ? "pelo nome" : "pelo valor"}` : "Lançamento"}
                                        valor={entryId}
                                        vazio="Escolha o lançamento"
                                        opcoes={candidatos.map((item) => ({ id: item.entryId, texto: rotuloDoCandidato(item) }))}
                                        aoMudar={(valor) => setPar((atual) => ({ ...atual, [chave]: valor }))}
                                      />
                                      {escolhido ? <span className="fraco" style={{ fontSize: "0.875rem" }}>{rotuloDoCandidato(escolhido)}</span> : null}
                                      {pedeValor && escolhido ? (
                                        <div className="secao" style={{ gap: 8 }}>
                                          <span className="etiqueta">Qual valor vale neste mês?</span>
                                          <IonRadioGroup
                                            value={valorMes[chave] ?? ""}
                                            onIonChange={(evento) => setValorMes((atual) => ({ ...atual, [chave]: evento.detail.value as "extrato" | "lancamento" }))}
                                          >
                                            {(["extrato", "lancamento"] as const).map((opcao) => (
                                              <IonRadio key={opcao} value={opcao} labelPlacement="end" justify="start" className={`opcao-de-valor${valorMes[chave] === opcao ? " ativa" : ""}`}>
                                                {opcao === "extrato" ? "O do extrato" : "O do lançamento"}: <strong>{reais(opcao === "extrato" ? linha.cents : escolhido.cents)}</strong>
                                              </IonRadio>
                                            ))}
                                          </IonRadioGroup>
                                        </div>
                                      ) : null}
                                      <motion.div whileTap={toqueDoDedo}>
                                        <IonButton expand="block" className="principal" disabled={ocupado === chave || !entryId} onClick={() => confirmar(linha)}>
                                          Confirmar cruzamento
                                        </IonButton>
                                      </motion.div>
                                    </div>
                                  ) : (
                                    <p className="fraco">Nenhum lançamento deste mês combina com a linha.</p>
                                  )}
                                  <div className="secao" style={{ gap: 12 }}>
                                    <Selecao
                                      rotulo={linha.sessionSource === "compromisso" && linha.appointmentTitle ? `Sessão · pelo compromisso "${linha.appointmentTitle}"` : linha.sessionSource === "nome" ? "Sessão · lembrada pelo nome" : "Lançar numa sessão"}
                                      valor={sessaoDa(linha)}
                                      vazio="Escolha a sessão"
                                      opcoes={sessoes}
                                      aoMudar={(valor) => setEscolha((atual) => ({ ...atual, [chave]: valor }))}
                                    />
                                    <IonButton fill="outline" disabled={ocupado === chave || !sessaoDa(linha)} onClick={() => acumular(linha)}>
                                      Lançar na sessão
                                    </IonButton>
                                  </div>
                                </>
                              )}
                            </motion.div>
                          ) : null}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>
              </Bloco>
            ))}

            <AnimatePresence>
              {comSessao.length > 0 ? (
                <motion.div className="barra-de-lote" initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }} transition={curvaCheia}>
                  <span className="etiqueta" style={{ flex: 1 }}>
                    {comSessao.length} {comSessao.length === 1 ? "linha com sessão" : "linhas com sessão"}
                  </span>
                  <IonButton className="principal" disabled={ocupado === "lote"} onClick={lancarTodas}>
                    {ocupado === "lote" ? "Lançando" : "Lançar todas"}
                  </IonButton>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </Cascata>
        ) : null}
      </Troca>
    </div>
  );
}
