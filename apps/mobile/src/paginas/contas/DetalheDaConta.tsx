import { IonButton, IonButtons, IonIcon, useIonViewWillEnter } from "@ionic/react";
import {
  ROTULO_DO_STATUS_DA_FATURA,
  ROTULO_DO_TIPO_DE_CONTA,
  faturasDoCartao,
  limiteDoCartao,
  resumoDaCaixinha,
  resumoDaConta,
  type ContasResposta,
  type ExtratosResposta,
  type Fatura,
  type FinancasVista,
  type MetasResposta,
  type StatusExtrato,
} from "@finnagent/contracts";
import { chevronBack, walletOutline } from "ionicons/icons";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { MESES, MESES_CURTOS, dataCurta, reais, rotuloDoMes } from "../../api/formato";
import { diaEMes } from "../../api/arquivo";
import { BarraDeUso } from "../../componentes/BarraDeUso";
import { Dinheiro, Estado, Vazio } from "../../componentes/Estado";
import { Pagina } from "../../componentes/Pagina";
import { SeletorDeMes } from "../../componentes/SeletorDeMes";
import { Bloco, Cascata, Troca } from "../../movimento";
import { useDados } from "../../useDados";
import { useMes } from "../../useMes";
import { hojeIso, movimentosDoMes } from "./movimentos";
import { AcoesDaConta, type AcaoDaConta } from "./AcoesDaConta";

const ROTULO_DO_EXTRATO: Record<StatusExtrato, string> = {
  importado: "Importado",
  com_erros: "Com erros",
  processando: "Processando",
  falhou: "Falhou",
};

const classeDaFatura = (fatura: Fatura) => (fatura.status === "paga" ? "ok" : fatura.status === "vencida" ? "neg" : "");

const classeDoStatus = (status: StatusExtrato) => (status === "importado" ? "chip ok" : status === "processando" ? "chip" : "chip neg");

