import { IonButton, IonIcon, IonLabel, IonSegment, IonSegmentButton, useIonViewWillEnter } from "@ionic/react";
import type { FinancasVista, ItemPainel, LancamentoVista, PainelResposta } from "@finnagent/contracts";
import { walletOutline } from "ionicons/icons";
import { motion } from "motion/react";
import { useMemo, useState } from "react";
import { ler } from "../api/cliente";
import { useNavigate } from "react-router-dom";
import { diaDaSemana, hojeIso, reais, rotuloDoMes } from "../api/formato";
import { Dinheiro, Estado, Vazio } from "../componentes/Estado";
import { Pagina } from "../componentes/Pagina";
import { SeletorDeMes } from "../componentes/SeletorDeMes";
import { toque } from "../haptico";
import { Bloco, Cascata, Contagem, Troca } from "../movimento";
import { useDados } from "../useDados";
import { useMes } from "../useMes";
import { useAcao } from "../useAcao";
import { DetalheDoLancamento } from "./financas/DetalheDoLancamento";
import { FormLancamento } from "./financas/FormLancamento";

type Filtro = "todos" | "entradas" | "saidas";

function porDia(items: ItemPainel[]) {
  const dias = new Map<number, ItemPainel[]>();
  for (const item of items) dias.set(item.day, [...(dias.get(item.day) ?? []), item]);
  return [...dias.entries()].sort((a, b) => a[0] - b[0]);
}

const passa = (item: ItemPainel, filtro: Filtro) =>
  filtro === "todos" || (item.cents !== null && (filtro === "entradas" ? item.cents > 0 : item.cents < 0));

/** Hoje, se o mês aberto é o atual: o lançamento novo já nasce com a data certa. */
function ehEsteMesHoje(mes: { ano: number; mes: number }) {
  const hoje = hojeIso();
  return hoje.startsWith(`${mes.ano}-${String(mes.mes).padStart(2, "0")}`) ? hoje : null;
}

