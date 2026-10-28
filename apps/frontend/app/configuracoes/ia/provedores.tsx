"use client";

import { AnimatePresence, motion } from "motion/react";
import { useRef, useState } from "react";
import {
  INFO_DOS_PROVEDORES,
  PROVEDORES_IA,
  type ConfiguracaoDeIa,
  type ProvedorConfigurado,
  type ProvedorIa,
  type ResultadoDoTeste,
} from "@finnagent/contracts";
import { Button } from "../../../components/ui/button";
import { Chip } from "../../../components/ui/chip";
import { cn, focusRing } from "../../../components/ui/cn";
import { Dialogo } from "../../../components/ui/dialogo";
import { Cascata, ItemAnimado, ListaAnimada, Passo } from "../../../components/ui/movimento";
import { useToast } from "../../../components/ui/toast";
import { removerProvedor, testarProvedor } from "./api";
import { FormularioDeProvedor } from "./dialogo-de-provedor";
import { MarcaDoProvedor } from "./pecas";

type Edicao = { provedor: ProvedorConfigurado | null; kind: ProvedorIa; chave: number };

function Cartao({
  provedor,
  padrao,
  podeEditar,
  onEditar,
  onRemover,
}: {
  provedor: ProvedorConfigurado;
  padrao: boolean;
  podeEditar: boolean;
  onEditar: () => void;
  onRemover: () => void;
}) {
  const [teste, setTeste] = useState<ResultadoDoTeste | null>(null);
  const [testando, setTestando] = useState(false);
  const pronto = provedor.hasKey || !INFO_DOS_PROVEDORES[provedor.kind].precisaChave || provedor.kind === "openai_compativel";
  const visiveis = provedor.models.slice(0, 4);

  async function testar() {
    setTestando(true);
    try {
      setTeste(await testarProvedor({ kind: provedor.kind, apiKey: "", baseUrl: provedor.baseUrl, providerId: provedor.id }));
    } catch (error) {
      setTeste({ ok: false, models: [], message: error instanceof Error ? error.message : "Não foi possível testar.", ms: 0 });
    } finally {
      setTestando(false);
    }
  }

  return (
    <ItemAnimado layout className="grid content-start gap-4 border border-line bg-surface p-4">
      <div className="flex min-w-0 items-start gap-3">
        <MarcaDoProvedor kind={provedor.kind} grande />
        <div className="grid min-w-0 flex-1 gap-1">
          <p className="truncate font-semibold">{provedor.label}</p>
          <p className="truncate text-sm text-ink-2">
            {INFO_DOS_PROVEDORES[provedor.kind].nome}
            {provedor.baseUrl ? ` · ${provedor.baseUrl.replace(/^https?:\/\//, "")}` : ""}
          </p>
        </div>
        <Chip tone={pronto ? "ok" : "neg"}>{pronto ? "Pronto" : "Sem chave"}</Chip>
      </div>

      <div className="flex flex-wrap gap-2">
        {padrao ? <Chip tone="ai">Padrão</Chip> : null}
        {visiveis.map((modelo) => (
          <span key={modelo} className="border border-line bg-surface-2 px-2 py-1 font-mono text-sm">
            {modelo}
          </span>
        ))}
        {provedor.models.length > visiveis.length ? (
          <span className="px-2 py-1 text-sm text-ink-2">+{provedor.models.length - visiveis.length}</span>
        ) : null}
        {provedor.models.length === 0 ? <span className="text-sm text-neg">Nenhum modelo escolhido</span> : null}
      </div>

      <AnimatePresence initial={false}>
        {teste ? (
          <motion.p
            key="teste"
            role="status"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className={cn("flex items-center gap-2 overflow-hidden text-sm", teste.ok ? "text-pos" : "text-neg")}
          >
            <span aria-hidden className={cn("size-2 shrink-0 rounded-full", teste.ok ? "bg-pos" : "bg-neg")} />
            {teste.message}
            {teste.ms ? <span className="text-ink-2">{teste.ms} ms</span> : null}
          </motion.p>
        ) : null}
      </AnimatePresence>

      {podeEditar ? (
        <div className="flex flex-wrap gap-2 border-t border-line pt-3">
          <Button onClick={() => void testar()} carregando={testando}>
            {testando ? "Testando" : "Testar"}
          </Button>
          <Button variant="quiet" onClick={onEditar}>
            Editar
          </Button>
          <Button variant="quiet" className="ml-auto hover:text-neg!" onClick={onRemover}>
            Remover
          </Button>
        </div>
      ) : null}
    </ItemAnimado>
  );
}

