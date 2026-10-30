import { Inject, Injectable } from "@nestjs/common";
import { ANTECEDENCIA_MS, STATUS_EXTRATO, type Compromisso } from "@finnagent/contracts";
import { z } from "zod";
import { AgendaService } from "../../agenda/aplicacao/agenda.service.js";
import { AssistenteService } from "../../assistente/aplicacao/assistente.service.js";
import { AuthService } from "../../auth/aplicacao/auth.service.js";
import {
  CONFIGURACOES_REPOSITORIO,
  type ConfiguracoesRepositorio,
} from "../../configuracoes/portas/configuracoes-repositorio.js";
import { ExtratosService } from "../../extratos/aplicacao/extratos.service.js";
import { FinancasService } from "../../financas/aplicacao/financas.service.js";
import { diaNoFuso } from "../../financas/dominio/vista.js";
import { log } from "../../log.js";
import { MetasService } from "../../metas/aplicacao/metas.service.js";
import {
  ESPERA_DO_PLANO_MS,
  HORA_DOS_AVISOS_DO_DIA,
  avisoDeConferencia,
  avisoDeExtratoLido,
  avisoDePlano,
  avisosDasMetas,
  horaNoFuso,
  lembretesNaJanela,
  vencimentosDeHoje,
  type PedidoDeNotificacao,
} from "../dominio/avisos.js";
import { NotificacoesService } from "./notificacoes.service.js";

const extratoImportado = z.object({
  id: z.uuid(),
  status: z.enum(STATUS_EXTRATO),
});

/**
 * Transforma os fatos das outras slices em avisos. Roda por conta, no fuso dela: os lembretes e o plano parado
 * a cada passada; os do dia (vencimentos, conferência e metas) uma vez por dia, a partir das 8h.
 * Repetir é seguro: a chave do aviso impede a duplicata.
 */
@Injectable()
export class VarreduraService {
  /** O dia em que cada conta já recebeu os avisos do dia, para não refazer a conta a cada passada. */
  private readonly avisosDoDia = new Map<string, string>();

  constructor(
    private readonly notificacoes: NotificacoesService,
    private readonly auth: AuthService,
    private readonly financas: FinancasService,
    private readonly agenda: AgendaService,
    private readonly extratos: ExtratosService,
    private readonly metas: MetasService,
    private readonly assistente: AssistenteService,
    @Inject(CONFIGURACOES_REPOSITORIO) private readonly configuracoes: ConfiguracoesRepositorio,
  ) {}

  async varrer(agora = new Date()) {
    for (const tenantId of await this.auth.listarTenants()) {
      try {
        await this.varrerConta(tenantId, agora);
      } catch (error) {
        // Uma conta com problema não impede as outras.
        log.error({ tenantId, err: error instanceof Error ? error.message : String(error) }, "a varredura de avisos falhou");
      }
    }
  }

  async varrerConta(tenantId: string, agora = new Date()) {
    const conta = await this.configuracoes.obter(tenantId);
    const hoje = diaNoFuso(conta.timezone, agora);
    const pedidos: PedidoDeNotificacao[] = [];

    const janela = ANTECEDENCIA_MS[conta.reminder];
    pedidos.push(...lembretesNaJanela(await this.compromissosAte(tenantId, conta.timezone, agora, janela), agora, janela, hoje));

    const planos = await this.assistente.planosEsperando(tenantId, new Date(agora.getTime() - ESPERA_DO_PLANO_MS));
    pedidos.push(...planos.map(avisoDePlano));

    if (horaNoFuso(conta.timezone, agora) >= HORA_DOS_AVISOS_DO_DIA && this.avisosDoDia.get(tenantId) !== hoje) {
      const [ano, mes] = hoje.split("-").map(Number) as [number, number];
      const base = await this.financas.listar(tenantId);
      pedidos.push(...vencimentosDeHoje(base.entries, hoje));
      pedidos.push(...avisoDeConferencia(await this.extratos.semConferir(tenantId, ano, mes), hoje));
      pedidos.push(...avisosDasMetas(await this.metas.listar(tenantId), hoje));
      await this.notificacoes.notificar(tenantId, pedidos);
      this.avisosDoDia.set(tenantId, hoje);
      return;
    }
    await this.notificacoes.notificar(tenantId, pedidos);
  }

  /**
   * O fim da leitura de um extrato por imagem ou PDF. O CSV e o OFX também gravam `importar-extrato`, mas
   * a pessoa estava na tela: só a leitura que corre depois vira aviso.
   */
  async extratoImportado(tenantId: string, payload: unknown) {
    const lido = extratoImportado.safeParse(payload);
    if (!lido.success || lido.data.status === "processando") return;
    const extrato = (await this.extratos.listar(tenantId)).statements.find((item) => item.id === lido.data.id);
    if (!extrato || extrato.format !== "ocr") return;
    await this.notificacoes.notificar(tenantId, avisoDeExtratoLido({ ...extrato, status: lido.data.status }));
  }

  /** Os compromissos do mês de hoje e, se a antecedência passar do fim do mês, os do mês seguinte. */
  private async compromissosAte(tenantId: string, fuso: string, agora: Date, janela: number): Promise<Compromisso[]> {
    const meses = new Set([diaNoFuso(fuso, agora).slice(0, 7), diaNoFuso(fuso, new Date(agora.getTime() + janela)).slice(0, 7)]);
    const lista: Compromisso[] = [];
    for (const mes of meses) {
      const [ano, numero] = mes.split("-").map(Number) as [number, number];
      lista.push(...(await this.agenda.ocorrencias(tenantId, ano, numero)));
    }
    return lista;
  }
}
