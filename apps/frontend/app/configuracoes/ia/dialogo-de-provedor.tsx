"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import {
  INFO_DOS_PROVEDORES,
  LIMITE_MODELOS_POR_PROVEDOR,
  PROVEDORES_IA,
  idDeModelo,
  type ProvedorConfigurado,
  type ProvedorIa,
  type ResultadoDoTeste,
} from "@finnagent/contracts";
import { Button } from "../../../components/ui/button";
import { campo, cn, focusRing } from "../../../components/ui/cn";
import { useCurva } from "../../../components/ui/movimento";
import { useToast } from "../../../components/ui/toast";
import { salvarProvedor, testarProvedor } from "./api";
import { MarcaDoProvedor } from "./pecas";

const field = cn(campo, "w-full");

/** Formulário de um provedor. A chave salva nunca volta para a tela: o campo vazio mantém a que está lá. */
export function FormularioDeProvedor({
  provedor,
  kindInicial,
  onSalvo,
  onCancelar,
}: {
  provedor: ProvedorConfigurado | null;
  kindInicial: ProvedorIa;
  onSalvo: (provedor: ProvedorConfigurado) => void;
  onCancelar: () => void;
}) {
  const toast = useToast();
  const curva = useCurva();
  const [kind, setKind] = useState<ProvedorIa>(provedor?.kind ?? kindInicial);
  const [label, setLabel] = useState(provedor?.label ?? INFO_DOS_PROVEDORES[provedor?.kind ?? kindInicial].nome);
  const [apiKey, setApiKey] = useState("");
  const [verChave, setVerChave] = useState(false);
  const [limparChave, setLimparChave] = useState(false);
  const [baseUrl, setBaseUrl] = useState(provedor?.baseUrl || INFO_DOS_PROVEDORES[provedor?.kind ?? kindInicial].urlPadrao);
  const [modelos, setModelos] = useState<string[]>(provedor?.models ?? []);
  const [rascunho, setRascunho] = useState("");
  const [filtro, setFiltro] = useState("");
  const [teste, setTeste] = useState<ResultadoDoTeste | null>(null);
  const [testando, setTestando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const info = INFO_DOS_PROVEDORES[kind];
  const mesmoTipo = provedor?.kind === kind;
  const temChaveSalva = Boolean(provedor?.hasKey && mesmoTipo && !limparChave);

  function trocarTipo(novo: ProvedorIa) {
    if (novo === kind) return;
    // Nome e URL padrão acompanham o tipo, a menos que a pessoa já tenha escrito outros.
    if (label === INFO_DOS_PROVEDORES[kind].nome) setLabel(INFO_DOS_PROVEDORES[novo].nome);
    if (!baseUrl || baseUrl === INFO_DOS_PROVEDORES[kind].urlPadrao) setBaseUrl(INFO_DOS_PROVEDORES[novo].urlPadrao);
    setKind(novo);
    setTeste(null);
  }

  function alternarModelo(nome: string) {
    setModelos((lista) => {
      if (lista.includes(nome)) return lista.filter((item) => item !== nome);
      if (lista.length >= LIMITE_MODELOS_POR_PROVEDOR) {
        toast.alerta(`Use até ${LIMITE_MODELOS_POR_PROVEDOR} modelos por provedor.`);
        return lista;
      }
      return [...lista, nome];
    });
  }

  function adicionarManual() {
    const nome = idDeModelo(rascunho);
    if (!nome) {
      toast.erro("Escreva o nome do modelo como o provedor mostra, sem espaços.");
      return;
    }
    if (!modelos.includes(nome)) alternarModelo(nome);
    setRascunho("");
  }

  async function testar() {
    setTestando(true);
    try {
      const resultado = await testarProvedor({
        kind,
        apiKey: limparChave ? "" : apiKey,
        baseUrl: info.precisaUrl ? baseUrl : "",
        providerId: limparChave ? null : (provedor?.id ?? null),
      });
      setTeste(resultado);
    } catch (error) {
      setTeste({ ok: false, models: [], message: error instanceof Error ? error.message : "Não foi possível testar.", ms: 0 });
    } finally {
      setTestando(false);
    }
  }

  async function salvar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!label.trim()) {
      toast.erro("Dê um nome ao provedor.");
      return;
    }
    if (info.precisaChave && kind !== "openai_compativel" && !apiKey && !temChaveSalva) {
      toast.erro("Informe a chave do provedor.");
      return;
    }
    setSalvando(true);
    try {
      const salvo = await salvarProvedor(provedor?.id ?? null, {
        kind,
        label: label.trim(),
        apiKey,
        limparChave,
        baseUrl: info.precisaUrl ? baseUrl.trim() : "",
        models: modelos,
      });
      toast.sucesso(provedor ? "Provedor atualizado" : "Provedor conectado");
      onSalvo(salvo);
    } catch (error) {
      toast.erro(error instanceof Error ? error.message : "Não foi possível salvar o provedor.");
    } finally {
      setSalvando(false);
    }
  }

  const encontrados = (teste?.models ?? []).filter((nome) => nome.toLowerCase().includes(filtro.trim().toLowerCase()));

  return (
    <form onSubmit={(event) => void salvar(event)} noValidate>
      <div className="dialog-corpo grid gap-6">
        <h2 className="font-display text-lg">{provedor ? "Editar provedor" : "Conectar um provedor"}</h2>

        <fieldset className="grid gap-2">
          <legend className="mb-2 text-sm font-medium">Tipo</legend>
          <div role="radiogroup" aria-label="Tipo de provedor" className="grid gap-2 tab:grid-cols-2">
            {PROVEDORES_IA.map((opcao) => {
              const ativo = opcao === kind;
              return (
                <button
                  key={opcao}
                  type="button"
                  role="radio"
                  aria-checked={ativo}
                  onClick={() => trocarTipo(opcao)}
                  className={cn(
                    "relative flex min-w-0 items-start gap-3 border p-3 text-left transition-colors",
                    focusRing,
                    ativo ? "border-brand" : "border-line hover:border-ink-2",
                  )}
                >
                  {ativo ? <motion.span layoutId="tipo-do-provedor" transition={curva} className="absolute inset-0 bg-brand-soft" /> : null}
                  <span className="relative">
                    <MarcaDoProvedor kind={opcao} />
                  </span>
                  <span className="relative grid min-w-0 gap-1">
                    <span className={cn("font-semibold", ativo && "text-brand")}>{INFO_DOS_PROVEDORES[opcao].nome}</span>
                    <span className="text-sm text-ink-2">{INFO_DOS_PROVEDORES[opcao].descricao}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="grid gap-2">
          <label htmlFor="provedor-nome" className="text-sm font-medium">
            Nome
          </label>
          <input id="provedor-nome" value={label} maxLength={60} className={field} onChange={(event) => setLabel(event.target.value)} />
        </div>

        {info.precisaChave || kind === "openai_compativel" ? (
          <div className="grid gap-2">
            <label htmlFor="provedor-chave" className="text-sm font-medium">
              Chave da API
            </label>
            <div className="relative">
              <input
                id="provedor-chave"
                type={verChave ? "text" : "password"}
                value={apiKey}
                autoComplete="off"
                spellCheck={false}
                maxLength={400}
                placeholder={temChaveSalva ? "Chave salva. Deixe vazio para manter." : ""}
                aria-describedby="provedor-chave-dica"
                className={cn(field, "pr-12")}
                onChange={(event) => {
                  setApiKey(event.target.value);
                  setLimparChave(false);
                  setTeste(null);
                }}
              />
              <button
                type="button"
                aria-pressed={verChave}
                aria-controls="provedor-chave"
                onClick={() => setVerChave((atual) => !atual)}
                className={cn("etiqueta absolute inset-y-0 right-0 min-w-10 px-3 text-ink-2 hover:text-ink", focusRing)}
              >
                {verChave ? "Ocultar" : "Mostrar"}
              </button>
            </div>
            <p id="provedor-chave-dica" className="text-sm text-ink-2">
              {info.dicaDaChave} A chave fica guardada no servidor e nunca volta para esta tela.
            </p>
            {provedor?.hasKey && mesmoTipo ? (
              <Button
                variant="link"
                className="justify-self-start text-sm"
                onClick={() => {
                  setLimparChave((atual) => !atual);
                  setApiKey("");
                }}
              >
                {limparChave ? "Manter a chave salva" : "Remover a chave salva"}
              </Button>
            ) : null}
          </div>
        ) : null}

        {info.precisaUrl ? (
          <div className="grid gap-2">
            <label htmlFor="provedor-url" className="text-sm font-medium">
              URL da API
            </label>
            <input
              id="provedor-url"
              value={baseUrl}
              inputMode="url"
              spellCheck={false}
              maxLength={300}
              className={field}
              onChange={(event) => {
                setBaseUrl(event.target.value);
                setTeste(null);
              }}
            />
            <p className="text-sm text-ink-2">
              {kind === "ollama"
                ? "No Docker local, o seu computador é host.docker.internal. Na nuvem, use um endereço público com https."
                : "O endereço que termina em /v1, como mostra a documentação do serviço."}
            </p>
          </div>
        ) : null}

        <div className="grid gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-medium">Modelos ({modelos.length})</span>
            <Button onClick={() => void testar()} carregando={testando}>
              {testando ? "Conectando" : "Testar e buscar modelos"}
            </Button>
          </div>

          <AnimatePresence initial={false}>
            {teste ? (
              <motion.div
                key="resultado"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="grid gap-3 overflow-hidden"
              >
                <p role="status" className={cn("flex items-center gap-2 text-sm", teste.ok ? "text-pos" : "text-neg")}>
                  <span aria-hidden className={cn("size-2 rounded-full", teste.ok ? "bg-pos" : "bg-neg")} />
                  {teste.message}
                  {teste.ms ? <span className="text-ink-2">({teste.ms} ms)</span> : null}
                </p>
                {teste.models.length ? (
                  <div className="grid gap-2">
                    <label htmlFor="provedor-filtro" className="sr-only">
                      Filtrar modelos
                    </label>
                    <input
                      id="provedor-filtro"
                      value={filtro}
                      placeholder="Filtrar modelos"
                      className={field}
                      onChange={(event) => setFiltro(event.target.value)}
                    />
                    <ul className="grid max-h-64 gap-1 overflow-y-auto border border-line p-2" aria-label="Modelos encontrados">
                      {encontrados.slice(0, 200).map((nome) => (
                        <li key={nome}>
                          <label className="flex min-h-10 cursor-pointer items-center gap-3 px-2 hover:bg-surface-2">
                            <input
                              type="checkbox"
                              className={cn("size-4 accent-brand", focusRing)}
                              checked={modelos.includes(nome)}
                              onChange={() => alternarModelo(nome)}
                            />
                            <span className="min-w-0 truncate font-mono text-sm">{nome}</span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </motion.div>
            ) : null}
          </AnimatePresence>

          <div className="flex gap-2">
            <label htmlFor="provedor-modelo" className="sr-only">
              Adicionar modelo pelo nome
            </label>
            <input
              id="provedor-modelo"
              value={rascunho}
              placeholder="Ou escreva o nome de um modelo"
              spellCheck={false}
              className={cn(campo, "min-w-0 flex-1")}
              onChange={(event) => setRascunho(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  adicionarManual();
                }
              }}
            />
            <Button onClick={adicionarManual}>Adicionar</Button>
          </div>

          {modelos.length ? (
            <ul className="flex flex-wrap gap-2" aria-label="Modelos do provedor">
              <AnimatePresence initial={false}>
                {modelos.map((nome) => (
                  <motion.li
                    key={nome}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="flex items-center gap-1 border border-brand bg-brand-soft pl-2 text-sm text-brand"
                  >
                    <span className="font-mono">{nome}</span>
                    <button
                      type="button"
                      aria-label={`Tirar ${nome}`}
                      onClick={() => alternarModelo(nome)}
                      className={cn("grid size-10 place-items-center hover:text-neg", focusRing)}
                    >
                      ×
                    </button>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          ) : (
            <p className="text-sm text-ink-2">Sem modelo, o provedor fica salvo, mas nenhum agente consegue usá-lo.</p>
          )}
        </div>
      </div>
      <div className="dialog-acoes">
        <Button variant="quiet" onClick={onCancelar}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" carregando={salvando}>
          {salvando ? "Salvando" : provedor ? "Salvar" : "Conectar"}
        </Button>
      </div>
    </form>
  );
}
