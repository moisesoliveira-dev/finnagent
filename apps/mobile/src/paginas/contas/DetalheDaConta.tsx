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
  type FinancasVista,
  type StatusExtrato,
} from "@finnagent/contracts";
import { chevronBack, walletOutline } from "ionicons/icons";
import { Link, useParams } from "react-router-dom";
import { MESES, MESES_CURTOS, dataCurta, reais, rotuloDoMes } from "../../api/formato";
import { diaEMes } from "../../api/arquivo";
import { Dinheiro, Estado, Vazio } from "../../componentes/Estado";
import { Pagina } from "../../componentes/Pagina";
import { SeletorDeMes } from "../../componentes/SeletorDeMes";
import { Bloco, Cascata, Troca } from "../../movimento";
import { useDados } from "../../useDados";
import { useMes } from "../../useMes";
import { hojeIso, movimentosDoMes } from "./movimentos";

const ROTULO_DO_EXTRATO: Record<StatusExtrato, string> = {
  importado: "Importado",
  com_erros: "Com erros",
  processando: "Processando",
  falhou: "Falhou",
};

const classeDoStatus = (status: StatusExtrato) => (status === "importado" ? "chip ok" : status === "processando" ? "chip" : "chip neg");

/** Uma conta: o saldo de hoje, o que fica no fim do mês, os movimentos do mês com o saldo correndo e os extratos dela. */
export function DetalheDaConta() {
  const { id = "" } = useParams<{ id: string }>();
  const contas = useDados<ContasResposta>("/api/contas");
  const financas = useDados<FinancasVista>("/api/financas");
  const extratos = useDados<ExtratosResposta>("/api/extratos");
  const { mes, direcao, mudar } = useMes();
  const hoje = hojeIso();

  const recarregar = () => Promise.all([contas.recarregar(), financas.recarregar(), extratos.recarregar()]).then(() => undefined);
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
  const faturas = conta && cartao ? [...faturasDoCartao(conta, entries, hoje)].reverse() : [];
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
          </Bloco>

          {cartao ? (
            <Bloco className="secao">
              <div className="titulo-do-dia">
                <span className="etiqueta">Faturas</span>
                <span className="etiqueta">{conta.closingDay && conta.dueDay ? `Fecha dia ${conta.closingDay} · vence dia ${conta.dueDay}` : ""}</span>
              </div>
              {!conta.closingDay || !conta.dueDay ? <p className="fraco">Informe o fechamento e o vencimento do cartão pelo site para ver as faturas.</p> : null}
              {faturas.length > 0 ? (
                <div className="lista">
                  {faturas.map((fatura) => (
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
                        <span className={`chip ${fatura.status === "paga" ? "ok" : fatura.status === "vencida" ? "neg" : ""}`}>{ROTULO_DO_STATUS_DA_FATURA[fatura.status]}</span>
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}
            </Bloco>
          ) : null}

          {!cartao && caixinhas.length > 0 ? (
            <Bloco className="secao">
              <div className="titulo-do-dia">
                <span className="etiqueta">Caixinhas desta conta</span>
                <span className="etiqueta">Rendeu em {MESES_CURTOS[mes.mes - 1]}</span>
              </div>
              <div className="lista">
                {caixinhas.map((caixinha) => {
                  const resumoDela = resumoDaCaixinha(caixinha, entries, hoje, chaveDoMes);
                  return (
                    <div key={caixinha.id} className="linha">
                      <div className="texto" style={{ flex: 1 }}>
                        <span>{caixinha.name}</span>
                        <span className="etiqueta">{caixinha.goalId ? "Guarda uma meta · " : ""}no total rendeu {reais(resumoDela.rendimentoTotalCents)}</span>
                      </div>
                      <span className="texto" style={{ textAlign: "right" }}>
                        <Dinheiro cents={resumoDela.saldoCents} />
                        <span className="saldo-corrido">{reais(resumoDela.rendimentoDoMesCents)}</span>
                      </span>
                    </div>
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
    </Pagina>
  );
}
