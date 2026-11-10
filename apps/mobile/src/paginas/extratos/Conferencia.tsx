import { IonButton, IonIcon, IonRadio, IonRadioGroup, useIonToast } from "@ionic/react";
import {
  CATEGORIAS_TRANSACAO,
  RECORRENCIAS,
  categoriaDeCompromisso,
  categoriaSempreEntrada,
  categoriaSempreSaida,
  erroDoTipoDaLinha,
  sessaoAceitaNoMes,
  tipoDaCategoria,
  type AcumuloEmLote,
  type CategoriaTransacao,
  type EscolhaDaLinhaNaSerie,
  type PreviaDaSerie,
  type Recorrencia,
  type SerieComLinhas,
  type SerieLancada,
  type SeriesComLinhasResposta,
  type TipoDaLinha,
  type ConferenciaResposta,
  type ContasResposta,
  type GruposResposta,
  type LinhaConferencia,
  type ValorDoMes,
  type VinculoCruzado,
} from "@finnagent/contracts";
import { cashOutline, checkmarkCircleOutline, chevronDown, closeOutline, searchOutline } from "ionicons/icons";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import { diaEMes } from "../../api/arquivo";
import { enviar } from "../../api/cliente";
import { centavosDe, reais, rotuloDoMes } from "../../api/formato";
import { Campo } from "../../componentes/Campo";
import { Dinheiro, Estado, Vazio } from "../../componentes/Estado";
import { Folha } from "../../componentes/Folha";
import { ROTULO_CATEGORIA, ROTULO_RECORRENCIA } from "../financas/rotulos";
import { FolhaDaSerie, type PedidoDaSerie } from "./Serie";
import { Fichas, Selecao } from "../../componentes/Selecao";
import { SeletorDeMes } from "../../componentes/SeletorDeMes";
import { toque } from "../../haptico";
import { Bloco, Cascata, Contagem, Preenchimento, Troca, curvaCheia, toqueDoDedo } from "../../movimento";
import { useDados } from "../../useDados";
import { useMes } from "../../useMes";

type Situacao = "todas" | "abertas" | "cruzadas" | "propostas" | "ignoradas";

const SITUACOES: Array<{ id: Situacao; texto: string }> = [
  { id: "todas", texto: "Todas" },
  { id: "abertas", texto: "Sem lançamento" },
  { id: "cruzadas", texto: "Cruzadas" },
  { id: "propostas", texto: "Com proposta" },
  { id: "ignoradas", texto: "Ignoradas" },
];

type Parte = { valor: string; sessionId: string };

/** O tipo do lançamento que a linha vira, como a pessoa digita. Única é o padrão e não manda nada. */
type RascunhoDoTipo = { category: CategoriaTransacao; installments: string; installmentNumber: string; counterparty: string; principal: string; recurrence: Recorrencia; recurrenceInterval: string };
const RASCUNHO_UNICO: RascunhoDoTipo = { category: "unique", installments: "", installmentNumber: "1", counterparty: "", principal: "", recurrence: "monthly", recurrenceInterval: "1" };

const numeroDe = (texto: string) => (texto.trim() === "" || !Number.isFinite(Number(texto)) ? null : Number(texto));

function tipoDoRascunho(rascunho: RascunhoDoTipo): TipoDaLinha {
  const { category } = rascunho;
  if (category === "installment") return { category, installments: numeroDe(rascunho.installments), installmentNumber: numeroDe(rascunho.installmentNumber) };
  if (category === "loan") return { category, installments: numeroDe(rascunho.installments) ?? 1, counterparty: rascunho.counterparty.trim(), principalCents: centavosDe(rascunho.principal) };
  if (category === "fixed") return { category, recurrence: rascunho.recurrence, recurrenceInterval: numeroDe(rascunho.recurrenceInterval) };
  return { category };
}

