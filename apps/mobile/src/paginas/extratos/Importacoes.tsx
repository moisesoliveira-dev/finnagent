import { IonAlert, IonButton, IonIcon, useIonToast } from "@ionic/react";
import type { Extrato, ExtratosResposta, StatusExtrato } from "@finnagent/contracts";
import { addOutline, documentTextOutline } from "ionicons/icons";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { enviar, pedir } from "../../api/cliente";
import { diaEMes } from "../../api/arquivo";
import { Estado, Vazio } from "../../componentes/Estado";
import { Fichas, Selecao } from "../../componentes/Selecao";
import { toque } from "../../haptico";
import { Bloco, Cascata, Contagem, curvaCheia, toqueDoDedo } from "../../movimento";
import { useDados } from "../../useDados";
import { ImportarExtrato } from "./ImportarExtrato";
import { LinhasDoExtrato } from "./LinhasDoExtrato";

const ROTULO: Record<StatusExtrato, string> = {
  importado: "Importado",
  com_erros: "Com erros",
  processando: "Processando",
  falhou: "Falhou",
};

const classeDoStatus = (status: StatusExtrato) => (status === "importado" ? "chip ok" : status === "processando" ? "chip" : "chip neg");

function periodo(extrato: Extrato) {
  if (!extrato.startDate || !extrato.endDate) return "Período aguardando leitura";
  return `${diaEMes(extrato.startDate)} – ${diaEMes(extrato.endDate)}`;
}

function quando(iso: string) {
  const data = new Date(iso);
  const dois = (valor: number) => String(valor).padStart(2, "0");
  return `${dois(data.getDate())}/${dois(data.getMonth() + 1)} às ${dois(data.getHours())}:${dois(data.getMinutes())}`;
}

/** A barra de saúde da leitura: o que entrou limpo em azul e o que deu erro em vermelho, crescendo da esquerda. */
function Saude({ lidas, erros }: { lidas: number; erros: number }) {
  const total = Math.max(lidas, 1);
  const limpas = Math.max(lidas - erros, 0);
  return (
    <div className="saude" role="img" aria-label={`${limpas} linhas lidas sem erro e ${erros} com erro`}>
      <motion.span style={{ width: `${(limpas / total) * 100}%`, background: "var(--brand)", transformOrigin: "0% 50%" }} initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ ...curvaCheia, duration: 0.8 }} />
      <motion.span style={{ width: `${(erros / total) * 100}%`, background: "var(--neg)", transformOrigin: "0% 50%" }} initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ ...curvaCheia, duration: 0.8, delay: 0.1 }} />
    </div>
  );
}

