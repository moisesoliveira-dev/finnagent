"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { useCallback, useId, useMemo, useRef, useState, type ReactNode } from "react";
import {
  CATEGORIAS_EVENTO,
  ESQUEMA_FILTRO_DE_EVENTOS,
  ESQUEMA_FILTRO_DO_HISTORICO,
  RESULTADOS_HISTORICO,
  type DetalheDoEvento,
  type FiltroDeEventos,
  type FiltroDoHistorico,
  type PaginaDeEventos,
  type PaginaDoHistorico,
  type ResultadoHistorico,
  type Retencao,
  type StatusEvento,
} from "@finnagent/contracts";
import { Button } from "../../components/ui/button";
import { Chip } from "../../components/ui/chip";
import { cn, focusRing } from "../../components/ui/cn";
import { Dialogo } from "../../components/ui/dialogo";
import { Carregando } from "../../components/ui/esqueleto";
import { Troca, useCurva } from "../../components/ui/movimento";
import { PageHeader } from "../../components/ui/page-header";
import { Paginacao } from "../../components/ui/paginacao";
import { Segmentado } from "../../components/ui/segmentado";
import { Vazio } from "../../components/ui/vazio";
import { DetalheDoEventoVista } from "./detalhe";
import { Abas, BotaoAtualizar, CampoDeBusca } from "./ferramentas";
import { diaCurto } from "./formato";
import { useLeitura, type Leitura } from "./leitura";
import { LinhaDoEvento, LinhaDoHistorico, PorDia } from "./linha-do-tempo";
import { ORDEM_DOS_STATUS, Ponto, STATUS_NO_PLURAL } from "./status";
import { mudarUrl, useBuscaDaUrl, useDesk } from "./url";
import { VolumeDeEventos } from "./volume";

type Visao = "eventos" | "historico";
type Filtrar = (mudancas: Record<string, string | null>) => void;

const NOME_DA_CATEGORIA = new Map<string, string>(CATEGORIAS_EVENTO.map((item) => [item.code, item.name]));

function nomeDaCategoria(code: string) {
  return NOME_DA_CATEGORIA.get(code) ?? code;
}

const NOME_DO_RESULTADO: Record<ResultadoHistorico, string> = {
  sucesso: "Sucesso",
  falha: "Falha",
  iniciado: "Iniciado",
};

const ALCANCE_DA_RETENCAO: Record<Retencao, string> = {
  "90d": "Mostra os últimos 90 dias de processamento.",
  "1a": "Mostra o último ano de processamento.",
  sempre: "Mostra todo o processamento registrado.",
};

// A query da API com só o que difere do padrão.
function consulta(filtro: Record<string, string | number | null>) {
  const parametros = new URLSearchParams();
  for (const [chave, valor] of Object.entries(filtro)) {
    if (valor === null || valor === "" || (chave === "pagina" && valor === 1)) continue;
    parametros.set(chave, String(valor));
  }
  return parametros.toString();
}

