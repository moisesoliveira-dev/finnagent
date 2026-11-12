import { IonButton, IonToggle, useIonViewWillEnter } from "@ionic/react";
import type { Caixinha, ContasResposta, Meta, MetasResposta } from "@finnagent/contracts";
import { flagOutline, pricetagOutline, trashOutline, walletOutline } from "ionicons/icons";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { enviar, ler, pedir } from "../api/cliente";
import { centavosDe, MESES, MESES_CURTOS, paraCampo, reais } from "../api/formato";
import { Campo, CampoDeValor } from "../componentes/Campo";
import { Dinheiro, Estado, Vazio } from "../componentes/Estado";
import { Folha } from "../componentes/Folha";
import { MenuDeAcoes } from "../componentes/MenuDeAcoes";
import { ItemOrdenavel, ListaOrdenavel } from "../componentes/Ordenavel";
import { Pagina } from "../componentes/Pagina";
import { Selecao } from "../componentes/Selecao";
import { Bloco, Cascata, Contagem, Preenchimento, toqueDoDedo } from "../movimento";
import { useAcao } from "../useAcao";
import { useDados } from "../useDados";

const porcentoDe = (meta: Meta) => (meta.targetCents > 0 ? Math.min(100, Math.round((meta.savedCents / meta.targetCents) * 100)) : 0);

/** Quantos meses faltam para o prazo, contando o atual. Zero ou negativo: o prazo já passou. */
function mesesAte(meta: Meta) {
  if (!meta.dueYear || !meta.dueMonth) return null;
  const hoje = new Date();
  return meta.dueYear * 12 + meta.dueMonth - (hoje.getFullYear() * 12 + hoje.getMonth() + 1) + 1;
}

type NovaMeta = { name: string; target: string; saved: string; comPrazo: boolean; dueMonth: string; dueYear: string };

