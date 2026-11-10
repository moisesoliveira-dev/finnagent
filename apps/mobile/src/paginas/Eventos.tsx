import { IonButton, IonIcon, IonLabel, IonSegment, IonSegmentButton } from "@ionic/react";
import {
  CATEGORIAS_EVENTO,
  RESULTADOS_HISTORICO,
  STATUS_EVENTO,
  type CodigoCategoriaEvento,
  type DetalheDoEvento,
  type PaginaDeEventos,
  type PaginaDoHistorico,
  type ResultadoHistorico,
  type StatusEvento,
} from "@finnagent/contracts";
import { arrowBack, chevronBack, chevronForward, pulseOutline, searchOutline } from "ionicons/icons";
import { useState } from "react";
import { dataEHora } from "../api/formato";
import { Campo } from "../componentes/Campo";
import { Estado, Vazio } from "../componentes/Estado";
import { Folha } from "../componentes/Folha";
import { Pagina } from "../componentes/Pagina";
import { Fichas } from "../componentes/Selecao";
import { toque } from "../haptico";
import { useDados } from "../useDados";

type Visao = "eventos" | "historico";

const TOM_DO_STATUS: Record<StatusEvento, string> = { pendente: "ia", processando: "ia", concluído: "ok", "com falha": "neg" };
const TOM_DO_RESULTADO: Record<ResultadoHistorico, string> = { sucesso: "ok", falha: "neg", iniciado: "ia" };
const NOME_DA_CATEGORIA = Object.fromEntries(CATEGORIAS_EVENTO.map((item) => [item.code, item.name])) as Record<CodigoCategoriaEvento, string>;

function consulta(pares: Record<string, string | number | null>) {
  const busca = new URLSearchParams();
  for (const [chave, valor] of Object.entries(pares)) if (valor !== null && valor !== "") busca.set(chave, String(valor));
  return busca.toString();
}

