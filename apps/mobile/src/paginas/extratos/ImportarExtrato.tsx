import { IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonModal, IonTitle, IonToolbar } from "@ionic/react";
import {
  LIMITE_EXTRATO_BYTES,
  type Conta,
  type FormatoExtrato,
  type LinhaExtrato,
  type MapeamentoExtrato,
  type PreviaExtrato,
} from "@finnagent/contracts";
import { closeOutline, documentAttachOutline } from "ionicons/icons";
import { AnimatePresence, motion } from "motion/react";
import { useRef, useState } from "react";
import { enviar } from "../../api/cliente";
import { base64DoArquivo, diaCompleto } from "../../api/arquivo";
import { Dinheiro } from "../../componentes/Estado";
import { Campo } from "../../componentes/Campo";
import { Selecao } from "../../componentes/Selecao";
import { toque } from "../../haptico";
import { Bloco, Cascata, curvaCheia, toqueDoDedo } from "../../movimento";
import { personOutline } from "ionicons/icons";

const NOVA = "nova";
const FORMATOS_COM_IMAGEM = [".png", ".jpg", ".jpeg", ".webp", ".pdf"];
const MAPEAMENTO_INICIAL: MapeamentoExtrato = { date: 0, description: 1, amount: 2 };

/** A folha de importar: escolher o arquivo, ver a prévia do que será lido, dizer de qual conta é e importar. */
export function ImportarExtrato({
  aberto,
  contas,
  aoFechar,
  aoImportado,
}: {
  aberto: boolean;
  contas: Conta[];
  aoFechar: () => void;
  aoImportado: (mensagem: string) => void;
}) {
  const entrada = useRef<HTMLInputElement>(null);
  const pedido = useRef(0);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [formato, setFormato] = useState<FormatoExtrato | null>(null);
  const [colunas, setColunas] = useState<string[]>([]);
  const [mapeamento, setMapeamento] = useState<MapeamentoExtrato>(MAPEAMENTO_INICIAL);
  const [previa, setPrevia] = useState<LinhaExtrato[]>([]);
  const [contaId, setContaId] = useState("");
  const [nomeDaConta, setNomeDaConta] = useState("");
  const [lendo, setLendo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  function limpar() {
    pedido.current++;
    setArquivo(null);
    setFormato(null);
    setColunas([]);
    setMapeamento(MAPEAMENTO_INICIAL);
    setPrevia([]);
    setContaId("");
    setNomeDaConta("");
    setLendo(false);
    setSalvando(false);
    setErro("");
    if (entrada.current) entrada.current.value = "";
  }

  async function lerPrevia(file: File, mapa: MapeamentoExtrato | null) {
    const atual = ++pedido.current;
    setLendo(true);
    try {
      const resposta = await enviar<PreviaExtrato>("/api/extratos/previa", {
        filename: file.name,
        content: await base64DoArquivo(file),
        mapping: mapa,
      });
      if (atual !== pedido.current) return;
      setFormato(resposta.format);
      setColunas(resposta.columns);
      setPrevia(resposta.lines);
      if (!mapa && resposta.mapping) setMapeamento(resposta.mapping);
      setErro("");
    } catch (error) {
      if (atual === pedido.current) setErro(error instanceof Error ? error.message : "Não foi possível ler o arquivo.");
    } finally {
      if (atual === pedido.current) setLendo(false);
    }
  }

  async function escolher(file: File | undefined) {
    if (!file) return;
    setPrevia([]);
    setColunas([]);
    setFormato(null);
    setErro("");
    if (file.size > LIMITE_EXTRATO_BYTES) {
      setArquivo(null);
      setErro("O arquivo passa de 5 MB.");
      return;
    }
    const nome = file.name.toLowerCase();
    const comImagem = FORMATOS_COM_IMAGEM.some((extensao) => nome.endsWith(extensao));
    if (!nome.endsWith(".ofx") && !nome.endsWith(".csv") && !comImagem) {
      setArquivo(null);
      setErro("Envie um OFX, um CSV ou uma imagem do extrato.");
      return;
    }
    setArquivo(file);
    toque();
    if (comImagem) {
      setFormato("ocr");
      return;
    }
    await lerPrevia(file, null);
  }

  function mudarColuna(campo: keyof MapeamentoExtrato, valor: string) {
    const proximo = { ...mapeamento, [campo]: Number(valor) };
    setMapeamento(proximo);
    if (arquivo) void lerPrevia(arquivo, proximo);
  }

  const semConta = contaId === "" || (contaId === NOVA && !nomeDaConta.trim());

  async function importar() {
    if (!arquivo || salvando || semConta) return;
    setSalvando(true);
    setErro("");
    try {
      await enviar<void>("/api/extratos", {
        id: crypto.randomUUID(),
        filename: arquivo.name,
        content: await base64DoArquivo(arquivo),
        accountId: contaId === NOVA ? null : contaId,
        accountName: contaId === NOVA ? nomeDaConta.trim() : null,
        mapping: formato === "csv" ? mapeamento : null,
      });
      toque(true);
      aoImportado(formato === "ocr" ? "Extrato recebido. A leitura segue na lista." : "Extrato importado.");
      limpar();
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível importar o extrato.");
      setSalvando(false);
    }
  }

  const opcoesDeColuna = colunas.map((nome, indice) => ({ id: String(indice), texto: nome || `Coluna ${indice + 1}` }));

  return (
    <IonModal
      isOpen={aberto}
      onDidDismiss={() => {
        limpar();
        aoFechar();
      }}
    >
      <IonHeader>
        <IonToolbar>
          <IonTitle>Importar extrato</IonTitle>
          <IonButtons slot="end">
            <IonButton aria-label="Fechar" onClick={aoFechar}>
              <IonIcon slot="icon-only" icon={closeOutline} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <Cascata className="pagina">
          <Bloco className="secao">
            <input
              ref={entrada}
              id="arquivo-do-extrato"
              type="file"
              className="so-leitor-de-tela"
              accept=".ofx,.csv,.png,.jpg,.jpeg,.webp,.pdf,image/*,application/pdf"
              onChange={(evento) => void escolher(evento.target.files?.[0])}
            />
            <motion.label htmlFor="arquivo-do-extrato" className="area-de-arquivo" whileTap={toqueDoDedo}>
              <IonIcon icon={documentAttachOutline} aria-hidden />
              <strong>{arquivo ? arquivo.name : "Escolher o arquivo"}</strong>
              <span className="fraco">{arquivo ? `${Math.max(1, Math.round(arquivo.size / 1024))} KB` : "OFX, CSV ou uma imagem do extrato, até 5 MB"}</span>
            </motion.label>
          </Bloco>

          <AnimatePresence initial={false}>
            {erro ? (
              <motion.p key={erro} className="erro" role="alert" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} style={{ overflow: "hidden" }}>
                {erro}
              </motion.p>
            ) : null}
          </AnimatePresence>

          {arquivo && formato === "ocr" ? (
            <Bloco>
              <p className="aviso">Imagem e PDF passam pela leitura do consultor. O extrato entra na lista como "Processando" e as linhas aparecem quando a leitura terminar.</p>
            </Bloco>
          ) : null}

          {formato === "csv" && colunas.length > 0 ? (
            <Bloco className="cartao">
              <span className="etiqueta">Quais colunas são quais?</span>
              <Selecao rotulo="Data" valor={String(mapeamento.date)} opcoes={opcoesDeColuna} aoMudar={(valor) => mudarColuna("date", valor)} />
              <Selecao rotulo="Descrição" valor={String(mapeamento.description)} opcoes={opcoesDeColuna} aoMudar={(valor) => mudarColuna("description", valor)} />
              <Selecao rotulo="Valor" valor={String(mapeamento.amount)} opcoes={opcoesDeColuna} aoMudar={(valor) => mudarColuna("amount", valor)} />
            </Bloco>
          ) : null}

          {lendo ? <p className="fraco">Lendo o arquivo…</p> : null}

          {previa.length > 0 ? (
            <Bloco className="secao">
              <span className="etiqueta">Prévia · as primeiras {Math.min(previa.length, 8)} linhas</span>
              <div className="lista">
                {previa.slice(0, 8).map((linha) => (
                  <div key={linha.line} className="linha">
                    <div className="texto" style={{ flex: 1 }}>
                      <span>{linha.description || "Sem descrição"}</span>
                      <span className="etiqueta" style={linha.error ? { color: "var(--neg)" } : undefined}>
                        {linha.error || (linha.date ? diaCompleto(linha.date) : "Sem data")}
                      </span>
                    </div>
                    {linha.cents === null ? null : <Dinheiro cents={linha.cents} />}
                  </div>
                ))}
              </div>
            </Bloco>
          ) : null}

          {arquivo && formato ? (
            <Bloco className="cartao">
              <Selecao
                rotulo="De qual conta é?"
                valor={contaId}
                vazio="Escolha a conta"
                opcoes={[...contas.map((conta) => ({ id: conta.id, texto: conta.name })), { id: NOVA, texto: "Nova conta…" }]}
                aoMudar={setContaId}
              />
              <AnimatePresence initial={false}>
                {contaId === NOVA ? (
                  <motion.div key="nova" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={curvaCheia} style={{ overflow: "hidden" }}>
                    <Campo rotulo="Nome da conta" icone={personOutline} maxLength={80} value={nomeDaConta} onMudar={setNomeDaConta} />
                  </motion.div>
                ) : null}
              </AnimatePresence>
              <motion.div whileTap={toqueDoDedo}>
                <IonButton expand="block" className="principal" disabled={salvando || semConta || lendo} onClick={() => void importar()}>
                  {salvando ? "Importando" : "Importar"}
                </IonButton>
              </motion.div>
            </Bloco>
          ) : null}
        </Cascata>
      </IonContent>
    </IonModal>
  );
}
