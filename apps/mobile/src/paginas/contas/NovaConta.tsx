import { IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonModal, IonTitle, IonToolbar } from "@ionic/react";
import { ROTULO_DO_TIPO_DE_CONTA, TIPOS_DE_CONTA, lerReais, type Conta, type TipoDeConta } from "@finnagent/contracts";
import { calendarOutline, cardOutline, cashOutline, closeOutline, walletOutline } from "ionicons/icons";
import { useState } from "react";
import { enviar } from "../../api/cliente";
import { Campo } from "../../componentes/Campo";
import { Selecao } from "../../componentes/Selecao";
import { hojeIso } from "./movimentos";

/** O saldo digitado em centavos, com sinal (a conta pode estar no vermelho). Vazio é zero; null quando não é número. */
function saldoDe(texto: string) {
  return texto.trim() ? lerReais(texto) : 0;
}

/** Cria uma conta ou um cartão pelo celular: nome, tipo, saldo de hoje e, no cartão, fechamento, vencimento e limite. */
export function NovaConta({ aberta, aoFechar, aoCriada }: { aberta: boolean; aoFechar: () => void; aoCriada: (conta: Conta) => void }) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<TipoDeConta>("conta");
  const [saldo, setSaldo] = useState("");
  const [data, setData] = useState(hojeIso());
  const [fecha, setFecha] = useState("");
  const [vence, setVence] = useState("");
  const [limite, setLimite] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const cartao = kind === "cartao";

  function limpar() {
    setName("");
    setKind("conta");
    setSaldo("");
    setData(hojeIso());
    setFecha("");
    setVence("");
    setLimite("");
    setErro("");
  }

  async function salvar() {
    if (salvando) return;
    const openingCents = saldoDe(saldo);
    const limitCents = cartao && limite.trim() ? lerReais(limite) : null;
    const dia = (texto: string) => (texto.trim() ? Number(texto) : null);
    if (!name.trim()) return setErro("Dê um nome à conta.");
    if (openingCents === null) return setErro("Informe o saldo de hoje em reais.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return setErro("A data fica como AAAA-MM-DD.");
    if (cartao && limitCents === null && limite.trim()) return setErro("Informe o limite em reais.");
    for (const valor of [fecha, vence]) if (cartao && valor.trim() && !(Number(valor) >= 1 && Number(valor) <= 28)) return setErro("Fechamento e vencimento vão de 1 a 28.");
    setSalvando(true);
    setErro("");
    try {
      const corpo = {
        id: crypto.randomUUID(),
        name: name.trim(),
        kind,
        openingCents: cartao ? -Math.abs(openingCents) : openingCents,
        openingOn: data,
        closingDay: cartao ? dia(fecha) : null,
        dueDay: cartao ? dia(vence) : null,
        limitCents: cartao ? limitCents : null,
      };
      const criada = await enviar<Conta>("/api/contas", corpo);
      limpar();
      aoCriada(criada);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível criar a conta.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <IonModal isOpen={aberta} onDidDismiss={aoFechar}>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Nova conta</IonTitle>
          <IonButtons slot="end">
            <IonButton aria-label="Fechar" onClick={aoFechar}>
              <IonIcon slot="icon-only" icon={closeOutline} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <div className="pagina">
          <p className="fraco">Comece com a conta como ela está hoje: só o que acontecer a partir da data conta no saldo.</p>
          <Campo icone={walletOutline} rotulo="Nome" value={name} onMudar={setName} placeholder="Nubank, Carteira, Cartão Itaú" maxLength={80} />
          <Selecao rotulo="Tipo" valor={kind} aoMudar={(valor) => setKind(valor as TipoDeConta)} opcoes={TIPOS_DE_CONTA.map((tipo) => ({ id: tipo, texto: ROTULO_DO_TIPO_DE_CONTA[tipo] }))} />
          <Campo icone={cashOutline} rotulo={cartao ? "Fatura em aberto hoje" : "Saldo de hoje"} value={saldo} onMudar={setSaldo} inputMode="decimal" placeholder="0,00" />
          <Campo icone={calendarOutline} rotulo="Saldo em" value={data} onMudar={setData} inputMode="numeric" placeholder="AAAA-MM-DD" maxLength={10} />
          {cartao ? (
            <>
              <Campo icone={cardOutline} rotulo="Fecha dia" value={fecha} onMudar={setFecha} inputMode="numeric" placeholder="25" maxLength={2} />
              <Campo icone={cardOutline} rotulo="Vence dia" value={vence} onMudar={setVence} inputMode="numeric" placeholder="5" maxLength={2} />
              <Campo icone={cashOutline} rotulo="Limite" value={limite} onMudar={setLimite} inputMode="decimal" placeholder="0,00" />
            </>
          ) : null}
          {erro ? <p className="erro">{erro}</p> : null}
          <IonButton expand="block" disabled={salvando} onClick={() => void salvar()}>
            {salvando ? "Criando" : cartao ? "Criar cartão" : "Criar conta"}
          </IonButton>
        </div>
      </IonContent>
    </IonModal>
  );
}