/** As categorias que a sessão aceita e que combinam com o sinal: extra só em entrada, parcela só em saída. */
function categoriasDaLinha(cents: number, aceitas?: readonly CategoriaTransacao[]) {
  const ordem: readonly CategoriaTransacao[] = ["unique", ...CATEGORIAS_TRANSACAO.filter((categoria) => categoria !== "unique")];
  return ordem.filter((categoria) => {
    if (aceitas && !aceitas.includes(categoria)) return false;
    if (cents < 0 && categoriaSempreEntrada(categoria)) return false;
    if (cents > 0 && categoriaSempreSaida(categoria)) return false;
    return true;
  });
}

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
  const contas = useDados<ContasResposta>("/api/contas");
  const series = useDados<SeriesComLinhasResposta>("/api/extratos/series");
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
  const [contaDoPar, setContaDoPar] = useState<Record<string, string>>({});
  const [dividindo, setDividindo] = useState<{ linha: LinhaConferencia; partes: Parte[] } | null>(null);
  const [tipos, setTipos] = useState<Record<string, RascunhoDoTipo>>({});
  const [serie, setSerie] = useState<
    { modo: "nova"; linha: LinhaConferencia; sessionId: string; tipo: TipoDaLinha; pedido: PedidoDaSerie } | { modo: "existente"; existente: SerieComLinhas; pedido: PedidoDaSerie } | null
  >(null);

  const sessoes = useMemo(() => {
    const nomes = new Map((grupos.dados?.groups ?? []).map((grupo) => [grupo.id, grupo.name]));
    return (grupos.dados?.sessions ?? [])
      // A Fixo some só no mês em que já tem a transação dela.
      .filter((sessao) => !sessao.endedAt && sessaoAceitaNoMes(sessao, mes.ano, mes.mes))
      .map((sessao) => ({ id: sessao.id, texto: `${nomes.get(sessao.groupId) ?? "Grupo"} / ${sessao.name}` }));
  }, [grupos.dados, mes.ano, mes.mes]);

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

  const categoriasDaSessao = (linha: LinhaConferencia) => grupos.dados?.sessions.find((item) => item.id === sessaoDa(linha))?.categories;
  // A categoria que a sessão escolhida não aceita mais volta para única.
  const rascunhoDa = (linha: LinhaConferencia) => {
    const rascunho = tipos[chaveDa(linha)] ?? RASCUNHO_UNICO;
    return categoriasDaLinha(linha.cents, categoriasDaSessao(linha)).includes(rascunho.category) ? rascunho : RASCUNHO_UNICO;
  };
  const mudarTipo = (linha: LinhaConferencia, parte: Partial<RascunhoDoTipo>) => setTipos((atual) => ({ ...atual, [chaveDa(linha)]: { ...rascunhoDa(linha), ...parte } }));

  function lancouNaSessao(resposta: ConferenciaResposta, linha: LinhaConferencia) {
    guardar(resposta);
    setPar({});
    setTipos((atual) => {
      const proximo = { ...atual };
      delete proximo[chaveDa(linha)];
      return proximo;
    });
    dizer("Linha lançada na sessão. O nome fica lembrado para a próxima importação.");
  }

  async function acumular(linha: LinhaConferencia, semSerie = false) {
    const sessionId = sessaoDa(linha);
    if (!sessionId) return dizer("Escolha a sessão para acumular.", true);
    const tipo = tipoDoRascunho(rascunhoDa(linha));
    const erroDoTipo = erroDoTipoDaLinha(tipo, linha.cents);
    if (erroDoTipo) return dizer(erroDoTipo, true);
    const comTipo = tipo.category === "unique" ? {} : { tipo };
    // Parcela, empréstimo ou recorrente: se a mesma compra aparece em outros meses importados, mostra todos antes.
    if (!semSerie && (tipo.category === "installment" || tipo.category === "loan" || tipo.category === "fixed")) {
      setOcupado(chaveDa(linha));
      try {
        const previa = await enviar<PreviaDaSerie>("/api/extratos/series/previa", { statementId: linha.statementId, line: linha.line, tipo });
        if (previa.meses.flatMap((mes) => mes.lines).length > 1) {
          setSerie({
            modo: "nova",
            linha,
            sessionId,
            tipo,
            pedido: { titulo: `${linha.description} aparece em outros meses`, tipo: ROTULO_CATEGORIA[tipo.category], meses: previa.meses, origem: chaveDa(linha) },
          });
          return;
        }
      } catch {
        // Sem a prévia, a linha segue sozinha.
      } finally {
        setOcupado("");
      }
    }
    void acao(
      chaveDa(linha),
      () => enviar<ConferenciaResposta>("/api/extratos/acumular", { statementId: linha.statementId, line: linha.line, sessionId, ...comTipo }),
      (resposta) => lancouNaSessao(resposta, linha),
      "Não foi possível acumular a linha.",
    );
  }

  function avisarSerie(resultado: SerieLancada) {
    if (resultado.failed.length === 0) dizer(resultado.launched === 1 ? "1 linha lançada na série." : `${resultado.launched} linhas lançadas na série.`);
    else dizer(`${resultado.launched} lançadas. ${resultado.failed.length} não entraram: ${resultado.failed[0]?.message ?? ""}`, true);
  }

  function confirmarSerie(escolha: EscolhaDaLinhaNaSerie[]) {
    if (!serie) return;
    void acao(
      "serie",
      () =>
        serie.modo === "nova"
          ? enviar<SerieLancada>("/api/extratos/series", { statementId: serie.linha.statementId, line: serie.linha.line, sessionId: serie.sessionId, tipo: serie.tipo, linhas: escolha })
          : enviar<SerieLancada>(`/api/extratos/series/${serie.existente.entryId}/linhas`, { linhas: escolha }),
      (resultado) => {
        avisarSerie(resultado);
        setSerie(null);
        setTipos({});
        setAtualizada(null);
        void recarregar();
        void series.recarregar();
      },
      "Não foi possível lançar a série.",
    );
  }

  /** Ignorar não apaga: a linha sai das pendentes e pode ser reativada no filtro Ignoradas. */
  function ignorar(linha: LinhaConferencia, ignored: boolean) {
    void acao(
      chaveDa(linha),
      () => enviar<{ changed: number }>("/api/extratos/ignorar", { items: [{ statementId: linha.statementId, line: linha.line }], ignored }),
      () => {
        setAberta("");
        setAtualizada(null);
        void recarregar();
        dizer(ignored ? "Linha ignorada. Ela não é apagada e pode ser reativada." : "Linha reativada.");
      },
      "Não foi possível mudar a linha.",
    );
  }

  /** A linha é dinheiro indo para outra conta da pessoa: lança a transferência nos dois lados. */
  function transferir(linha: LinhaConferencia) {
    const accountId = contaDoPar[chaveDa(linha)] ?? "";
    if (!accountId) return dizer("Escolha a outra conta.", true);
    void acao(
      chaveDa(linha),
      () => enviar<{ espelho?: boolean }>("/api/extratos/transferir", { statementId: linha.statementId, line: linha.line, accountId }),
      (feito) => {
        setAberta("");
        setAtualizada(null);
        void recarregar();
        dizer(feito.espelho ? "Transferência lançada. A linha espelho do outro extrato foi cruzada junto." : "Transferência lançada nos dois lados.");
      },
      "Não foi possível marcar a transferência.",
    );
  }

  function dividir() {
    if (!dividindo) return;
    const { linha, partes } = dividindo;
    const sinal = linha.cents < 0 ? -1 : 1;
    const valores = partes.map((parte) => centavosDe(parte.valor));
    if (valores.some((valor) => !valor) || partes.some((parte) => !parte.sessionId)) return dizer("Toda parte precisa de valor e sessão.", true);
    const soma = valores.reduce<number>((total, valor) => total + (valor ?? 0), 0);
    if (soma !== Math.abs(linha.cents)) return dizer(`As partes somam ${reais(soma)}; a linha é ${reais(Math.abs(linha.cents))}.`, true);
    void acao(
      "dividir",
      () =>
        enviar<ConferenciaResposta>("/api/extratos/dividir", {
          statementId: linha.statementId,
          line: linha.line,
          parts: partes.map((parte, indice) => ({ cents: sinal * (valores[indice] ?? 0), sessionId: parte.sessionId })),
        }),
      (resposta) => {
        guardar(resposta);
        setDividindo(null);
        dizer(`Linha dividida em ${partes.length} lançamentos.`);
      },
      "Não foi possível dividir a linha.",
    );
  }

  const linhas = (dados?.lines ?? []).filter((linha) => !linha.ignored);
  const ignoradas = (dados?.lines ?? []).filter((linha) => linha.ignored);
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
  const filtradas = (situacao === "ignoradas" ? ignoradas : linhas).filter((linha) => {
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

        {dados && linhas.length === 0 && ignoradas.length === 0 ? (
          <Vazio icone={checkmarkCircleOutline} titulo="Nenhuma linha neste mês" texto="Importe o extrato do banco deste mês para conferir cada linha com um lançamento." />
        ) : null}

        {dados && (linhas.length > 0 || ignoradas.length > 0) ? (
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
                  <Preenchimento porcento={linhas.length ? (cruzadas / linhas.length) * 100 : 100} />
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

            {(series.dados?.series.length ?? 0) > 0 ? (
              <Bloco className="cartao destaque secao">
                <strong>Séries com linhas em outros meses</strong>
                <span className="fraco">Estas parcelas, empréstimos ou recorrentes já existem e aparecem em outros extratos importados.</span>
                <div className="lista">
                  {series.dados?.series.map((item) => (
                    <div key={item.entryId} className="linha">
                      <span className="texto">
                        <span>{item.name}</span>
                        <span className="etiqueta">
                          {ROTULO_CATEGORIA[item.category]} · {item.groupName} / {item.sessionName}
                        </span>
                      </span>
                      <IonButton
                        size="small"
                        fill="outline"
                        onClick={() =>
                          setSerie({ modo: "existente", existente: item, pedido: { titulo: `${item.name} aparece em outros meses`, tipo: ROTULO_CATEGORIA[item.category], meses: item.meses, origem: null } })
                        }
                      >
                        Juntar
                      </IonButton>
                    </div>
                  ))}
                </div>
              </Bloco>
            ) : null}

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
                            <span className={linha.link ? "chip ok" : linha.ignored ? "chip" : linha.suggestion ? "chip ia" : "chip"}>
                              {linha.link ? "Cruzada" : linha.ignored ? "Ignorada" : linha.suggestion ? "Proposta" : "Sem lançamento"}
                            </span>
                          </span>
                          <motion.span animate={{ rotate: expandida ? 180 : 0 }} style={{ display: "inline-flex" }}>
                            <IonIcon icon={chevronDown} aria-hidden />
                          </motion.span>
                        </button>

                        <AnimatePresence initial={false}>
                          {expandida ? (
                            <motion.div key="acoes" className="secao" style={{ gap: 16, overflow: "hidden" }} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={curvaCheia}>
                              {linha.ignored ? (
                                <>
                                  <p className="fraco">Ignorada: não conta como pendente e não é lançada.</p>
                                  <IonButton fill="outline" disabled={ocupado === chave} onClick={() => ignorar(linha, false)}>
                                    Reativar a linha
                                  </IonButton>
                                </>
                              ) : linha.link ? (
                                <>
                                  {linha.parts.length > 1 ? (
                                    <div className="lista">
                                      {linha.parts.map((parte) => (
                                        <div key={parte.entryId} className="linha">
                                          <span className="texto">
                                            <span>{parte.description}</span>
                                            <span className="etiqueta">
                                              {parte.groupName} / {parte.sessionName}
                                            </span>
                                          </span>
                                          <Dinheiro cents={parte.cents} />
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="fraco">Cruzada com {textoDoVinculo(linha.link)} · dia {linha.link.day} · {reais(linha.link.cents)}</p>
                                  )}
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
                                    {sessaoDa(linha) ? (
                                      <TipoDaLinhaCampos
                                        rascunho={rascunhoDa(linha)}
                                        categorias={categoriasDaLinha(linha.cents, categoriasDaSessao(linha))}
                                        aoMudar={(parte) => mudarTipo(linha, parte)}
                                      />
                                    ) : null}
                                    <IonButton fill="outline" disabled={ocupado === chave || !sessaoDa(linha)} onClick={() => void acumular(linha)}>
                                      Lançar na sessão
                                    </IonButton>
                                  </div>
                                  {(contas.dados?.accounts.length ?? 0) > 1 ? (
                                    <div className="secao" style={{ gap: 12 }}>
                                      <Selecao
                                        rotulo="Transferência entre as suas contas"
                                        valor={contaDoPar[chave] ?? ""}
                                        vazio="Escolha a outra conta"
                                        opcoes={(contas.dados?.accounts ?? []).filter((conta) => conta.name !== linha.accountName).map((conta) => ({ id: conta.id, texto: conta.name }))}
                                        aoMudar={(valor) => setContaDoPar((atual) => ({ ...atual, [chave]: valor }))}
                                      />
                                      <IonButton fill="outline" disabled={ocupado === chave || !contaDoPar[chave]} onClick={() => transferir(linha)}>
                                        É uma transferência
                                      </IonButton>
                                    </div>
                                  ) : null}
                                  <div className="acoes-da-folha">
                                    <IonButton
                                      fill="clear"
                                      disabled={ocupado === chave}
                                      onClick={() =>
                                        setDividindo({
                                          linha,
                                          partes: [
                                            { valor: "", sessionId: sessaoDa(linha) },
                                            { valor: "", sessionId: "" },
                                          ],
                                        })
                                      }
                                    >
                                      Dividir em partes
                                    </IonButton>
                                    <IonButton fill="clear" color="medium" disabled={ocupado === chave} onClick={() => ignorar(linha, true)}>
                                      Ignorar a linha
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

      <FolhaDaSerie
        pedido={serie?.pedido ?? null}
        ocupado={ocupado === "serie"}
        aoConfirmar={confirmarSerie}
        aoSoEsta={
          serie?.modo === "nova"
            ? () => {
                const linha = serie.linha;
                setSerie(null);
                void acumular(linha, true);
              }
            : undefined
        }
        aoFechar={() => setSerie(null)}
      />

      <Folha aberta={dividindo !== null} titulo="Dividir a linha" aoFechar={() => setDividindo(null)}>
        {dividindo ? (
          <>
            <p className="fraco">
              {dividindo.linha.description} · {reais(Math.abs(dividindo.linha.cents))}. Cada parte vira um lançamento na sessão dela; as partes somam o valor da linha.
            </p>
            {dividindo.partes.map((parte, indice) => (
              <div key={indice} className="cartao secao">
                <div className="titulo-do-dia">
                  <span className="etiqueta">Parte {indice + 1}</span>
                  {dividindo.partes.length > 2 ? (
                    <IonButton size="small" fill="clear" aria-label={`Tirar a parte ${indice + 1}`} onClick={() => setDividindo({ ...dividindo, partes: dividindo.partes.filter((_, outro) => outro !== indice) })}>
                      <IonIcon slot="icon-only" icon={closeOutline} />
                    </IonButton>
                  ) : null}
                </div>
                <Campo
                  icone={cashOutline}
                  rotulo="Valor"
                  value={parte.valor}
                  onMudar={(valor) => setDividindo({ ...dividindo, partes: dividindo.partes.map((atual, outro) => (outro === indice ? { ...atual, valor } : atual)) })}
                  inputMode="decimal"
                  placeholder="0,00"
                />
                <Selecao
                  rotulo="Sessão"
                  valor={parte.sessionId}
                  vazio="Escolha a sessão"
                  opcoes={sessoes}
                  aoMudar={(sessionId) => setDividindo({ ...dividindo, partes: dividindo.partes.map((atual, outro) => (outro === indice ? { ...atual, sessionId } : atual)) })}
                />
              </div>
            ))}
            {dividindo.partes.length < 10 ? (
              <IonButton fill="clear" onClick={() => setDividindo({ ...dividindo, partes: [...dividindo.partes, { valor: "", sessionId: "" }] })}>
                + Outra parte
              </IonButton>
            ) : null}
            <p className="fraco">
              Somando {reais(dividindo.partes.reduce((total, parte) => total + (centavosDe(parte.valor) ?? 0), 0))} de {reais(Math.abs(dividindo.linha.cents))}
            </p>
            <IonButton expand="block" className="principal" disabled={ocupado === "dividir"} onClick={dividir}>
              Dividir
            </IonButton>
          </>
        ) : null}
      </Folha>
    </div>
  );
}

/** O tipo do lançamento que nasce da linha e, conforme o tipo, as parcelas, o empréstimo ou a recorrência. */
function TipoDaLinhaCampos({
  rascunho,
  categorias,
  aoMudar,
}: {
  rascunho: RascunhoDoTipo;
  categorias: CategoriaTransacao[];
  aoMudar: (parte: Partial<RascunhoDoTipo>) => void;
}) {
  const so = (texto: string) => texto.replace(/\D/g, "").slice(0, 3);
  return (
    <div className="secao" style={{ gap: 8 }}>
      <span className="etiqueta">Lançar como</span>
      <Fichas<CategoriaTransacao> rotulo="Lançar como" valor={rascunho.category} opcoes={categorias.map((item) => ({ id: item, texto: ROTULO_CATEGORIA[item] }))} aoMudar={(category) => aoMudar({ category })} />
      {rascunho.category === "installment" ? (
        <div className="grade">
          <Campo icone={cashOutline} rotulo="Parcela atual" value={rascunho.installmentNumber} onMudar={(valor) => aoMudar({ installmentNumber: so(valor) })} inputMode="numeric" />
          <Campo icone={cashOutline} rotulo="De quantas" value={rascunho.installments} onMudar={(valor) => aoMudar({ installments: so(valor) })} inputMode="numeric" />
        </div>
      ) : null}
      {rascunho.category === "loan" ? (
        <>
          <Campo icone={cashOutline} rotulo="De quem" value={rascunho.counterparty} onMudar={(counterparty) => aoMudar({ counterparty })} maxLength={80} />
          <div className="grade">
            <Campo icone={cashOutline} rotulo="Total combinado" value={rascunho.principal} onMudar={(principal) => aoMudar({ principal })} inputMode="decimal" placeholder="0,00" />
            <Campo icone={cashOutline} rotulo="Parcelas" value={rascunho.installments} onMudar={(valor) => aoMudar({ installments: so(valor) })} inputMode="numeric" placeholder="1" />
          </div>
        </>
      ) : null}
      {rascunho.category === "fixed" ? (
        <div className="grade">
          <Selecao rotulo="Repete" valor={rascunho.recurrence} opcoes={RECORRENCIAS.map((item) => ({ id: item, texto: ROTULO_RECORRENCIA[item] }))} aoMudar={(valor) => aoMudar({ recurrence: valor as Recorrencia })} />
          <Campo icone={cashOutline} rotulo="A cada" value={rascunho.recurrenceInterval} onMudar={(valor) => aoMudar({ recurrenceInterval: so(valor) })} inputMode="numeric" />
        </div>
      ) : null}
    </div>
  );
}