/** O que o sistema registrou: cada mudança vira um evento, e o histórico mostra quem o processou e como foi. */
export function Eventos() {
  const [visao, setVisao] = useState<Visao>("eventos");
  const [categoria, setCategoria] = useState<CodigoCategoriaEvento | "">("");
  const [status, setStatus] = useState<StatusEvento | "">("");
  const [resultado, setResultado] = useState<ResultadoHistorico | "">("");
  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(1);
  const [aberto, setAberto] = useState<string | null>(null);
  const q = busca.trim();

  const eventos = useDados<PaginaDeEventos>(visao === "eventos" ? `/api/eventos?${consulta({ pagina, categoria, status, q })}` : null);
  const historico = useDados<PaginaDoHistorico>(visao === "historico" ? `/api/eventos/historico?${consulta({ pagina, resultado, q })}` : null);
  const detalhe = useDados<DetalheDoEvento>(aberto ? `/api/eventos/${encodeURIComponent(aberto)}` : null);
  const atual = visao === "eventos" ? eventos : historico;
  const paginacao = visao === "eventos" ? eventos.dados?.page : historico.dados?.page;
  const paginas = paginacao ? Math.max(1, Math.ceil(paginacao.total / paginacao.size)) : 1;

  const filtrar = <T,>(mudar: (valor: T) => void) => (valor: T) => {
    setPagina(1);
    mudar(valor);
  };

  return (
    <Pagina
      titulo="Eventos"
      etiqueta="O que o sistema registrou"
      aoAtualizar={atual.recarregar}
      semPerfil
      fim={
        <IonButton routerLink="/configuracoes" routerDirection="back" aria-label="Voltar">
          <IonIcon slot="icon-only" icon={arrowBack} />
        </IonButton>
      }
    >
      <div className="pagina">
        <IonSegment
          value={visao}
          onIonChange={(evento) => {
            toque();
            setPagina(1);
            setVisao((evento.detail.value as Visao) ?? "eventos");
          }}
        >
          <IonSegmentButton value="eventos">
            <IonLabel>Eventos</IonLabel>
          </IonSegmentButton>
          <IonSegmentButton value="historico">
            <IonLabel>Histórico</IonLabel>
          </IonSegmentButton>
        </IonSegment>

        <Campo icone={searchOutline} rotulo="Buscar" type="search" value={busca} onMudar={filtrar(setBusca)} placeholder={visao === "eventos" ? "Tipo, origem ou id" : "Tipo, consumidor ou erro"} />
        {visao === "eventos" ? (
          <>
            <Fichas<CodigoCategoriaEvento | "">
              rotulo="Categoria"
              valor={categoria}
              opcoes={[{ id: "", texto: "Todas" }, ...CATEGORIAS_EVENTO.filter((item) => item.active).map((item) => ({ id: item.code, texto: item.name }))]}
              aoMudar={filtrar(setCategoria)}
            />
            <Fichas<StatusEvento | ""> rotulo="Status" valor={status} opcoes={[{ id: "", texto: "Todos" }, ...STATUS_EVENTO.map((item) => ({ id: item, texto: item }))]} aoMudar={filtrar(setStatus)} />
          </>
        ) : (
          <Fichas<ResultadoHistorico | "">
            rotulo="Resultado"
            valor={resultado}
            opcoes={[{ id: "", texto: "Todos" }, ...RESULTADOS_HISTORICO.map((item) => ({ id: item, texto: item }))]}
            aoMudar={filtrar(setResultado)}
          />
        )}

        <Estado carregando={atual.carregando} erro={atual.erro} tem={Boolean(atual.dados)} aoTentar={() => void atual.recarregar()} />

        {visao === "eventos" && eventos.dados ? (
          eventos.dados.events.length === 0 ? (
            <Vazio icone={pulseOutline} titulo="Nenhum evento" texto="Nada com esses filtros." />
          ) : (
            <div className="lista">
              {eventos.dados.events.map((item) => (
                <button key={item.id} type="button" className="linha linha-botao" onClick={() => setAberto(item.id)}>
                  <span className="texto">
                    <span>{item.type}</span>
                    <span className="etiqueta">
                      {NOME_DA_CATEGORIA[item.category]} · {dataEHora(item.occurredAt)}
                    </span>
                  </span>
                  <span className={`chip ${TOM_DO_STATUS[item.status]}`}>{item.status}</span>
                </button>
              ))}
            </div>
          )
        ) : null}

        {visao === "historico" && historico.dados ? (
          historico.dados.history.length === 0 ? (
            <Vazio icone={pulseOutline} titulo="Nada no histórico" texto={historico.dados.retention === "sempre" ? "Nada com esses filtros." : `O histórico guarda ${historico.dados.retention === "90d" ? "90 dias" : "1 ano"}.`} />
          ) : (
            <div className="lista">
              {historico.dados.history.map((item, indice) => (
                <button key={`${item.eventId}-${item.consumer}-${item.attempt}-${indice}`} type="button" className="linha linha-botao" onClick={() => setAberto(item.eventId)}>
                  <span className="texto">
                    <span>{item.eventType}</span>
                    <span className="etiqueta">
                      {item.consumer} · tentativa {item.attempt} · {dataEHora(item.occurredAt)}
                    </span>
                    {item.error ? <span className="erro">{item.error}</span> : null}
                  </span>
                  <span className={`chip ${TOM_DO_RESULTADO[item.result]}`}>{item.result}</span>
                </button>
              ))}
            </div>
          )
        ) : null}

        {paginas > 1 ? (
          <div className="seletor-de-mes">
            <IonButton fill="outline" size="small" aria-label="Página anterior" disabled={pagina <= 1} onClick={() => setPagina(pagina - 1)}>
              <IonIcon slot="icon-only" icon={chevronBack} />
            </IonButton>
            <span className="etiqueta">
              Página {pagina} de {paginas}
            </span>
            <IonButton fill="outline" size="small" aria-label="Próxima página" disabled={pagina >= paginas} onClick={() => setPagina(pagina + 1)}>
              <IonIcon slot="icon-only" icon={chevronForward} />
            </IonButton>
          </div>
        ) : null}
      </div>

      <Folha aberta={aberto !== null} titulo="Evento" aoFechar={() => setAberto(null)}>
        <Estado carregando={detalhe.carregando} erro={detalhe.erro} tem={Boolean(detalhe.dados)} aoTentar={() => void detalhe.recarregar()} />
        {detalhe.dados ? (
          <>
            <div className="cartao">
              <strong>{detalhe.dados.event.type}</strong>
              <div className="chips">
                <span className="chip">{NOME_DA_CATEGORIA[detalhe.dados.event.category]}</span>
                <span className={`chip ${TOM_DO_STATUS[detalhe.dados.event.status]}`}>{detalhe.dados.event.status}</span>
              </div>
              <span className="fraco">Aconteceu: {dataEHora(detalhe.dados.event.occurredAt)}</span>
              {detalhe.dados.event.publishedAt ? <span className="fraco">Publicado: {dataEHora(detalhe.dados.event.publishedAt)}</span> : null}
              {detalhe.dados.event.consumedAt ? <span className="fraco">Processado: {dataEHora(detalhe.dados.event.consumedAt)}</span> : null}
              <span className="etiqueta">Origem: {detalhe.dados.event.origin}</span>
            </div>
            <section className="secao">
              <h2 className="etiqueta">Processamento</h2>
              {detalhe.dados.history.length === 0 ? <p className="fraco">Ninguém processou este evento ainda.</p> : null}
              <div className="lista">
                {detalhe.dados.history.map((item, indice) => (
                  <div key={`${item.consumer}-${item.attempt}-${indice}`} className="linha">
                    <span className="texto">
                      <span>{item.consumer}</span>
                      <span className="etiqueta">
                        tentativa {item.attempt}
                        {item.durationMs !== null ? ` · ${item.durationMs} ms` : ""} · {dataEHora(item.occurredAt)}
                      </span>
                      {item.error ? <span className="erro">{item.error}</span> : null}
                    </span>
                    <span className={`chip ${TOM_DO_RESULTADO[item.result]}`}>{item.result}</span>
                  </div>
                ))}
              </div>
            </section>
            <section className="secao">
              <h2 className="etiqueta">Dados</h2>
              <pre className="codigo">{JSON.stringify(detalhe.dados.event.payload, null, 2)}</pre>
            </section>
          </>
        ) : null}
      </Folha>
    </Pagina>
  );
}