export function Provedores({
  configuracao,
  onMudar,
}: {
  configuracao: ConfiguracaoDeIa;
  onMudar: () => Promise<void>;
}) {
  const toast = useToast();
  const [edicao, setEdicao] = useState<Edicao | null>(null);
  const [removendo, setRemovendo] = useState<ProvedorConfigurado | null>(null);
  const formulario = useRef<HTMLDialogElement>(null);
  const confirmar = useRef<HTMLDialogElement>(null);
  const { provedores, podeEditar } = configuracao;

  function abrir(provedor: ProvedorConfigurado | null, kind: ProvedorIa = "openai") {
    setEdicao({ provedor, kind: provedor?.kind ?? kind, chave: Date.now() });
    formulario.current?.showModal();
  }

  async function remover() {
    if (!removendo) return;
    try {
      await removerProvedor(removendo.id);
      toast.sucesso("Provedor removido");
      confirmar.current?.close();
      await onMudar();
    } catch (error) {
      toast.erro(error instanceof Error ? error.message : "Não foi possível remover o provedor.");
    }
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid max-w-prose gap-1">
          <h2 className="font-display text-lg">Provedores</h2>
          <p className="text-sm text-ink-2">
            De onde vêm os modelos. Conecte quantos quiser e use um para cada tarefa na seção Agentes.
          </p>
        </div>
        {podeEditar && provedores.length ? (
          <Button variant="primary" onClick={() => abrir(null)}>
            Conectar provedor
          </Button>
        ) : null}
      </div>

      {provedores.length === 0 ? (
        <Cascata className="grid gap-3">
          <Passo>
            <p className="text-sm text-ink-2">
              {podeEditar ? "Escolha por onde começar." : "O usuário master ainda não conectou nenhum provedor."}
            </p>
          </Passo>
          {podeEditar ? (
            <div role="group" aria-label="Tipos de provedor" className="grid gap-3 tab:grid-cols-2 desk:grid-cols-3">
              {PROVEDORES_IA.map((kind) => (
                <Passo key={kind}>
                  <motion.button
                    type="button"
                    whileHover={{ y: -3 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => abrir(null, kind)}
                    className={cn("grid h-full w-full content-start gap-3 border border-line bg-surface p-4 text-left transition-colors hover:border-brand", focusRing)}
                  >
                    <MarcaDoProvedor kind={kind} grande />
                    <span className="font-semibold">{INFO_DOS_PROVEDORES[kind].nome}</span>
                    <span className="text-sm text-ink-2">{INFO_DOS_PROVEDORES[kind].descricao}</span>
                  </motion.button>
                </Passo>
              ))}
            </div>
          ) : null}
        </Cascata>
      ) : (
        <ListaAnimada className="grid gap-3 tab:grid-cols-2">
          {provedores.map((provedor) => (
            <Cartao
              key={provedor.id}
              provedor={provedor}
              padrao={configuracao.assistente.padrao?.providerId === provedor.id}
              podeEditar={podeEditar}
              onEditar={() => abrir(provedor)}
              onRemover={() => {
                setRemovendo(provedor);
                confirmar.current?.showModal();
              }}
            />
          ))}
        </ListaAnimada>
      )}

      <Dialogo ref={formulario} largura="larga" aria-label="Provedor de IA" onClose={() => setEdicao(null)}>
        {edicao ? (
          <FormularioDeProvedor
            key={edicao.chave}
            provedor={edicao.provedor}
            kindInicial={edicao.kind}
            onCancelar={() => formulario.current?.close()}
            onSalvo={async () => {
              formulario.current?.close();
              await onMudar();
            }}
          />
        ) : null}
      </Dialogo>

      <Dialogo ref={confirmar} aria-labelledby="titulo-remover-provedor" onClose={() => setRemovendo(null)}>
        <div className="dialog-corpo grid gap-4">
          <h2 id="titulo-remover-provedor" className="font-display text-lg">
            Remover {removendo?.label}?
          </h2>
          <p>A chave sai do servidor. Os agentes que usavam este provedor voltam para o modelo padrão.</p>
        </div>
        <div className="dialog-acoes">
          <Button variant="quiet" onClick={() => confirmar.current?.close()}>
            Cancelar
          </Button>
          <Button variant="danger" onClick={() => void remover()}>
            Remover
          </Button>
        </div>
      </Dialogo>
    </div>
  );
}
