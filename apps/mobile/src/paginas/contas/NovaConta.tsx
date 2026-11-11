import { IonButton, IonToggle } from "@ionic/react";
import { ROTULO_DO_TIPO_DE_CONTA, TIPOS_DE_CONTA, lerReais, type Conta, type TipoDeConta } from "@finnagent/contracts";
import { cardOutline, walletOutline } from "ionicons/icons";
import { useState } from "react";
import { enviar } from "../../api/cliente";
import { Campo, CampoDeValor } from "../../componentes/Campo";
import { Data } from "../../componentes/Data";
import { Folha } from "../../componentes/Folha";
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
  // O campo só mostra o valor, sem sinal. O cartão é sempre dívida; a conta no vermelho se marca aqui.
  const [negativo, setNegativo] = useState(false);
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
    setNegativo(false);
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
    if (!data) return setErro("Escolha o dia do saldo.");
    if (cartao && limitCents === null && limite.trim()) return setErro("Informe o limite em reais.");
    for (const valor of [fecha, vence]) if (cartao && valor.trim() && !(Number(valor) >= 1 && Number(valor) <= 28)) return setErro("Fechamento e vencimento vão de 1 a 28.");
    setSalvando(true);
    setErro("");
    try {
      const corpo = {
        id: crypto.randomUUID(),
        name: name.trim(),
        kind,
        openingCents: cartao || negativo ? -Math.abs(openingCents) : Math.abs(openingCents),
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
    <Folha
      aberta={aberta}
      titulo="Nova conta"
      aoFechar={aoFechar}
      rodape={
        <>
          {erro ? <p className="erro">{erro}</p> : null}
          <IonButton expand="block" className="principal" disabled={salvando} onClick={() => void salvar()}>
            {salvando ? "Criando" : cartao ? "Criar cartão" : "Criar conta"}
          </IonButton>
        </>
      }
    >
      <p className="fraco">Comece com a conta como ela está hoje: só o que acontecer a partir da data conta no saldo.</p>
      <Campo icone={walletOutline} rotulo="Nome" value={name} onMudar={setName} placeholder="Nubank, Carteira, Cartão Itaú" maxLength={80} />
      <Selecao rotulo="Tipo" valor={kind} aoMudar={(valor) => setKind(valor as TipoDeConta)} opcoes={TIPOS_DE_CONTA.map((tipo) => ({ id: tipo, texto: ROTULO_DO_TIPO_DE_CONTA[tipo] }))} />
      <CampoDeValor rotulo={cartao ? "Fatura em aberto hoje" : "Saldo de hoje"} value={saldo} onMudar={setSaldo} />
      {cartao ? null : (
        <IonToggle checked={negativo} onIonChange={(evento) => setNegativo(evento.detail.checked)} labelPlacement="start" justify="space-between">
          Saldo negativo (conta no vermelho)
        </IonToggle>
      )}
      <Data rotulo="Saldo em" valor={data} aoMudar={setData} />
      {cartao ? (
        <>
          <Campo icone={cardOutline} rotulo="Fecha dia" value={fecha} onMudar={setFecha} inputMode="numeric" placeholder="25" maxLength={2} />
          <Campo icone={cardOutline} rotulo="Vence dia" value={vence} onMudar={setVence} inputMode="numeric" placeholder="5" maxLength={2} />
          <CampoDeValor rotulo="Limite" value={limite} onMudar={setLimite} />
        </>
      ) : null}
    </Folha>
  );
}
