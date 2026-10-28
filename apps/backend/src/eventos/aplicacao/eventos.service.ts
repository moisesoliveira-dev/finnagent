import { Inject, Injectable } from "@nestjs/common";
import {
  CATEGORIAS_EVENTO,
  CONSUMIDOR_DA_OUTBOX,
  DIAS_DO_VOLUME_DE_EVENTOS,
  EVENTOS_POR_PAGINA,
  STATUS_EVENTO,
  eventoDaLinha,
  historicoDoEvento,
  type DetalheDoEvento,
  type FiltroDeEventos,
  type FiltroDoHistorico,
  type PaginaDeEventos,
  type PaginaDoHistorico,
} from "@finnagent/contracts";
import {
  CONFIGURACOES_REPOSITORIO,
  type ConfiguracoesRepositorio,
} from "../../configuracoes/portas/configuracoes-repositorio.js";
import { diaNoFuso } from "../../financas/dominio/vista.js";
import { NaoEncontrado } from "../../grupos/dominio/erros.js";
import {
  contarPor,
  diasAte,
  fusoDaConta,
  inicioDaRetencao,
  montarVolume,
  paginaNoLimite,
  retencaoDaConta,
} from "../dominio/pagina.js";
import { EVENTOS_REPOSITORIO, type EventosRepositorio } from "../portas/eventos-repositorio.js";

const CODIGOS = CATEGORIAS_EVENTO.map((item) => item.code);

@Injectable()
export class EventosService {
  constructor(
    @Inject(EVENTOS_REPOSITORIO) private readonly eventos: EventosRepositorio,
    // Só o fuso e a retenção gravados: o serviço de configurações consultaria o Google a cada leitura.
    @Inject(CONFIGURACOES_REPOSITORIO) private readonly configuracoes: ConfiguracoesRepositorio,
  ) {}

  async pagina(tenantId: string, filtro: FiltroDeEventos, agora = new Date()): Promise<PaginaDeEventos> {
    const fuso = fusoDaConta((await this.configuracoes.obter(tenantId)).timezone);
    const today = diaNoFuso(fuso, agora);
    const dias = diasAte(today, DIAS_DO_VOLUME_DE_EVENTOS);
    const resumo = await this.eventos.resumir(tenantId, filtro, fuso, dias[0]);
    const numero = paginaNoLimite(filtro.pagina, resumo.total, EVENTOS_POR_PAGINA);
    const linhas = resumo.total
      ? await this.eventos.listar(tenantId, filtro, fuso, (numero - 1) * EVENTOS_POR_PAGINA, EVENTOS_POR_PAGINA)
      : [];
    return {
      categories: [...CATEGORIAS_EVENTO],
      timezone: fuso,
      today,
      events: linhas.map(eventoDaLinha),
      page: { number: numero, size: EVENTOS_POR_PAGINA, total: resumo.total },
      counts: {
        categories: contarPor(CODIGOS, resumo.porCategoria),
        status: contarPor(STATUS_EVENTO, resumo.porStatus),
      },
      volume: montarVolume(dias, resumo.porDia),
    };
  }

  async historico(tenantId: string, filtro: FiltroDoHistorico, agora = new Date()): Promise<PaginaDoHistorico> {
    const preferencias = await this.configuracoes.obter(tenantId);
    const fuso = fusoDaConta(preferencias.timezone);
    const retention = retencaoDaConta(preferencias.history);
    const today = diaNoFuso(fuso, agora);
    const vazio = { timezone: fuso, today, retention, history: [], page: { number: 1, size: EVENTOS_POR_PAGINA, total: 0 } };
    // Hoje todo processamento registrado deu certo na primeira tentativa: só "sucesso" tem linhas.
    if (filtro.resultado && filtro.resultado !== "sucesso") return vazio;
    const termo = filtro.q.toLowerCase();
    // Todas as linhas têm o mesmo consumidor: se a busca acha o nome dele, acha todas.
    const busca = CONSUMIDOR_DA_OUTBOX.toLowerCase().includes(termo) ? "" : termo;
    const desde = inicioDaRetencao(retention, agora);
    const total = await this.eventos.contarConsumidos(tenantId, busca, desde);
    if (!total) return vazio;
    const numero = paginaNoLimite(filtro.pagina, total, EVENTOS_POR_PAGINA);
    const linhas = await this.eventos.listarConsumidos(
      tenantId,
      busca,
      desde,
      (numero - 1) * EVENTOS_POR_PAGINA,
      EVENTOS_POR_PAGINA,
    );
    return {
      timezone: fuso,
      today,
      retention,
      history: linhas.flatMap((linha) => historicoDoEvento(eventoDaLinha(linha))),
      page: { number: numero, size: EVENTOS_POR_PAGINA, total },
    };
  }

  async detalhe(tenantId: string, id: string): Promise<DetalheDoEvento> {
    const [preferencias, linha] = await Promise.all([this.configuracoes.obter(tenantId), this.eventos.buscar(tenantId, id)]);
    if (!linha) throw new NaoEncontrado("Evento não encontrado.");
    const event = eventoDaLinha(linha);
    return { timezone: fusoDaConta(preferencias.timezone), event, history: historicoDoEvento(event) };
  }
}