export function Importacoes() {
  const [avisar] = useIonToast();
  const { dados, erro, carregando, recarregar } = useDados<ExtratosResposta>("/api/extratos");
  const [conta, setConta] = useState("");
  const [status, setStatus] = useState<"" | StatusExtrato>("");
  const [importando, setImportando] = useState(false);
  const [aberto, setAberto] = useState<{ extrato: Extrato; soErros: boolean } | null>(null);
  const [excluir, setExcluir] = useState<Extrato | null>(null);
  const [ocupado, setOcupado] = useState("");

  const extratos = dados?.statements ?? [];
  const contas = dados?.accounts ?? [];

  // A leitura de imagem e PDF demora: enquanto houver extrato processando, a lista se atualiza sozinha.
  useEffect(() => {
    if (!extratos.some((item) => item.status === "processando")) return;
    const relogio = setInterval(() => void recarregar(), 3000);
    return () => clearInterval(relogio);
  }, [extratos, recarregar]);

  const filtrados = extratos.filter((item) => (!conta || item.accountId === conta) && (!status || item.status === status));
  const lidas = extratos.reduce((total, item) => total + item.lineCount, 0);
  const comErro = extratos.reduce((total, item) => total + item.errorCount, 0);
  const ultima = extratos.reduce((maior, item) => (item.importedAt > maior ? item.importedAt : maior), "");

  const dizer = (mensagem: string, erroNoAviso = false) =>
    void avisar({ message: mensagem, duration: 3000, position: "top", cssClass: erroNoAviso ? "aviso-de-erro" : undefined });

  async function reprocessar(extrato: Extrato) {
    setOcupado(extrato.id);
    try {
      await enviar<void>(`/api/extratos/${extrato.id}/reprocessar`, {});
      toque(true);
      dizer("Extrato reprocessado.");
      await recarregar();
    } catch (error) {
      dizer(error instanceof Error ? error.message : "Não foi possível reprocessar o extrato.", true);
    } finally {
      setOcupado("");
    }
  }

  async function excluirExtrato(extrato: Extrato) {
    setOcupado(extrato.id);
    try {
      await pedir<void>(`/api/extratos/${extrato.id}`, { method: "DELETE" });
      toque(true);
      dizer("Extrato excluído.");
      await recarregar();
    } catch (error) {
      dizer(error instanceof Error ? error.message : "Não foi possível excluir o extrato.", true);
    } finally {
      setOcupado("");
    }
  }

  return (
    <div className="secao" style={{ gap: 16 }}>
      <motion.div whileTap={toqueDoDedo}>
        <IonButton expand="block" className="principal" onClick={() => setImportando(true)}>
          <IonIcon slot="start" icon={addOutline} />
          Importar extrato
        </IonButton>
      </motion.div>

      <Estado carregando={carregando} erro={erro} tem={Boolean(dados)} aoTentar={() => void recarregar()} />

      {dados && extratos.length === 0 ? (
        <Vazio icone={documentTextOutline} titulo="Nenhum extrato ainda" texto="Importe o OFX ou o CSV do seu banco, ou uma foto do extrato, para conferir o mês." />
      ) : null}

      {dados && extratos.length > 0 ? (
        <Cascata className="secao">
          <Bloco className="cartao">
            <div className="grade tres">
              <div className="secao" style={{ gap: 4 }}>
                <span className="etiqueta">Extratos</span>
                <Contagem valor={extratos.length} formatar={String} className="numero" />
              </div>
              <div className="secao" style={{ gap: 4 }}>
                <span className="etiqueta">Linhas</span>
                <Contagem valor={lidas} formatar={String} className="numero" />
              </div>
              <div className="secao" style={{ gap: 4 }}>
                <span className="etiqueta">Com erro</span>
                <Contagem valor={comErro} formatar={String} className={`numero${comErro > 0 ? " neg" : ""}`} />
              </div>
            </div>
            <Saude lidas={lidas} erros={comErro} />
            {ultima ? <span className="fraco">Última importação em {quando(ultima)}</span> : null}
          </Bloco>

          {contas.length > 1 ? (
            <Bloco>
              <Selecao rotulo="Conta" valor={conta} vazio="Todas as contas" opcoes={contas.map((item) => ({ id: item.id, texto: item.name }))} aoMudar={setConta} />
            </Bloco>
          ) : null}
          <Bloco>
            <Fichas<"" | StatusExtrato>
              rotulo="Situação"
              valor={status}
              aoMudar={setStatus}
              opcoes={[
                { id: "", texto: "Todos" },
                { id: "importado", texto: "Importados" },
                { id: "com_erros", texto: "Com erros" },
                { id: "processando", texto: "Processando" },
                { id: "falhou", texto: "Falharam" },
              ]}
            />
          </Bloco>

          {filtrados.length === 0 ? <p className="fraco">Nenhum extrato com esses filtros.</p> : null}

          {filtrados.map((extrato) => (
            <Bloco key={extrato.id} className="cartao-de-extrato">
              <div className="cabeca-da-linha">
                <div className="texto" style={{ minWidth: 0 }}>
                  <strong style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{extrato.filename}</strong>
                  <span className="etiqueta">
                    {extrato.accountName} · {periodo(extrato)}
                  </span>
                </div>
                <span className={classeDoStatus(extrato.status)}>{ROTULO[extrato.status]}</span>
              </div>
              <Saude lidas={extrato.lineCount} erros={extrato.errorCount} />
              <span className="fraco">
                {extrato.lineCount} {extrato.lineCount === 1 ? "linha" : "linhas"}
                {extrato.errorCount > 0 ? ` · ${extrato.errorCount} com erro` : ""}
                {" · importado em "}
                {quando(extrato.importedAt)}
              </span>
              {extrato.message ? <span className="fraco">{extrato.message}</span> : null}
              <div className="acoes">
                <IonButton fill="clear" size="small" onClick={() => setAberto({ extrato, soErros: false })}>
                  Ver linhas
                </IonButton>
                {extrato.errorCount > 0 ? (
                  <IonButton fill="clear" size="small" onClick={() => setAberto({ extrato, soErros: true })}>
                    Só erros
                  </IonButton>
                ) : null}
                {extrato.status === "com_erros" || extrato.status === "falhou" ? (
                  <IonButton fill="clear" size="small" disabled={ocupado === extrato.id} onClick={() => void reprocessar(extrato)}>
                    Reprocessar
                  </IonButton>
                ) : null}
                <IonButton fill="clear" size="small" color="danger" disabled={ocupado === extrato.id} onClick={() => setExcluir(extrato)}>
                  Excluir
                </IonButton>
              </div>
            </Bloco>
          ))}
        </Cascata>
      ) : null}

      <ImportarExtrato
        aberto={importando}
        contas={contas}
        aoFechar={() => setImportando(false)}
        aoImportado={(mensagem) => {
          setImportando(false);
          dizer(mensagem);
          void recarregar();
        }}
      />
      <LinhasDoExtrato extrato={aberto?.extrato ?? null} soErros={aberto?.soErros ?? false} aoFechar={() => setAberto(null)} />
      <IonAlert
        isOpen={Boolean(excluir)}
        header="Excluir este extrato?"
        message={excluir ? `O arquivo "${excluir.filename}" e as linhas importadas dele serão removidos. Essa ação não pode ser desfeita.` : ""}
        buttons={[
          { text: "Cancelar", role: "cancel" },
          { text: "Excluir", role: "destructive", handler: () => (excluir ? void excluirExtrato(excluir) : undefined) },
        ]}
        onDidDismiss={() => setExcluir(null)}
      />
    </div>
  );
}
