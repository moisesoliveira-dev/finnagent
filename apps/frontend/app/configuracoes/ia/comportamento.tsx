"use client";

import { useRef, useState } from "react";
import {
  LIMITE_INSTRUCOES_IA,
  type ConfiguracaoDeIa,
  type ConfiguracaoDoAssistente,
  type ComportamentoDoAssistente,
  type Criatividade,
  type PassosDoAssistente,
  type RetencaoDoChat,
} from "@finnagent/contracts";
import { Button } from "../../../components/ui/button";
import { campo, cn } from "../../../components/ui/cn";
import { Dialogo } from "../../../components/ui/dialogo";
import { Segmentado } from "../../../components/ui/segmentado";
import { useToast } from "../../../components/ui/toast";
import { apagarConversas } from "./api";
import { Interruptor } from "./pecas";

const PASSOS = [
  { id: "4", label: "4" },
  { id: "8", label: "8" },
  { id: "12", label: "12" },
] as const;

const CRIATIVIDADE: ReadonlyArray<{ id: Criatividade; label: string }> = [
  { id: "precisa", label: "Precisa" },
  { id: "equilibrada", label: "Equilibrada" },
  { id: "criativa", label: "Criativa" },
];

const RETENCAO: ReadonlyArray<{ id: RetencaoDoChat; label: string }> = [
  { id: "30d", label: "30 dias" },
  { id: "90d", label: "90 dias" },
  { id: "1a", label: "1 ano" },
  { id: "sempre", label: "Sem limite" },
];

function Bloco({ titulo, dica, id, children }: { titulo: string; dica: string; id: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-3 border-t border-line py-4 tab:grid-cols-2 tab:items-center tab:gap-6">
      <div className="grid gap-1">
        <span id={`${id}-titulo`} className="font-semibold">
          {titulo}
        </span>
        <p id={`${id}-dica`} className="max-w-prose text-sm text-ink-2">
          {dica}
        </p>
      </div>
      <div className="grid min-w-0 justify-items-start gap-2 tab:justify-items-end">{children}</div>
    </div>
  );
}

export function Comportamento({
  configuracao,
  rascunho,
  onMudar,
}: {
  configuracao: ConfiguracaoDeIa;
  rascunho: ConfiguracaoDoAssistente;
  onMudar: (rascunho: ConfiguracaoDoAssistente) => void;
}) {
  const toast = useToast();
  const confirmar = useRef<HTMLDialogElement>(null);
  const [apagando, setApagando] = useState(false);
  const atual = rascunho.comportamento;
  const travado = !configuracao.podeEditar;
  const mudar = <K extends keyof ComportamentoDoAssistente>(chave: K, valor: ComportamentoDoAssistente[K]) =>
    onMudar({ ...rascunho, comportamento: { ...atual, [chave]: valor } });

  async function apagar() {
    setApagando(true);
    try {
      await apagarConversas();
      toast.sucesso("Suas conversas foram apagadas");
      confirmar.current?.close();
    } catch (error) {
      toast.erro(error instanceof Error ? error.message : "Não foi possível apagar as conversas.");
    } finally {
      setApagando(false);
    }
  }

  return (
    <div className="grid gap-2">
      <div className="grid max-w-prose gap-1 pb-2">
        <h2 className="font-display text-lg">Comportamento</h2>
        <p className="text-sm text-ink-2">
          Como o assistente age na sua conta. Ele nunca mexe em perfil, senha, usuários, configurações nem exporta ou importa
          dados.
        </p>
      </div>

      <Bloco
        id="confirmar"
        titulo="Confirmar antes de apagar"
        dica="Apagar, cancelar parcelas ou fechar a virada do ano só acontece depois do seu sim. Recomendado ligado."
      >
        <Interruptor
          id="confirmar"
          ligado={atual.confirmarExclusao}
          desativado={travado}
          descricao="confirmar-dica"
          onMudar={(valor) => mudar("confirmarExclusao", valor)}
        />
      </Bloco>

      <Bloco
        id="passos"
        titulo="Passos por mensagem"
        dica="Quantas rodadas de ferramentas o assistente pode fazer antes de parar e perguntar se continua."
      >
        <Segmentado
          radio
          aria-labelledby="passos-titulo"
          opcoes={PASSOS}
          valor={String(atual.maxPassos) as "4" | "8" | "12"}
          onEscolher={(id) => !travado && mudar("maxPassos", Number(id) as PassosDoAssistente)}
        />
      </Bloco>

      <Bloco
        id="criatividade"
        titulo="Estilo das respostas"
        dica="Precisa segue o pedido à risca, o melhor para lançar e agendar. Criativa varia mais o texto."
      >
        <Segmentado
          radio
          aria-labelledby="criatividade-titulo"
          opcoes={CRIATIVIDADE}
          valor={atual.criatividade}
          onEscolher={(id) => !travado && mudar("criatividade", id)}
        />
      </Bloco>

      <div className="grid gap-3 border-t border-line py-4">
        <div className="grid gap-1">
          <label htmlFor="instrucoes-ia" className="font-semibold">
            Instruções para o assistente
          </label>
          <p id="instrucoes-ia-dica" className="max-w-prose text-sm text-ink-2">
            Como você prefere que ele trabalhe. Ex.: &ldquo;Lance mercado sempre na sessão Casa&rdquo; ou &ldquo;Responda em
            tópicos curtos&rdquo;. Elas não passam por cima das regras de segurança.
          </p>
        </div>
        <textarea
          id="instrucoes-ia"
          rows={4}
          value={atual.instrucoes}
          disabled={travado}
          maxLength={LIMITE_INSTRUCOES_IA}
          aria-describedby="instrucoes-ia-dica"
          className={cn(campo, "w-full resize-y py-2")}
          onChange={(event) => mudar("instrucoes", event.target.value)}
        />
        <p className="justify-self-end text-sm text-ink-2">
          {atual.instrucoes.length}/{LIMITE_INSTRUCOES_IA}
        </p>
      </div>

      <Bloco id="retencao" titulo="Guardar conversas" dica="Conversas paradas há mais tempo que isso são apagadas.">
        <Segmentado
          radio
          aria-labelledby="retencao-titulo"
          opcoes={RETENCAO}
          valor={atual.retencao}
          onEscolher={(id) => !travado && mudar("retencao", id)}
        />
      </Bloco>

      <Bloco id="apagar-conversas" titulo="Apagar minhas conversas" dica="Só o histórico do chat. O que o assistente já fez no sistema continua.">
        <Button variant="danger" onClick={() => confirmar.current?.showModal()}>
          Apagar conversas
        </Button>
      </Bloco>

      {travado ? <p className="text-sm text-ink-2">Só o usuário master muda o comportamento do assistente.</p> : null}

      <Dialogo ref={confirmar} aria-labelledby="titulo-apagar-conversas">
        <div className="dialog-corpo grid gap-4">
          <h2 id="titulo-apagar-conversas" className="font-display text-lg">
            Apagar todas as suas conversas?
          </h2>
          <p>O histórico do chat some para você. Não dá para desfazer.</p>
        </div>
        <div className="dialog-acoes">
          <Button variant="quiet" onClick={() => confirmar.current?.close()}>
            Cancelar
          </Button>
          <Button variant="danger" carregando={apagando} onClick={() => void apagar()}>
            {apagando ? "Apagando" : "Apagar"}
          </Button>
        </div>
      </Dialogo>
    </div>
  );
}
