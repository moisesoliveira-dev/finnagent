"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import type { ConfiguracaoDeIa, ConfiguracaoDoAssistente } from "@finnagent/contracts";
import { Button } from "../../../components/ui/button";
import { Carregando } from "../../../components/ui/esqueleto";
import { mola } from "../../../components/ui/movimento";
import { useToast } from "../../../components/ui/toast";
import { Agentes } from "./agentes";
import { carregarIa, salvarAssistente } from "./api";
import { Comportamento } from "./comportamento";
import { Provedores } from "./provedores";

export type SecaoDeIa = "ia-provedores" | "ia-agentes" | "ia-comportamento";

/** As três seções de IA dividem a mesma configuração: o rascunho de Agentes e Comportamento salva de uma vez. */
export function PainelDeIa({ secao }: { secao: string }) {
  const toast = useToast();
  const [configuracao, setConfiguracao] = useState<ConfiguracaoDeIa | null>(null);
  const [rascunho, setRascunho] = useState<ConfiguracaoDoAssistente | null>(null);
  const [falhou, setFalhou] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const visivel = secao.startsWith("ia-");
  const sujo = Boolean(configuracao && rascunho && JSON.stringify(rascunho) !== JSON.stringify(configuracao.assistente));

  useEffect(() => {
    let vivo = true;
    carregarIa()
      .then((dados) => {
        if (!vivo) return;
        setConfiguracao(dados);
        setRascunho(dados.assistente);
      })
      .catch(() => {
        if (vivo) setFalhou(true);
      });
    return () => {
      vivo = false;
    };
  }, []);

  /** Depois de mexer num provedor: os provedores mudam e o rascunho só é trocado se não havia edição. */
  async function recarregar() {
    try {
      const dados = await carregarIa();
      setConfiguracao(dados);
      setRascunho((atual) => (atual && configuracao && JSON.stringify(atual) !== JSON.stringify(configuracao.assistente) ? atual : dados.assistente));
    } catch {
      toast.erro("Não foi possível atualizar a configuração de IA.");
    }
  }

  async function salvar() {
    if (!rascunho || !configuracao) return;
    setSalvando(true);
    try {
      const salvo = await salvarAssistente(rascunho);
      setConfiguracao({ ...configuracao, assistente: salvo });
      setRascunho(salvo);
      toast.sucesso("Assistente salvo");
    } catch (error) {
      toast.erro(error instanceof Error ? error.message : "Não foi possível salvar o assistente.");
    } finally {
      setSalvando(false);
    }
  }

  if (!visivel) return null;
  if (falhou) {
    return (
      <section className="grid gap-4 rounded-lg border border-line bg-surface p-6">
        <p>Não foi possível carregar a configuração de IA.</p>
      </section>
    );
  }
  if (!configuracao || !rascunho) {
    return (
      <section className="rounded-lg border border-line bg-surface p-6">
        <Carregando texto="Carregando a configuração de IA" linhas={3} />
      </section>
    );
  }

  return (
    <div className="grid gap-6">
      <AnimatePresence mode="wait" initial={false}>
        <motion.section
          key={secao}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          className="rounded-lg border border-line bg-surface p-6"
        >
          {secao === "ia-provedores" ? <Provedores configuracao={configuracao} onMudar={recarregar} /> : null}
          {secao === "ia-agentes" ? <Agentes configuracao={configuracao} rascunho={rascunho} onMudar={setRascunho} /> : null}
          {secao === "ia-comportamento" ? (
            <Comportamento configuracao={configuracao} rascunho={rascunho} onMudar={setRascunho} />
          ) : null}
        </motion.section>
      </AnimatePresence>

      <AnimatePresence>
        {sujo && secao !== "ia-provedores" ? (
          <motion.div
            key="salvar"
            role="status"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={mola}
            className="sticky bottom-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-brand bg-surface p-4"
          >
            <p>O assistente tem alterações não salvas.</p>
            <span className="flex flex-wrap gap-2">
              <Button variant="quiet" disabled={salvando} onClick={() => setRascunho(configuracao.assistente)}>
                Descartar
              </Button>
              <Button variant="primary" carregando={salvando} onClick={() => void salvar()}>
                {salvando ? "Salvando" : "Salvar"}
              </Button>
            </span>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
