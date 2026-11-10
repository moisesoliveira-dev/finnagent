import { IonButton, IonIcon, IonToggle, useIonViewWillEnter } from "@ionic/react";
import {
  CRIATIVIDADES,
  INFO_DA_LEITURA,
  INFO_DOS_AGENTES,
  INFO_DOS_PROVEDORES,
  LIMITE_INSTRUCOES_IA,
  PASSOS_DO_ASSISTENTE,
  PROVEDORES_IA,
  RETENCOES_DO_CHAT,
  type ConfiguracaoDeIa as DadosDeIa,
  type ConfiguracaoDoAssistente,
  type Criatividade,
  type EscolhaDeModelo,
  type PassosDoAssistente,
  type ProvedorConfigurado,
  type ProvedorIa,
  type ResultadoDoTeste,
  type RetencaoDoChat,
} from "@finnagent/contracts";
import { addOutline, arrowBack, chevronForward, globeOutline, pricetagOutline, sparklesOutline } from "ionicons/icons";
import { useEffect, useState } from "react";
import { enviar, pedir } from "../../api/cliente";
import { AreaDeTexto, Campo, CampoDeSenha } from "../../componentes/Campo";
import { Estado } from "../../componentes/Estado";
import { Folha } from "../../componentes/Folha";
import { Pagina } from "../../componentes/Pagina";
import { Fichas, Selecao } from "../../componentes/Selecao";
import { useAcao } from "../../useAcao";
import { useDados } from "../../useDados";

const ROTULO_DA_CRIATIVIDADE: Record<Criatividade, string> = { precisa: "Precisa", equilibrada: "Equilibrada", criativa: "Criativa" };
const ROTULO_DA_RETENCAO: Record<RetencaoDoChat, string> = { "30d": "30 dias", "90d": "90 dias", "1a": "1 ano", sempre: "Sem limite" };

/** "id do provedor|modelo": a escolha vira uma opção só na lista. */
const chaveDa = (escolha: EscolhaDeModelo | null | undefined) => (escolha ? `${escolha.providerId}|${escolha.model}` : "");
const escolhaDe = (chave: string): EscolhaDeModelo | null => {
  const [providerId, ...resto] = chave.split("|");
  return providerId && resto.length ? { providerId, model: resto.join("|") } : null;
};