export default function EventosPage() {
  const busca = useBuscaDaUrl();
  const parametros = useMemo(() => Object.fromEntries(new URLSearchParams(busca)), [busca]);
  const visao: Visao = parametros.visao === "historico" ? "historico" : "eventos";
  const filtro = useMemo(() => ESQUEMA_FILTRO_DE_EVENTOS.parse(parametros), [parametros]);
  const filtroDoHistorico = useMemo(() => ESQUEMA_FILTRO_DO_HISTORICO.parse(parametros), [parametros]);
  const eventoId = parametros.evento || null;
  const desk = useDesk();
  const [versao, setVersao] = useState(0);
  const [deslize, setDeslize] = useState(0);
  const categorias = useRef<HTMLDialogElement>(null);
  const topo = useRef<HTMLDivElement>(null);

  const lista = useLeitura<PaginaDeEventos>(visao === "eventos" ? `/api/eventos?${consulta(filtro)}` : null, versao);
  const historico = useLeitura<PaginaDoHistorico>(
    visao === "historico" ? `/api/eventos/historico?${consulta(filtroDoHistorico)}` : null,
    versao,
  );
  const detalhe = useLeitura<DetalheDoEvento>(eventoId ? `/api/eventos/${encodeURIComponent(eventoId)}` : null, versao);

  const buscar = useCallback((texto: string) => mudarUrl({ q: texto || null, pagina: null }), []);
  const filtrar: Filtrar = (mudancas) => mudarUrl({ ...mudancas, pagina: null });
  const atualizar = () => setVersao((atual) => atual + 1);
  const abrir = (id: string) => mudarUrl({ evento: id });
  const fechar = () => mudarUrl({ evento: null });

  function irPara(pagina: number) {
    mudarUrl({ pagina: pagina > 1 ? pagina : null });
    const lugar = topo.current;
    if (lugar && lugar.getBoundingClientRect().top < 0) lugar.scrollIntoView({ block: "start" });
  }

  function trocarVisao(id: Visao, direcao: number) {
    setDeslize(direcao);
    mudarUrl({
      visao: id === "eventos" ? null : id,
      pagina: null,
      q: null,
      categoria: null,
      status: null,
      dia: null,
      resultado: null,
    });
  }

  const contagem = lista.dados?.counts.categories;

  return (
    <>
      <PageHeader
        title="Eventos"
        subtitle="Os fatos que o sistema registrou e o que aconteceu com cada um."
        actions={
          <>
            <Segmentado
              aria-label="Visão"
              opcoes={[
                { id: "eventos", label: "Eventos" },
                { id: "historico", label: "Histórico" },
              ]}
              valor={visao}
              onEscolher={trocarVisao}
            />
            <Button onClick={() => categorias.current?.showModal()}>Categorias</Button>
          </>
        }
      />

      <div ref={topo} className="grid min-w-0 scroll-mt-6 gap-6 desk:grid-cols-5 desk:items-start">
        <div className="min-w-0 desk:col-span-3">
          <Troca id={visao} direcao={deslize} className="grid min-w-0 gap-4">
            {visao === "eventos" ? (
              <VisaoDosEventos
                leitura={lista}
                filtro={filtro}
                eventoId={eventoId}
                onFiltrar={filtrar}
                onBuscar={buscar}
                onIr={irPara}
                onAbrir={abrir}
                onAtualizar={atualizar}
              />
            ) : (
              <VisaoDoHistorico
                leitura={historico}
                filtro={filtroDoHistorico}
                eventoId={eventoId}
                onFiltrar={filtrar}
                onBuscar={buscar}
                onIr={irPara}
                onAbrir={abrir}
                onAtualizar={atualizar}
              />
            )}
          </Troca>
        </div>
        {/* No desktop o evento aberto fica ao lado da lista; no celular e no tablet, abre no diálogo. */}
        <aside aria-label="Evento aberto" className="hidden min-w-0 desk:sticky desk:top-8 desk:col-span-2 desk:block">
          {desk ? (
            <PainelDoEvento
              leitura={detalhe}
              eventoId={eventoId}
              idDoTitulo="titulo-do-evento"
              moldura
              acoes={
                eventoId ? (
                  <Button variant="quiet" className="-mt-2" onClick={fechar}>
                    Fechar
                  </Button>
                ) : null
              }
            />
          ) : null}
        </aside>
      </div>

      <Dialogo
        aberto={!desk && eventoId !== null}
        largura="media"
        onClose={fechar}
        aria-labelledby="titulo-do-evento-no-dialogo"
      >
        {!desk && eventoId ? (
          <>
            <div className="mb-4 flex items-center justify-between gap-3">
              <span className="etiqueta text-ink-2">Evento</span>
              <Button variant="quiet" onClick={fechar}>
                Fechar
              </Button>
            </div>
            <div className="dialog-corpo">
              <PainelDoEvento leitura={detalhe} eventoId={eventoId} idDoTitulo="titulo-do-evento-no-dialogo" />
            </div>
          </>
        ) : null}
      </Dialogo>

      <Dialogo ref={categorias} largura="media" aria-labelledby="titulo-categorias">
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 id="titulo-categorias" className="font-display text-lg">
            Categorias de evento
          </h2>
          <Button variant="quiet" onClick={() => categorias.current?.close()}>
            Fechar
          </Button>
        </div>
        <div className="dialog-corpo">
          <ul className="overflow-hidden rounded-md border border-line">
            {CATEGORIAS_EVENTO.map((item) => (
              <li
                key={item.code}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3 last:border-b-0"
              >
                <div className="min-w-0">
                  <strong>{item.name}</strong> <span className="font-mono text-sm text-ink-2">{item.code}</span>
                  <div className="text-sm text-ink-2">{item.description}</div>
                </div>
                <div className="flex gap-2">
                  {contagem ? <Chip>{contagem[item.code].toLocaleString("pt-BR")} eventos</Chip> : null}
                  <Chip tone={item.active ? "ok" : "default"}>{item.active ? "ativa" : "inativa"}</Chip>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </Dialogo>
    </>
  );
}

type PropsDaVisao<F> = {
  filtro: F;
  eventoId: string | null;
  onFiltrar: Filtrar;
  onBuscar: (texto: string) => void;
  onIr: (pagina: number) => void;
  onAbrir: (id: string) => void;
  onAtualizar: () => void;
};

function VisaoDosEventos({
  leitura,
  filtro,
  eventoId,
  onFiltrar,
  onBuscar,
  onIr,
  onAbrir,
  onAtualizar,
}: PropsDaVisao<FiltroDeEventos> & { leitura: Leitura<PaginaDeEventos> }) {
  const dados = leitura.dados;
  if (!dados) {
    return leitura.falhou ? (
      <FalhaAoCarregar texto="Não foi possível carregar os eventos." onTentar={onAtualizar} />
    ) : (
      <Carregando texto="Carregando eventos." titulo linhas={6} />
    );
  }

  const filtrando = Boolean(filtro.categoria || filtro.status || filtro.dia || filtro.q);
  const todas = Object.values(dados.counts.categories).reduce((soma, total) => soma + total, 0);
  const visiveis = dados.categories.filter((item) => item.active || dados.counts.categories[item.code] > 0);

  return (
    <>
      <FaixaDeStatus contagem={dados.counts.status} status={filtro.status} onEscolher={(status) => onFiltrar({ status })}>
        <VolumeDeEventos
          volume={dados.volume}
          dia={filtro.dia}
          onEscolher={(dia) => onFiltrar({ dia: dia === filtro.dia ? null : dia })}
        />
      </FaixaDeStatus>

      <Abas
        rotulo="Categoria"
        valor={filtro.categoria}
        onEscolher={(categoria) => onFiltrar({ categoria })}
        opcoes={[
          { id: null, nome: "Todas", total: todas },
          ...visiveis.map((item) => ({ id: item.code, nome: item.name, total: dados.counts.categories[item.code] })),
        ]}
      />

      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <CampoDeBusca valor={filtro.q} rotulo="Buscar eventos" dica="Tipo, agregado ou id" onBuscar={onBuscar} />
        <BotaoAtualizar buscando={leitura.buscando} onAtualizar={onAtualizar} />
        {filtro.dia ? <Chip tone="ok">Dia {diaCurto(filtro.dia)}</Chip> : null}
        {filtrando ? (
          <Button variant="quiet" onClick={() => onFiltrar({ categoria: null, status: null, dia: null, q: null })}>
            Limpar filtros
          </Button>
        ) : null}
      </div>

      <Lista buscando={leitura.buscando} rodape={<Paginacao pagina={dados.page} rotulo="eventos" onIr={onIr} />}>
        {dados.events.length === 0 ? (
          <p className="px-4 py-6 text-sm text-ink-2">
            {filtrando ? "Nenhum evento com esses filtros." : "Nenhum evento registrado ainda."}
          </p>
        ) : (
          <PorDia
            itens={dados.events}
            quando={(evento) => evento.occurredAt}
            fuso={dados.timezone}
            hoje={dados.today}
            chave={(evento) => evento.id}
            linha={(evento) => (
              <LinhaDoEvento
                evento={evento}
                fuso={dados.timezone}
                categoria={nomeDaCategoria(evento.category)}
                aberta={evento.id === eventoId}
                onAbrir={() => onAbrir(evento.id)}
              />
            )}
          />
        )}
      </Lista>
    </>
  );
}

function VisaoDoHistorico({
  leitura,
  filtro,
  eventoId,
  onFiltrar,
  onBuscar,
  onIr,
  onAbrir,
  onAtualizar,
}: PropsDaVisao<FiltroDoHistorico> & { leitura: Leitura<PaginaDoHistorico> }) {
  const dados = leitura.dados;
  if (!dados) {
    return leitura.falhou ? (
      <FalhaAoCarregar texto="Não foi possível carregar o histórico." onTentar={onAtualizar} />
    ) : (
      <Carregando texto="Carregando o histórico." linhas={6} />
    );
  }

  const filtrando = Boolean(filtro.resultado || filtro.q);

  return (
    <>
      <Abas
        rotulo="Resultado"
        valor={filtro.resultado}
        onEscolher={(resultado) => onFiltrar({ resultado })}
        opcoes={[
          { id: null, nome: "Todos" },
          ...RESULTADOS_HISTORICO.map((item) => ({ id: item, nome: NOME_DO_RESULTADO[item] })),
        ]}
      />

      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <CampoDeBusca valor={filtro.q} rotulo="Buscar no histórico" dica="Tipo do evento" onBuscar={onBuscar} />
        <BotaoAtualizar buscando={leitura.buscando} onAtualizar={onAtualizar} />
        {filtrando ? (
          <Button variant="quiet" onClick={() => onFiltrar({ resultado: null, q: null })}>
            Limpar filtros
          </Button>
        ) : null}
      </div>

      <p className="text-sm text-ink-2">
        {ALCANCE_DA_RETENCAO[dados.retention]}{" "}
        <Link href="/configuracoes?secao=eventos" className="font-medium text-brand underline-offset-4 hover:underline">
          Mudar a retenção
        </Link>
      </p>

      <Lista buscando={leitura.buscando} rodape={<Paginacao pagina={dados.page} rotulo="registros" onIr={onIr} />}>
        {dados.history.length === 0 ? (
          <p className="px-4 py-6 text-sm text-ink-2">
            {filtrando ? "Nenhum registro com esses filtros." : "Nenhum processamento registrado nesse prazo."}
          </p>
        ) : (
          <PorDia
            itens={dados.history}
            quando={(linha) => linha.occurredAt}
            fuso={dados.timezone}
            hoje={dados.today}
            chave={(linha) => `${linha.eventId}:${linha.attempt}:${linha.occurredAt}`}
            linha={(linha) => (
              <LinhaDoHistorico
                linha={linha}
                fuso={dados.timezone}
                aberta={linha.eventId === eventoId}
                onAbrir={() => onAbrir(linha.eventId)}
              />
            )}
          />
        )}
      </Lista>
    </>
  );
}

// A lista esmaece enquanto a próxima página chega, em vez de piscar o esqueleto.
function Lista({ buscando, rodape, children }: { buscando: boolean; rodape: ReactNode; children: ReactNode }) {
  const curva = useCurva();
  return (
    <motion.div
      animate={{ opacity: buscando ? 0.5 : 1 }}
      transition={curva}
      aria-busy={buscando}
      className="grid min-w-0 border border-line bg-surface"
    >
      {children}
      {rodape ? <div className="border-t border-line empty:hidden">{rodape}</div> : null}
    </motion.div>
  );
}

// Os quatro status viram filtros grandes: o número de cada um e o ponto que a lista usa. Tocar de novo desfaz.
function FaixaDeStatus({
  contagem,
  status,
  onEscolher,
  children,
}: {
  contagem: Record<StatusEvento, number>;
  status: StatusEvento | null;
  onEscolher: (status: StatusEvento | null) => void;
  children: ReactNode;
}) {
  const marca = useId();
  const curva = useCurva();
  return (
    <section aria-label="Resumo dos eventos" className="min-w-0 border border-line bg-surface">
      <div
        role="group"
        aria-label="Status"
        className="grid grid-cols-2 border-b border-line tab:grid-cols-4 desk:grid-cols-2"
      >
        {ORDEM_DOS_STATUS.map((item, indice) => {
          const ativo = status === item;
          return (
            <button
              key={item}
              type="button"
              aria-pressed={ativo}
              onClick={() => onEscolher(ativo ? null : item)}
              className={cn(
                "relative grid min-w-0 content-start gap-1 border-line px-4 py-3 text-left transition-colors",
                ativo ? "bg-brand-soft" : "hover:bg-surface-2",
                BORDAS_DO_STATUS[indice],
                focusRing,
              )}
            >
              {ativo ? (
                <motion.span
                  layoutId={marca}
                  transition={curva}
                  className="absolute inset-x-0 top-0 border-t-2 border-brand"
                />
              ) : null}
              <span className="etiqueta flex min-w-0 items-center gap-2 text-ink-2">
                <Ponto status={item} />
                {STATUS_NO_PLURAL[item]}
              </span>
              <span
                className={cn("font-display text-xl font-bold tracking-titulo proportional-nums", ativo && "text-brand")}
              >
                {contagem[item].toLocaleString("pt-BR")}
              </span>
            </button>
          );
        })}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

// Duas colunas no celular e na coluna estreita do desktop; quatro lado a lado no tablet.
const BORDAS_DO_STATUS = [
  "border-r",
  "tab:border-r desk:border-r-0",
  "border-t border-r tab:border-t-0 desk:border-t",
  "border-t tab:border-t-0 desk:border-t",
];

function PainelDoEvento({
  leitura,
  eventoId,
  idDoTitulo,
  acoes,
  moldura = false,
}: {
  leitura: Leitura<DetalheDoEvento>;
  eventoId: string | null;
  idDoTitulo: string;
  acoes?: ReactNode;
  moldura?: boolean;
}) {
  const curva = useCurva();
  const caixa = moldura ? "border border-line bg-surface p-6" : "";
  if (!eventoId) {
    return <Vazio>Escolha um evento para ver o processamento, os dados e o payload.</Vazio>;
  }
  // Enquanto o próximo evento chega, o anterior fica esmaecido; se ele não existir, avisa em vez de mostrar o velho.
  const atual = leitura.dados?.event.id === eventoId ? leitura.dados : null;
  const mostrado = atual ?? (leitura.buscando ? leitura.dados : null);
  if (!mostrado) {
    return leitura.falhou ? (
      <div className={cn("grid justify-items-start gap-3", caixa)}>
        <p className="text-sm text-ink-2">Esse evento não foi encontrado.</p>
        {acoes}
      </div>
    ) : (
      <Carregando texto="Carregando o evento." linhas={4} className={caixa} />
    );
  }
  return (
    <motion.div
      animate={{ opacity: leitura.buscando ? 0.5 : 1 }}
      transition={curva}
      aria-busy={leitura.buscando}
      className={cn("min-w-0", caixa)}
    >
      <DetalheDoEventoVista
        detalhe={mostrado}
        categoria={nomeDaCategoria(mostrado.event.category)}
        idDoTitulo={idDoTitulo}
        acoes={acoes}
      />
    </motion.div>
  );
}

function FalhaAoCarregar({ texto, onTentar }: { texto: string; onTentar: () => void }) {
  return (
    <div className="grid justify-items-start gap-3">
      <Vazio>{texto}</Vazio>
      <Button onClick={onTentar}>Tentar de novo</Button>
    </div>
  );
}