/** As metas pela prioridade: criar, separar, dividir a sobra, reordenar, ligar a caixinha e excluir. */
export function Metas() {
  const { dados, erro, carregando, recarregar } = useDados<MetasResposta>("/api/metas");
  const { ocupado, agir, confirmar } = useAcao();
  const [nova, setNova] = useState<NovaMeta | null>(null);
  const [separando, setSeparando] = useState<{ meta: Meta; valor: string } | null>(null);
  const [divisao, setDivisao] = useState<Record<string, string> | null>(null);
  const [caixinha, setCaixinha] = useState<{ meta: Meta; opcoes: Array<Caixinha & { accountName: string }>; escolha: string } | null>(null);
  const [erroDaFolha, setErroDaFolha] = useState("");
  const metas = [...(dados?.goals ?? [])].sort((a, b) => a.position - b.position);
  // A ordem que a pessoa está arrastando. O servidor devolve a gravada, e ela volta a valer a cada carga.
  const [ordem, setOrdem] = useState<string[]>([]);
  const ordemRef = useRef<string[]>([]);
  ordemRef.current = ordem;
  useEffect(() => setOrdem(metas.map((meta) => meta.id)), [dados]); // eslint-disable-line react-hooks/exhaustive-deps
  const lista = ordem.length === metas.length && ordem.every((id) => metas.some((meta) => meta.id === id)) ? ordem.map((id) => metas.find((meta) => meta.id === id) as Meta) : metas;

  useIonViewWillEnter(() => {
    if (dados) void recarregar();
  });

  async function fazer(chave: string, acao: () => Promise<unknown>, sucesso: string) {
    const ok = await agir(chave, acao, sucesso);
    if (ok) await recarregar();
    return ok;
  }

  async function criar() {
    if (!nova || !dados) return;
    const targetCents = centavosDe(nova.target);
    const savedCents = nova.saved.trim() ? centavosDe(nova.saved) : 0;
    if (!nova.name.trim()) return setErroDaFolha("Dê um nome à meta.");
    if (!targetCents) return setErroDaFolha("Informe quanto quer juntar.");
    if (savedCents === null) return setErroDaFolha("Informe o que já tem em reais.");
    const mes = Number(nova.dueMonth);
    const ano = Number(nova.dueYear);
    if (nova.comPrazo && (!(mes >= 1 && mes <= 12) || !(ano >= 2000 && ano <= 2100))) return setErroDaFolha("Informe o mês e o ano do prazo.");
    setErroDaFolha("");
    const corpo = { id: crypto.randomUUID(), name: nova.name.trim(), targetCents, savedCents, dueYear: nova.comPrazo ? ano : null, dueMonth: nova.comPrazo ? mes : null };
    if (await fazer("criar", () => enviar("/api/metas", corpo), "Meta salva.")) setNova(null);
  }

  /** Grava a ordem das metas. Se o servidor recusar, a lista volta à ordem gravada. */
  function gravarOrdem(ids: string[]) {
    void fazer("ordem", () => enviar("/api/metas/ordem", { ids }, "PUT"), "Prioridade salva.").then((ok) => {
      if (!ok) setOrdem(metas.map((meta) => meta.id));
    });
  }

  // O dedo soltou a meta: a ordem arrastada vale.
  const soltarMeta = () => gravarOrdem(ordemRef.current);

  // As setas do teclado na alça movem uma posição.
  function moverMeta(id: string, passo: -1 | 1) {
    const ids = [...ordemRef.current];
    const de = ids.indexOf(id);
    const para = de + passo;
    if (de < 0 || para < 0 || para >= ids.length) return;
    [ids[de], ids[para]] = [ids[para] as string, ids[de] as string];
    ordemRef.current = ids;
    setOrdem(ids);
    gravarOrdem(ids);
  }

  function abrirDivisao() {
    if (!dados) return;
    setErroDaFolha("");
    setDivisao(Object.fromEntries(metas.map((meta) => [meta.id, String(dados.division[meta.id]?.percent ?? 0)])));
  }

  const percentualDe = (id: string) => {
    const numero = Number(divisao?.[id] ?? 0);
    return Number.isFinite(numero) ? Math.min(Math.max(Math.round(numero), 0), 100) : 0;
  };
  const somaDaDivisao = metas.reduce((soma, meta) => soma + (dados?.division[meta.id]?.approved ? (dados.division[meta.id]?.percent ?? 0) : percentualDe(meta.id)), 0);

  async function salvarDivisao() {
    if (!dados) return;
    if (somaDaDivisao > 100) return setErroDaFolha("A soma das porcentagens passa de 100%.");
    const percents = Object.fromEntries(metas.filter((meta) => !dados.division[meta.id]?.approved).map((meta) => [meta.id, percentualDe(meta.id)]));
    if (await fazer("divisao", () => enviar("/api/metas/divisao", { percents }, "PUT"), "Divisão salva. Aprove cada parte para separar.")) setDivisao(null);
  }

  async function abrirCaixinha(meta: Meta) {
    try {
      const resposta = await ler<ContasResposta>("/api/contas");
      const nomes = new Map(resposta.accounts.map((conta) => [conta.id, conta.name]));
      // Cada caixinha guarda uma meta só: a que já guarda outra não aparece.
      const opcoes = resposta.boxes.filter((item) => !item.goalId || item.goalId === meta.id).map((item) => ({ ...item, accountName: nomes.get(item.accountId) ?? "" }));
      setCaixinha({ meta, opcoes, escolha: meta.box?.id ?? "" });
    } catch (error) {
      void agir("caixinha", () => Promise.reject(error));
    }
  }

  function excluir(meta: Meta) {
    const texto = `A sessão da meta sai de Finanças, e o que foi separado para ela volta para a sobra.${meta.box ? ` A caixinha ${meta.box.name} continua na conta, sem a meta.` : ""}`;
    confirmar(`Excluir "${meta.name}"?`, texto, "Excluir", () => void fazer("excluir", () => pedir(`/api/metas/${meta.id}`, { method: "DELETE" }), "Meta excluída."));
  }

  const hoje = new Date();

  return (
    <Pagina
      titulo="Metas"
      etiqueta="Pela ordem de prioridade"
      aoAtualizar={recarregar}
      acao={{
        rotulo: "Nova meta",
        aoTocar: () => {
          setErroDaFolha("");
          setNova({ name: "", target: "", saved: "", comPrazo: false, dueMonth: String(hoje.getMonth() + 1), dueYear: String(hoje.getFullYear() + 1) });
        },
      }}
    >
      <Estado carregando={carregando} erro={erro} tem={Boolean(dados)} aoTentar={() => void recarregar()} />

      {dados ? (
        <Cascata className="pagina">
          <Bloco className="cartao destaque">
            <span className="etiqueta">Sobra para as metas</span>
            <span className="numero grande">
              <Dinheiro cents={dados.surplusCents} animado />
            </span>
            {/* A sobra das metas soma a deste mês com o que veio dos meses anteriores: separar os dois explica o número. */}
            <span className="fraco">
              Deste mês: {reais(dados.monthSurplusCents)} · dos meses anteriores: {reais(dados.carriedCents)}
            </span>
            <span className="fraco">
              Já separado neste mês: <Contagem valor={dados.separatedCents} formatar={reais} />
            </span>
            {metas.length > 0 ? (
              <IonButton fill="outline" size="small" style={{ justifySelf: "start" }} onClick={abrirDivisao}>
                Dividir a sobra
              </IonButton>
            ) : null}
          </Bloco>

          {metas.length === 0 ? (
            <Bloco>
              <Vazio icone={flagOutline} titulo="Nenhuma meta ainda" texto="Toque em + para dizer o que você quer juntar e até quando." />
            </Bloco>
          ) : null}

          {metas.length > 1 ? <p className="fraco">Segure a alça ao lado do número e arraste para mudar a prioridade.</p> : null}
          <ListaOrdenavel itens={ordem} aoMudar={setOrdem} className="pagina sem-margem">
          {lista.map((meta, indice) => {
            const parte = dados.division[meta.id];
            const pendente = parte && !parte.approved;
            const porcento = porcentoDe(meta);
            const restante = Math.max(0, meta.targetCents - meta.savedCents);
            const meses = mesesAte(meta);
            const porMes = meses && meses > 0 && restante > 0 ? Math.ceil(restante / meses) : null;
            const sugerido = dados.suggested[meta.id] ?? 0;
            return (
              <ItemOrdenavel key={meta.id} valor={meta.id} nome={meta.name} aoSoltar={soltarMeta} aoMover={(passo) => moverMeta(meta.id, passo)} className="cartao ordenavel">
                {(alca) => (
                <>
                <div className="linha-da-meta">
                  {alca}
                  <span className="posicao" aria-label={`Prioridade ${indice + 1}`}>
                    {indice + 1}
                  </span>
                  <div className="texto" style={{ flex: 1 }}>
                    <strong>{meta.name}</strong>
                    <span className="etiqueta">
                      {meta.dueMonth && meta.dueYear ? `Até ${MESES_CURTOS[meta.dueMonth - 1]}/${meta.dueYear}` : "Sem prazo"}
                      {meta.box ? ` · caixinha ${meta.box.name}` : ""}
                    </span>
                  </div>
                  <Contagem valor={porcento} formatar={(valor) => `${valor}%`} className="numero" />
                </div>
                <div className="barra" role="progressbar" aria-valuenow={porcento} aria-valuemin={0} aria-valuemax={100} aria-label={`${meta.name}: ${porcento}%`}>
                  <Preenchimento porcento={porcento} atraso={indice * 0.1} />
                </div>
                <div className="grade">
                  <div className="secao" style={{ gap: 4 }}>
                    <span className="etiqueta">Juntado</span>
                    <span>{reais(meta.savedCents)}</span>
                  </div>
                  <div className="secao" style={{ gap: 4 }}>
                    <span className="etiqueta">Falta</span>
                    <span>{reais(restante)}</span>
                  </div>
                </div>
                {porMes ? (
                  <span className="fraco">
                    Para chegar no prazo: cerca de <strong style={{ color: "var(--ink)" }}>{reais(porMes)}</strong> por mês.
                  </span>
                ) : meses !== null && meses <= 0 && restante > 0 ? (
                  <span className="fraco">O prazo já passou.</span>
                ) : null}
                <AnimatePresence initial={false}>
                  {pendente ? (
                    <motion.div key="pendente" className="aviso" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} style={{ overflow: "hidden" }}>
                      <p style={{ margin: "0 0 8px" }}>
                        {parte.percent}% da sobra deste mês ({reais(parte.cents)}) esperam a sua aprovação.
                      </p>
                      <motion.div whileTap={toqueDoDedo} style={{ display: "inline-block" }}>
                        <IonButton
                          size="small"
                          className="principal"
                          disabled={Boolean(ocupado)}
                          onClick={() => void fazer(`aprovar-${meta.id}`, () => enviar(`/api/metas/${meta.id}/aprovar`, {}), "Valor aprovado e separado.")}
                        >
                          Aprovar
                        </IonButton>
                      </motion.div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
                <div className="acoes-da-folha acoes-com-menu">
                  {restante > 0 ? (
                    <IonButton size="small" fill="outline" disabled={Boolean(ocupado)} onClick={() => setSeparando({ meta, valor: sugerido > 0 ? paraCampo(sugerido) : "" })}>
                      Separar
                    </IonButton>
                  ) : null}
                  <MenuDeAcoes
                    titulo={meta.name}
                    rotulo={`Mais ações de ${meta.name}`}
                    desabilitado={Boolean(ocupado)}
                    acoes={[
                      { texto: meta.box ? "Trocar a caixinha" : "Ligar a uma caixinha", icone: walletOutline, aoEscolher: () => void abrirCaixinha(meta) },
                      { texto: "Excluir a meta", icone: trashOutline, perigo: true, aoEscolher: () => excluir(meta) },
                    ]}
                  />
                </div>
                </>
                )}
              </ItemOrdenavel>
            );
          })}
          </ListaOrdenavel>
        </Cascata>
      ) : null}

      <Folha
        aberta={nova !== null}
        titulo="Nova meta"
        aoFechar={() => setNova(null)}
        rodape={
          nova ? (
            <>
              {erroDaFolha ? <p className="erro">{erroDaFolha}</p> : null}
              <IonButton expand="block" className="principal" disabled={Boolean(ocupado)} onClick={() => void criar()}>
                Criar meta
              </IonButton>
            </>
          ) : undefined
        }
      >
        {nova ? (
          <>
            <Campo icone={pricetagOutline} rotulo="Nome" value={nova.name} onMudar={(name) => setNova({ ...nova, name })} placeholder="Viagem, reserva, carro" maxLength={80} />
            <CampoDeValor rotulo="Quanto quer juntar" value={nova.target} onMudar={(target) => setNova({ ...nova, target })} />
            <CampoDeValor rotulo="Quanto já tem" value={nova.saved} onMudar={(saved) => setNova({ ...nova, saved })} />
            <IonToggle checked={nova.comPrazo} onIonChange={(evento) => setNova({ ...nova, comPrazo: evento.detail.checked })} labelPlacement="start" justify="space-between">
              Com prazo
            </IonToggle>
            {nova.comPrazo ? (
              <div className="grade">
                <Selecao rotulo="Mês" valor={nova.dueMonth} opcoes={MESES.map((nome, indice) => ({ id: String(indice + 1), texto: nome }))} aoMudar={(dueMonth) => setNova({ ...nova, dueMonth })} />
                <Campo icone={flagOutline} rotulo="Ano" value={nova.dueYear} onMudar={(dueYear) => setNova({ ...nova, dueYear })} inputMode="numeric" maxLength={4} />
              </div>
            ) : null}
          </>
        ) : null}
      </Folha>

      <Folha aberta={separando !== null} titulo={separando ? `Separar para ${separando.meta.name}` : ""} aoFechar={() => setSeparando(null)}>
        {separando ? (
          <>
            <p className="fraco">O valor sai da sobra deste mês e vai para a sessão da meta{separando.meta.box ? ` e para a caixinha ${separando.meta.box.name}` : ""}.</p>
            <CampoDeValor rotulo="Valor" value={separando.valor} onMudar={(valor) => setSeparando({ ...separando, valor })} />
            <IonButton
              expand="block"
              className="principal"
              disabled={Boolean(ocupado)}
              onClick={() => {
                const cents = centavosDe(separando.valor);
                if (!cents) return;
                void fazer("separar", () => enviar(`/api/metas/${separando.meta.id}/separar`, { cents }), "Valor separado.").then((ok) => ok && setSeparando(null));
              }}
            >
              Separar
            </IonButton>
          </>
        ) : null}
      </Folha>

      <Folha aberta={divisao !== null} titulo="Dividir a sobra" aoFechar={() => setDivisao(null)}>
        {divisao && dados ? (
          <>
            <p className="fraco">Quanto da sobra deste mês ({reais(dados.monthSurplusCents)}) vai para cada meta. Cada parte espera a sua aprovação para ser separada.</p>
            {metas.map((meta) => {
              const aprovada = dados.division[meta.id]?.approved;
              return (
                <Campo
                  key={meta.id}
                  icone={flagOutline}
                  rotulo={`${meta.name} (%)${aprovada ? " · aprovada" : ""}`}
                  value={divisao[meta.id] ?? "0"}
                  onMudar={(valor) => setDivisao({ ...divisao, [meta.id]: valor.replace(/\D/g, "").slice(0, 3) })}
                  inputMode="numeric"
                  maxLength={3}
                  disabled={aprovada}
                />
              );
            })}
            <p className={somaDaDivisao > 100 ? "erro" : "fraco"}>Somando: {somaDaDivisao}%</p>
            {erroDaFolha ? <p className="erro">{erroDaFolha}</p> : null}
            <IonButton expand="block" className="principal" disabled={Boolean(ocupado)} onClick={() => void salvarDivisao()}>
              Salvar a divisão
            </IonButton>
          </>
        ) : null}
      </Folha>

      <Folha aberta={caixinha !== null} titulo="Caixinha da meta" aoFechar={() => setCaixinha(null)}>
        {caixinha ? (
          <>
            <p className="fraco">O saldo da caixinha soma no que a meta já juntou, e o que a meta separa vai para ela.</p>
            {caixinha.opcoes.length === 0 ? <p className="fraco">Nenhuma caixinha livre. Crie uma no detalhe da conta, em Finanças, Contas.</p> : null}
            <Selecao
              rotulo="Caixinha"
              valor={caixinha.escolha}
              vazio="Sem caixinha"
              opcoes={caixinha.opcoes.map((item) => ({ id: item.id, texto: `${item.name} · ${item.accountName}` }))}
              aoMudar={(escolha) => setCaixinha({ ...caixinha, escolha })}
            />
            <IonButton
              expand="block"
              className="principal"
              disabled={Boolean(ocupado)}
              onClick={() =>
                void fazer(
                  "caixinha",
                  () => enviar(`/api/metas/${caixinha.meta.id}/caixinha`, { boxId: caixinha.escolha || null }, "PUT"),
                  caixinha.escolha ? "A meta passa a guardar na caixinha." : "A meta saiu da caixinha.",
                ).then((ok) => ok && setCaixinha(null))
              }
            >
              Salvar
            </IonButton>
          </>
        ) : null}
      </Folha>
    </Pagina>
  );
}