/** Provedores de IA, os modelos de cada função e o comportamento do assistente. Os mesmos do web. */
export function ConfiguracaoDeIa() {
  const { dados, erro, carregando, recarregar } = useDados<DadosDeIa>("/api/ia/configuracao");
  const { ocupado, agir, confirmar } = useAcao();
  const [rascunho, setRascunho] = useState<ConfiguracaoDoAssistente | null>(null);
  const [provedor, setProvedor] = useState<ProvedorConfigurado | "novo" | null>(null);
  const travado = !dados?.podeEditar;

  useIonViewWillEnter(() => {
    if (dados) void recarregar();
  });
  useEffect(() => {
    if (dados) setRascunho(dados.assistente);
  }, [dados]);

  const sujo = Boolean(dados && rascunho && JSON.stringify(rascunho) !== JSON.stringify(dados.assistente));
  const opcoesDeModelo = (dados?.provedores ?? []).flatMap((item) => item.models.map((model) => ({ id: chaveDa({ providerId: item.id, model }), texto: `${item.label} · ${model}` })));

  async function salvarAssistente() {
    if (!rascunho) return;
    if (await agir("assistente", () => enviar("/api/ia/assistente", rascunho, "PUT"), "Assistente salvo.")) await recarregar();
  }

  function escolher(funcao: "coordenador" | "leitor", chave: string) {
    if (!rascunho) return;
    const funcoes = { ...rascunho.funcoes };
    const escolha = escolhaDe(chave);
    if (escolha) funcoes[funcao] = escolha;
    else delete funcoes[funcao];
    setRascunho({ ...rascunho, funcoes });
  }

  return (
    <Pagina
      titulo="Inteligência artificial"
      etiqueta="Provedores e assistente"
      aoAtualizar={recarregar}
      semPerfil
      fim={
        <IonButton routerLink="/configuracoes" routerDirection="back" aria-label="Voltar">
          <IonIcon slot="icon-only" icon={arrowBack} />
        </IonButton>
      }
    >
      <div className="pagina">
        <Estado carregando={carregando} erro={erro} tem={Boolean(dados)} aoTentar={() => void recarregar()} />
        {travado && dados ? <p className="aviso">Só o usuário master muda os provedores e o assistente.</p> : null}

        {dados && rascunho ? (
          <>
            <section className="secao">
              <div className="titulo-do-dia">
                <h2 className="etiqueta">Provedores</h2>
                {travado ? null : (
                  <IonButton size="small" fill="clear" onClick={() => setProvedor("novo")}>
                    <IonIcon slot="start" icon={addOutline} />
                    Provedor
                  </IonButton>
                )}
              </div>
              <div className="lista">
                {dados.provedores.length === 0 ? <div className="linha fraco">Nenhum provedor. Adicione um com a chave da API para o assistente funcionar.</div> : null}
                {dados.provedores.map((item) => (
                  <button key={item.id} type="button" className="linha linha-botao" disabled={travado} onClick={() => setProvedor(item)}>
                    <span className="texto" style={{ flex: 1 }}>
                      <span>{item.label}</span>
                      <span className="etiqueta">
                        {INFO_DOS_PROVEDORES[item.kind].nome} · {item.models.length === 1 ? "1 modelo" : `${item.models.length} modelos`}
                        {item.hasKey ? " · chave salva" : ""}
                      </span>
                    </span>
                    <IonIcon icon={chevronForward} aria-hidden />
                  </button>
                ))}
              </div>
            </section>

            <section className="cartao secao">
              <h2 className="etiqueta">Modelos</h2>
              <Selecao
                rotulo="Modelo padrão"
                valor={chaveDa(rascunho.padrao)}
                vazio="Nenhum"
                opcoes={opcoesDeModelo}
                desabilitado={travado}
                aoMudar={(chave) => setRascunho({ ...rascunho, padrao: escolhaDe(chave) })}
              />
              <Selecao
                rotulo={`${INFO_DOS_AGENTES.coordenador.nome}: ${INFO_DOS_AGENTES.coordenador.resumo}`}
                valor={chaveDa(rascunho.funcoes.coordenador)}
                vazio={`Usar o padrão${rascunho.padrao ? ` (${rascunho.padrao.model})` : ""}`}
                opcoes={opcoesDeModelo}
                desabilitado={travado}
                aoMudar={(chave) => escolher("coordenador", chave)}
              />
              <Selecao
                rotulo={`${INFO_DA_LEITURA.nome}: ${INFO_DA_LEITURA.resumo}`}
                valor={chaveDa(rascunho.funcoes.leitor)}
                vazio={`Usar o padrão${rascunho.padrao ? ` (${rascunho.padrao.model})` : ""}`}
                opcoes={opcoesDeModelo.filter((opcao) => {
                  const dono = dados.provedores.find((item) => item.id === escolhaDe(opcao.id)?.providerId);
                  return dono ? INFO_DOS_PROVEDORES[dono.kind].leExtratos : false;
                })}
                desabilitado={travado}
                aoMudar={(chave) => escolher("leitor", chave)}
              />
            </section>

            <section className="cartao secao">
              <h2 className="etiqueta">Comportamento</h2>
              <IonToggle
                checked={rascunho.comportamento.confirmarExclusao}
                disabled={travado}
                onIonChange={(evento) => setRascunho({ ...rascunho, comportamento: { ...rascunho.comportamento, confirmarExclusao: evento.detail.checked } })}
                labelPlacement="start"
                justify="space-between"
              >
                Pedir confirmação antes de apagar
              </IonToggle>
              <div className="campo">
                <span className="etiqueta">Passos por pedido</span>
                <Fichas<string>
                  rotulo="Passos por pedido"
                  valor={String(rascunho.comportamento.maxPassos)}
                  opcoes={PASSOS_DO_ASSISTENTE.map((passos) => ({ id: String(passos), texto: String(passos) }))}
                  aoMudar={(valor) => !travado && setRascunho({ ...rascunho, comportamento: { ...rascunho.comportamento, maxPassos: Number(valor) as PassosDoAssistente } })}
                />
              </div>
              <div className="campo">
                <span className="etiqueta">Criatividade</span>
                <Fichas<Criatividade>
                  rotulo="Criatividade"
                  valor={rascunho.comportamento.criatividade}
                  opcoes={CRIATIVIDADES.map((item) => ({ id: item, texto: ROTULO_DA_CRIATIVIDADE[item] }))}
                  aoMudar={(valor) => !travado && setRascunho({ ...rascunho, comportamento: { ...rascunho.comportamento, criatividade: valor } })}
                />
              </div>
              <Selecao
                rotulo="Guardar as conversas por"
                valor={rascunho.comportamento.retencao}
                opcoes={RETENCOES_DO_CHAT.map((item) => ({ id: item, texto: ROTULO_DA_RETENCAO[item] }))}
                desabilitado={travado}
                aoMudar={(valor) => setRascunho({ ...rascunho, comportamento: { ...rascunho.comportamento, retencao: valor as RetencaoDoChat } })}
              />
              <AreaDeTexto
                rotulo="Instruções para o assistente"
                value={rascunho.comportamento.instrucoes}
                onMudar={(instrucoes) => setRascunho({ ...rascunho, comportamento: { ...rascunho.comportamento, instrucoes } })}
                linhas={4}
                maxLength={LIMITE_INSTRUCOES_IA}
                disabled={travado}
              />
            </section>

            {travado ? null : (
              <IonButton expand="block" className="principal" disabled={Boolean(ocupado) || !sujo} onClick={() => void salvarAssistente()}>
                {sujo ? "Salvar o assistente" : "Nada para salvar"}
              </IonButton>
            )}

            <IonButton
              expand="block"
              fill="clear"
              color="danger"
              disabled={Boolean(ocupado)}
              onClick={() =>
                confirmar("Apagar todas as suas conversas?", "As conversas com o assistente somem. O que ele já fez no sistema continua feito.", "Apagar", () =>
                  void agir("conversas", () => pedir("/api/assistente/conversas", { method: "DELETE" }), "Conversas apagadas."),
                )
              }
            >
              Apagar todas as minhas conversas
            </IonButton>
          </>
        ) : null}
      </div>

      <Folha aberta={provedor !== null} titulo={provedor === "novo" ? "Novo provedor" : (provedor?.label ?? "")} aoFechar={() => setProvedor(null)}>
        {provedor ? (
          <FormProvedor
            key={provedor === "novo" ? "novo" : provedor.id}
            provedor={provedor === "novo" ? null : provedor}
            aoPronto={async () => {
              setProvedor(null);
              await recarregar();
            }}
          />
        ) : null}
      </Folha>
    </Pagina>
  );
}