export function Financas() {
  const { mes, direcao, mudar } = useMes();
  const navegar = useNavigate();
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const { dados, erro, carregando, recarregar } = useDados<PainelResposta>(`/api/painel?scope=mes&year=${mes.ano}&month=${mes.mes}`);
  const { avisar } = useAcao();
  // A lista completa dos lançamentos, com as regras e as ações de cada um: só quando a pessoa abre um ou lança.
  const [vista, setVista] = useState<FinancasVista | null>(null);
  const [aberto, setAberto] = useState<string | null>(null);
  const [formulario, setFormulario] = useState<{ entry: LancamentoVista | null } | null>(null);
  const entryAberto = vista?.entries.find((item) => item.id === aberto) ?? null;

  async function carregarVista() {
    try {
      const resposta = await ler<FinancasVista>("/api/financas");
      setVista(resposta);
      return resposta;
    } catch (error) {
      avisar(error instanceof Error ? error.message : "Não foi possível abrir os lançamentos.");
      return null;
    }
  }

  async function abrir(id: string) {
    setAberto(id);
    if (!vista || !vista.entries.some((item) => item.id === id)) await carregarVista();
  }

  async function atualizarTudo() {
    await Promise.all([recarregar(), carregarVista()]);
  }

  const dataNova = ehEsteMesHoje(mes) ?? `${mes.ano}-${String(mes.mes).padStart(2, "0")}-01`;
  const dias = useMemo(() => porDia((dados?.items ?? []).filter((item) => passa(item, filtro))), [dados, filtro]);
  const hoje = new Date();
  const ehEsteMes = hoje.getFullYear() === mes.ano && hoje.getMonth() + 1 === mes.mes;

  useIonViewWillEnter(() => {
    if (dados) void recarregar();
  });

  return (
    <Pagina
      titulo="Finanças"
      etiqueta="Mês a mês"
      aoAtualizar={recarregar}
      acao={{
        rotulo: "Novo lançamento",
        aoTocar: () => {
          void carregarVista();
          setFormulario({ entry: null });
        },
      }}
    >
      <div className="pagina">
        <SeletorDeMes mes={mes} direcao={direcao} aoMudar={mudar} />

        <Troca chave={rotuloDoMes(mes)} direcao={direcao}>
          <Estado carregando={carregando} erro={erro} tem={Boolean(dados)} aoTentar={() => void recarregar()} />

          {dados ? (
            <Cascata className="pagina sem-margem">
              <Bloco className="cartao">
                <span className="etiqueta">Sobra</span>
                <span className="numero grande">
                  <Dinheiro cents={dados.sobra} animado />
                </span>
                <div className="grade separada">
                  <div className="secao" style={{ gap: 4 }}>
                    <span className="etiqueta">Entradas</span>
                    <Contagem valor={dados.entradas} formatar={reais} className="numero pos" />
                  </div>
                  <div className="secao" style={{ gap: 4 }}>
                    <span className="etiqueta">Saídas</span>
                    <Contagem valor={dados.saidas} formatar={reais} className="numero neg" />
                  </div>
                </div>
              </Bloco>

              <Bloco>
                <IonSegment
                  value={filtro}
                  onIonChange={(evento) => {
                    toque();
                    setFiltro((evento.detail.value as Filtro) ?? "todos");
                  }}
                >
                  <IonSegmentButton value="todos">
                    <IonLabel>Tudo</IonLabel>
                  </IonSegmentButton>
                  <IonSegmentButton value="entradas">
                    <IonLabel>Entradas</IonLabel>
                  </IonSegmentButton>
                  <IonSegmentButton value="saidas">
                    <IonLabel>Saídas</IonLabel>
                  </IonSegmentButton>
                </IonSegment>
              </Bloco>

              {dias.length === 0 ? (
                <Bloco>
                  <Vazio
                    icone={walletOutline}
                    titulo={filtro === "todos" ? "Nada neste mês" : "Nada com esse filtro"}
                    texto={filtro === "todos" ? "Toque em + para lançar, ou peça ao consultor." : "Mude o filtro para ver o resto."}
                  />
                </Bloco>
              ) : null}

              {dias.map(([dia, items]) => {
                const total = items.reduce((soma, item) => soma + (item.cents ?? 0), 0);
                const ehHoje = ehEsteMes && dia === hoje.getDate();
                return (
                  <Bloco key={`${filtro}-${dia}`} className="secao">
                    <div className="titulo-do-dia">
                      <span className="etiqueta" style={ehHoje ? { color: "var(--brand)" } : undefined}>
                        {ehHoje ? "Hoje · " : ""}
                        {diaDaSemana(mes.ano, mes.mes, dia)} {String(dia).padStart(2, "0")}
                      </span>
                      <span className="etiqueta">
                        <Dinheiro cents={total} />
                      </span>
                    </div>
                    <div className="lista">
                      {items.map((item) => (
                        <motion.button
                          type="button"
                          key={`${item.kind}-${item.id}`}
                          className={`linha linha-botao${item.kind === "compromisso" ? " evento" : ""}`}
                          whileTap={{ backgroundColor: "var(--surface-2)" }}
                          onClick={() => {
                            toque();
                            if (item.kind === "lancamento") void abrir(item.id);
                            else navegar("/agenda");
                          }}
                        >
                          <div className="texto">
                            <span>{item.title}</span>
                            <span className="etiqueta">{item.detail}</span>
                          </div>
                          {item.cents === null ? <span className="etiqueta">Compromisso</span> : <Dinheiro cents={item.cents} />}
                        </motion.button>
                      ))}
                    </div>
                  </Bloco>
                );
              })}
            </Cascata>
          ) : null}
        </Troca>
      </div>

      <DetalheDoLancamento
        entry={entryAberto}
        mes={mes}
        aoFechar={() => setAberto(null)}
        aoEditar={(entry) => setFormulario({ entry })}
        aoMudar={atualizarTudo}
      />
      <FormLancamento
        aberta={formulario !== null}
        entry={formulario?.entry ?? null}
        vista={vista}
        dataInicial={dataNova}
        aoFechar={() => setFormulario(null)}
        aoSalvo={() => {
          avisar(formulario?.entry ? "Lançamento atualizado." : "Lançamento criado.");
          setFormulario(null);
          void atualizarTudo();
        }}
      />
    </Pagina>
  );
}