/** Uma conta: o saldo de hoje, o que fica no fim do mês, os movimentos do mês com o saldo correndo e os extratos dela. */
export function DetalheDaConta() {
  const { id = "" } = useParams<{ id: string }>();
  const contas = useDados<ContasResposta>("/api/contas");
  const financas = useDados<FinancasVista>("/api/financas");
  const extratos = useDados<ExtratosResposta>("/api/extratos");
  const metas = useDados<MetasResposta>("/api/metas");
  const { mes, direcao, mudar } = useMes();
  const hoje = hojeIso();
  const navegar = useNavigate();
  const [acao, setAcao] = useState<AcaoDaConta | null>(null);

  const recarregar = () => Promise.all([contas.recarregar(), financas.recarregar(), extratos.recarregar(), metas.recarregar()]).then(() => undefined);
  useIonViewWillEnter(() => {
    if (contas.dados) void recarregar();
  });

  const conta = contas.dados?.accounts.find((item) => item.id === id) ?? null;
  const entries = financas.dados?.entries ?? [];
  const resumo = conta ? resumoDaConta(conta, entries, hoje) : null;
  const doMes = conta ? movimentosDoMes(conta, entries, mes.ano, mes.mes) : null;
  const extratosDaConta = conta ? (extratos.dados?.statements ?? []).filter((item) => item.accountId === conta.id).sort((a, b) => b.importedAt.localeCompare(a.importedAt)) : [];
  const cartao = conta?.kind === "cartao";
  const caixinhas = conta ? (contas.dados?.boxes ?? []).filter((item) => item.accountId === conta.id) : [];
  // Da atual (a aberta) para as mais antigas: a atual fica em destaque, as anteriores na lista.
  const faturas = conta && cartao ? [...faturasDoCartao(conta, entries, hoje)].reverse() : [];
  const faturaAtual = faturas[0];
  const anteriores = faturas.slice(1);
  const listaDeMetas = metas.dados?.goals ?? [];
  const limite = conta && cartao ? limiteDoCartao(conta, entries, hoje) : null;
  const chaveDoMes = `${mes.ano}-${String(mes.mes).padStart(2, "0")}`;
  const tem = Boolean(contas.dados && financas.dados);

  return (
    <Pagina
      titulo={conta?.name ?? "Conta"}
      etiqueta={conta ? ROTULO_DO_TIPO_DE_CONTA[conta.kind] : undefined}
      semPerfil
      aoAtualizar={recarregar}
      fim={
        <IonButtons>
          <IonButton routerLink="/financas/contas" routerDirection="back" aria-label="Voltar">
            <IonIcon slot="icon-only" icon={chevronBack} />
          </IonButton>
        </IonButtons>
      }
    >
      <Estado carregando={contas.carregando || financas.carregando} erro={contas.erro || financas.erro} tem={tem} aoTentar={() => void recarregar()} />

      {tem && !conta ? (
        <div className="pagina">
          <Vazio icone={walletOutline} titulo="Conta não encontrada" texto="Ela pode ter sido excluída. Volte para a lista de contas." />
        </div>
      ) : null}

      {conta && resumo && doMes ? (
        <Cascata className="pagina">
          <Bloco className="cartao destaque">
            <span className="etiqueta">{cartao ? "Lançado na fatura" : "Saldo hoje"}</span>
            <span className="numero grande">
              <Dinheiro cents={resumo.saldoCents} animado />
            </span>
            <div className="grade separada">
              <div className="secao" style={{ gap: 4 }}>
                <span className="etiqueta">{cartao ? "Fatura prevista" : "Fim do mês"}</span>
                <Dinheiro cents={resumo.previstoCents} />
              </div>
              <div className="secao" style={{ gap: 4 }}>
                <span className="etiqueta">{conta.openingOn ? `Saldo em ${dataCurta(conta.openingOn)}` : "Saldo inicial"}</span>
                <Dinheiro cents={conta.openingCents} />
              </div>
              {limite && conta.limitCents ? (
                <div className="secao" style={{ gap: 4 }}>
                  <span className="etiqueta">Limite disponível ({limite.percent}% usado)</span>
                  <Dinheiro cents={limite.disponivelCents ?? 0} />
                </div>
              ) : null}
            </div>
            {limite && conta.limitCents && limite.percent !== null ? (
              <div className="secao" style={{ gap: 4 }}>
                <BarraDeUso percent={limite.percent} rotulo={`Limite usado: ${limite.percent}%`} />
                <span className="etiqueta">
                  Usado {reais(limite.usadoCents)} de {reais(conta.limitCents)}
                </span>
              </div>
            ) : null}
            <div className="acoes-da-folha">
              <IonButton size="small" fill="outline" onClick={() => setAcao({ tipo: "conferir" })}>
                {cartao ? "Conferir fatura" : "Conferir saldo"}
              </IonButton>
              <IonButton size="small" fill="outline" onClick={() => setAcao({ tipo: "transferir" })}>
                Transferir
              </IonButton>
              <IonButton size="small" fill="clear" onClick={() => setAcao({ tipo: "editar" })}>
                Editar
              </IonButton>
            </div>
          </Bloco>

          {cartao ? (
            <Bloco className="secao">
              <div className="titulo-do-dia">
                <span className="etiqueta">Faturas</span>
                <span className="etiqueta">{conta.closingDay && conta.dueDay ? `Fecha dia ${conta.closingDay} · vence dia ${conta.dueDay}` : ""}</span>
              </div>
              {!conta.closingDay || !conta.dueDay ? <p className="fraco">Informe o fechamento e o vencimento do cartão em Editar para ver as faturas.</p> : null}
              {faturaAtual ? (
                <div className="cartao secao" style={{ gap: 8 }}>
                  <div className="titulo-do-dia">
                    <span className="etiqueta">
                      Fatura atual · {MESES_CURTOS[Number(faturaAtual.month.slice(5, 7)) - 1]} de {faturaAtual.month.slice(0, 4)}
                    </span>
                    <span className={`chip ${classeDaFatura(faturaAtual)}`}>{ROTULO_DO_STATUS_DA_FATURA[faturaAtual.status]}</span>
                  </div>
                  <span className="numero grande">
                    <Dinheiro cents={-faturaAtual.totalCents} />
                  </span>
                  <span className="etiqueta">
                    Fecha {dataCurta(faturaAtual.closingDate)} · vence {dataCurta(faturaAtual.dueDate)} · {faturaAtual.itens === 1 ? "1 compra" : `${faturaAtual.itens} compras`}
                    {faturaAtual.paidCents > 0 ? ` · pago ${reais(faturaAtual.paidCents)}` : ""}
                  </span>
                  {faturaAtual.status !== "paga" && faturaAtual.totalCents > faturaAtual.paidCents ? (
                    <div className="acoes-da-folha">
                      <IonButton
                        size="small"
                        fill={faturaAtual.status === "aberta" ? "outline" : "solid"}
                        className={faturaAtual.status === "aberta" ? undefined : "principal"}
                        onClick={() => setAcao({ tipo: "pagar", fatura: faturaAtual })}
                      >
                        {faturaAtual.status === "aberta" ? "Pagar antecipado" : "Pagar"}
                      </IonButton>
                    </div>
                  ) : null}
                </div>
              ) : null}
              {anteriores.length > 0 ? (
                <>
                  <span className="etiqueta">Anteriores</span>
                  <div className="lista">
                    {anteriores.map((fatura) => (
                      <div key={fatura.month} className="linha">
                        <div className="texto" style={{ flex: 1 }}>
                          <span>
                            {MESES_CURTOS[Number(fatura.month.slice(5, 7)) - 1]} de {fatura.month.slice(0, 4)}
                          </span>
                          <span className="etiqueta">
                            Vence {dataCurta(fatura.dueDate)} · {fatura.itens === 1 ? "1 compra" : `${fatura.itens} compras`}
                            {fatura.paidCents > 0 ? ` · pago ${reais(fatura.paidCents)}` : ""}
                          </span>
                        </div>
                        <span className="texto" style={{ textAlign: "right" }}>
                          <Dinheiro cents={-fatura.totalCents} />
                          <span className={`chip ${classeDaFatura(fatura)}`}>{ROTULO_DO_STATUS_DA_FATURA[fatura.status]}</span>
                          {fatura.status !== "paga" && fatura.totalCents > fatura.paidCents ? (
                            <IonButton size="small" fill="solid" className="principal" onClick={() => setAcao({ tipo: "pagar", fatura })}>
                              Pagar
                            </IonButton>
                          ) : null}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              ) : null}
            </Bloco>
          ) : null}

          {!cartao ? (
            <Bloco className="secao">
              <div className="titulo-do-dia">
                <span className="etiqueta">Caixinhas desta conta</span>
                <IonButton size="small" fill="clear" onClick={() => setAcao({ tipo: "caixinha", caixinha: null })}>
                  + Caixinha
                </IonButton>
              </div>
              {caixinhas.length === 0 ? <p className="fraco">Nenhuma caixinha. Uma caixinha é uma reserva dentro da conta, com rendimento.</p> : null}
              <div className="lista">
                {caixinhas.map((caixinha) => {
                  const resumoDela = resumoDaCaixinha(caixinha, entries, hoje, chaveDoMes);
                  const meta = caixinha.goalId ? listaDeMetas.find((item) => item.id === caixinha.goalId) : undefined;
                  const progresso = meta && meta.targetCents > 0 ? Math.round((meta.savedCents / meta.targetCents) * 100) : null;
                  return (
                    <button key={caixinha.id} type="button" className="linha linha-botao" onClick={() => setAcao({ tipo: "caixinha", caixinha })}>
                      <div className="texto" style={{ flex: 1 }}>
                        <span>{caixinha.name}</span>
                        <span className="etiqueta">
                          {meta ? `Meta ${meta.name} · ` : caixinha.goalId ? "Guarda uma meta · " : ""}no total rendeu {reais(resumoDela.rendimentoTotalCents)}
                        </span>
                        {meta && progresso !== null ? (
                          <>
                            <BarraDeUso percent={progresso} alerta={false} rotulo={`${meta.name}: ${Math.min(progresso, 100)}% da meta`} />
                            <span className="etiqueta">
                              {reais(meta.savedCents)} de {reais(meta.targetCents)} · {Math.min(progresso, 100)}%
                            </span>
                          </>
                        ) : null}
                      </div>
                      <span className="texto" style={{ textAlign: "right" }}>
                        <Dinheiro cents={resumoDela.saldoCents} />
                        <span className="saldo-corrido">em {MESES_CURTOS[mes.mes - 1]} {reais(resumoDela.rendimentoDoMesCents)}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </Bloco>
          ) : null}

          <Bloco className="secao">
            <SeletorDeMes mes={mes} direcao={direcao} aoMudar={mudar} />
            <Troca chave={rotuloDoMes(mes)} direcao={direcao}>
              <div className="secao">
                <div className="titulo-do-dia">
                  <span className="etiqueta">Início {reais(doMes.saldoInicial)}</span>
                  <span className="etiqueta">Fim {reais(doMes.saldoFinal)}</span>
                </div>
                {doMes.movimentos.length === 0 ? (
                  <p className="fraco">Nada nesta conta em {MESES[mes.mes - 1]}.</p>
                ) : (
                  <div className="lista">
                    {doMes.movimentos.map((item) => (
                      <div key={item.chave} className={`linha${item.pendente || item.foraDoSaldo ? " prevista" : ""}`}>
                        <time className="dia" dateTime={item.date}>
                          {item.date.slice(8, 10)}
                        </time>
                        <div className="texto" style={{ flex: 1 }}>
                          <span>{item.descricao}</span>
                          <span className="etiqueta">
                            {item.pendente ? "Previsto · " : ""}
                            {item.foraDoSaldo ? "Antes do saldo inicial · " : ""}
                            {item.detalhe}
                          </span>
                        </div>
                        <span className="texto" style={{ textAlign: "right" }}>
                          <Dinheiro cents={item.cents} />
                          <span className="saldo-corrido">{reais(item.saldo)}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Troca>
          </Bloco>

          <Bloco className="secao">
            <div className="titulo-do-dia">
              <span className="etiqueta">Extratos desta conta</span>
              <Link to="/extratos" className="link-de-secao">
                Importações
              </Link>
            </div>
            {extratos.erro && !extratos.dados ? <p className="erro">{extratos.erro}</p> : null}
            {extratos.dados && extratosDaConta.length === 0 ? <p className="fraco">Nenhum extrato importado nesta conta.</p> : null}
            {extratosDaConta.length > 0 ? (
              <div className="lista">
                {extratosDaConta.map((item) => (
                  <div key={item.id} className="linha">
                    <div className="texto" style={{ flex: 1 }}>
                      <span>{item.filename}</span>
                      <span className="etiqueta">
                        {item.startDate && item.endDate ? `${diaEMes(item.startDate)} – ${diaEMes(item.endDate)} · ` : ""}
                        {item.lineCount === 1 ? "1 linha" : `${item.lineCount} linhas`}
                      </span>
                    </div>
                    <span className={classeDoStatus(item.status)}>{ROTULO_DO_EXTRATO[item.status]}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </Bloco>
        </Cascata>
      ) : null}

      {conta && resumo ? (
        <AcoesDaConta
          acao={acao}
          conta={conta}
          contas={contas.dados?.accounts ?? []}
          caixinhas={contas.dados?.boxes ?? []}
          metas={listaDeMetas}
          saldoHoje={resumo.saldoCents}
          aoFechar={() => setAcao(null)}
          aoMudar={recarregar}
          aoExcluida={() => {
            setAcao(null);
            navegar("/financas/contas", { replace: true });
            void contas.recarregar();
          }}
        />
      ) : null}
    </Pagina>
  );
}