/** Um provedor: tipo, nome, chave, URL quando precisa, e os modelos. O teste lista os modelos que a chave enxerga. */
function FormProvedor({ provedor, aoPronto }: { provedor: ProvedorConfigurado | null; aoPronto: () => Promise<void> }) {
  const { ocupado, agir, confirmar } = useAcao();
  const [kind, setKind] = useState<ProvedorIa>(provedor?.kind ?? "openai");
  const [label, setLabel] = useState(provedor?.label ?? INFO_DOS_PROVEDORES.openai.nome);
  const [apiKey, setApiKey] = useState("");
  const [limparChave, setLimparChave] = useState(false);
  const [baseUrl, setBaseUrl] = useState(provedor?.baseUrl || INFO_DOS_PROVEDORES[provedor?.kind ?? "openai"].urlPadrao);
  const [modelos, setModelos] = useState<string[]>(provedor?.models ?? []);
  const [novoModelo, setNovoModelo] = useState("");
  const [teste, setTeste] = useState<ResultadoDoTeste | null>(null);
  const [erro, setErro] = useState("");
  const info = INFO_DOS_PROVEDORES[kind];
  const temChaveSalva = Boolean(provedor?.hasKey) && !limparChave;

  function mudarTipo(novo: ProvedorIa) {
    if (!label || label === INFO_DOS_PROVEDORES[kind].nome) setLabel(INFO_DOS_PROVEDORES[novo].nome);
    if (!baseUrl || baseUrl === INFO_DOS_PROVEDORES[kind].urlPadrao) setBaseUrl(INFO_DOS_PROVEDORES[novo].urlPadrao);
    setKind(novo);
    setTeste(null);
  }

  const adicionar = (modelo: string) => {
    const nome = modelo.trim();
    if (nome && !modelos.includes(nome)) setModelos([...modelos, nome]);
  };

  async function testar() {
    setErro("");
    await agir("testar", async () => {
      const resultado = await enviar<ResultadoDoTeste>("/api/ia/provedores/testar", {
        kind,
        apiKey: limparChave ? "" : apiKey,
        baseUrl: info.precisaUrl ? baseUrl : "",
        providerId: limparChave ? null : (provedor?.id ?? null),
      });
      setTeste(resultado);
    });
  }

  async function salvar() {
    if (!label.trim()) return setErro("Dê um nome ao provedor.");
    if (info.precisaChave && kind !== "openai_compativel" && !apiKey && !temChaveSalva) return setErro("Informe a chave da API.");
    if (info.precisaUrl && !baseUrl.trim()) return setErro("Informe a URL do provedor.");
    setErro("");
    const pedido = { kind, label: label.trim(), apiKey, limparChave, baseUrl: info.precisaUrl ? baseUrl.trim() : "", models: modelos };
    const ok = await agir("salvar", () => (provedor ? enviar(`/api/ia/provedores/${provedor.id}`, pedido, "PATCH") : enviar("/api/ia/provedores", pedido)), "Provedor salvo.");
    if (ok) await aoPronto();
  }

  return (
    <>
      <Selecao rotulo="Tipo" valor={kind} opcoes={PROVEDORES_IA.map((item) => ({ id: item, texto: INFO_DOS_PROVEDORES[item].nome }))} aoMudar={(valor) => mudarTipo(valor as ProvedorIa)} desabilitado={Boolean(provedor)} />
      <p className="fraco">{info.descricao}</p>
      <Campo icone={pricetagOutline} rotulo="Nome" value={label} onMudar={setLabel} maxLength={60} />
      {info.precisaChave || kind === "openai_compativel" ? (
        <>
          <CampoDeSenha
            rotulo={temChaveSalva ? "Chave da API (já salva; vazio mantém)" : "Chave da API"}
            value={apiKey}
            onMudar={(valor) => {
              setApiKey(valor);
              setLimparChave(false);
            }}
            autoComplete="off"
          />
          <span className="fraco">{info.dicaDaChave}</span>
          {provedor?.hasKey && !limparChave ? (
            <IonButton size="small" fill="clear" color="danger" style={{ justifySelf: "start" }} onClick={() => (setApiKey(""), setLimparChave(true))}>
              Remover a chave salva
            </IonButton>
          ) : null}
        </>
      ) : null}
      {info.precisaUrl ? <Campo icone={globeOutline} rotulo="URL" value={baseUrl} onMudar={setBaseUrl} autoCapitalize="none" inputMode="url" type="url" /> : null}

      <IonButton fill="outline" disabled={Boolean(ocupado)} onClick={() => void testar()}>
        {ocupado === "testar" ? "Testando" : "Testar e listar os modelos"}
      </IonButton>
      {teste ? (
        <div className={teste.ok ? "aviso conferido" : "aviso"}>
          <p style={{ margin: 0 }}>{teste.ok ? `Funcionou em ${teste.ms} ms. Toque num modelo para usar.` : teste.message}</p>
          {teste.models.length ? (
            <div className="fichas" style={{ marginTop: 8 }}>
              {teste.models.slice(0, 60).map((modelo) => (
                <button key={modelo} type="button" className={`ficha${modelos.includes(modelo) ? " ativa" : ""}`} onClick={() => adicionar(modelo)}>
                  {modelo}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <h2 className="etiqueta">Modelos em uso</h2>
      <div className="lista">
        {modelos.length === 0 ? <div className="linha fraco">Nenhum modelo. Teste a chave ou escreva o nome do modelo.</div> : null}
        {modelos.map((modelo) => (
          <div key={modelo} className="linha">
            <span>{modelo}</span>
            <IonButton size="small" fill="clear" color="danger" onClick={() => setModelos(modelos.filter((item) => item !== modelo))}>
              Tirar
            </IonButton>
          </div>
        ))}
      </div>
      <div className="grade">
        <Campo icone={sparklesOutline} rotulo="Outro modelo" value={novoModelo} onMudar={setNovoModelo} autoCapitalize="none" placeholder="gpt-5-mini" />
        <IonButton
          fill="outline"
          style={{ alignSelf: "end" }}
          disabled={!novoModelo.trim()}
          onClick={() => {
            adicionar(novoModelo);
            setNovoModelo("");
          }}
        >
          Adicionar
        </IonButton>
      </div>

      {erro ? <p className="erro">{erro}</p> : null}
      <IonButton expand="block" className="principal" disabled={Boolean(ocupado)} onClick={() => void salvar()}>
        Salvar o provedor
      </IonButton>
      {provedor ? (
        <IonButton
          expand="block"
          fill="clear"
          color="danger"
          disabled={Boolean(ocupado)}
          onClick={() =>
            confirmar(`Remover ${provedor.label}?`, "Os modelos dele saem das escolhas do assistente.", "Remover", () =>
              void agir("remover", () => pedir(`/api/ia/provedores/${provedor.id}`, { method: "DELETE" }), "Provedor removido.").then((ok) => ok && void aoPronto()),
            )
          }
        >
          Remover o provedor
        </IonButton>
      ) : null}
    </>
  );
}
