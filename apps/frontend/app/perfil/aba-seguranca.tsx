"use client";

import { motion } from "motion/react";
import { useState } from "react";
import { SENHA_MINIMA } from "@finnagent/contracts";
import { CampoDeSenha } from "../../components/auth/campo-de-senha";
import { forcaDaSenha } from "../../components/auth/forca-da-senha";
import { Button } from "../../components/ui/button";
import { useCurva } from "../../components/ui/movimento";
import { useToast } from "../../components/ui/toast";
import { chamar } from "./api";

export function AbaDeSeguranca({ somenteLeitura }: { somenteLeitura: boolean }) {
  const toast = useToast();
  const [atual, setAtual] = useState("");
  const [nova, setNova] = useState("");
  const [confirma, setConfirma] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const forca = forcaDaSenha(nova);
  const diverge = confirma !== "" && confirma !== nova;

  async function trocar(event: React.FormEvent) {
    event.preventDefault();
    if (enviando || somenteLeitura) return;
    if (!atual) return setErro("Informe a senha atual.");
    if (nova.length < SENHA_MINIMA) return setErro(`A nova senha precisa ter ao menos ${SENHA_MINIMA} caracteres.`);
    if (nova !== confirma) return setErro("As senhas novas não são iguais.");
    setErro("");
    setEnviando(true);
    try {
      const resposta = await chamar<{ sessoesEncerradas: number }>("/api/perfil/senha", {
        method: "POST",
        body: JSON.stringify({ currentPassword: atual, newPassword: nova }),
      });
      setAtual("");
      setNova("");
      setConfirma("");
      const outras = resposta.sessoesEncerradas;
      toast.sucesso(
        outras > 0
          ? `Senha trocada. ${outras === 1 ? "1 outra sessão foi encerrada" : `${outras} outras sessões foram encerradas`}.`
          : "Senha trocada.",
      );
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível trocar a senha.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form noValidate className="grid gap-6 border border-line bg-surface p-6" onSubmit={(e) => void trocar(e)}>
      <div className="grid gap-1">
        <h3 className="font-display text-lg">Trocar a senha</h3>
        <p className="max-w-prose text-sm text-ink-2">
          Ao trocar, as sessões abertas em outros aparelhos são encerradas. Esta continua aberta.
        </p>
      </div>
      <div className="grid gap-4 tab:max-w-md">
        <CampoDeSenha
          id="perfil-senha-atual"
          rotulo="Senha atual"
          autoComplete="current-password"
          value={atual}
          invalido={false}
          onChange={setAtual}
        />
        <CampoDeSenha
          id="perfil-senha-nova"
          rotulo="Nova senha"
          autoComplete="new-password"
          value={nova}
          invalido={false}
          onChange={setNova}
        >
          <MedidorDeForca nivel={forca.nivel} rotulo={forca.rotulo} />
        </CampoDeSenha>
        <CampoDeSenha
          id="perfil-senha-confirma"
          rotulo="Repita a nova senha"
          autoComplete="new-password"
          value={confirma}
          invalido={diverge}
          onChange={setConfirma}
        >
          {diverge ? (
            <p role="status" className="text-sm text-neg">
              As senhas ainda não são iguais.
            </p>
          ) : null}
        </CampoDeSenha>
      </div>
      {erro ? (
        <p role="alert" className="text-sm text-neg">
          {erro}
        </p>
      ) : null}
      <div className="flex justify-end">
        <Button
          type="submit"
          variant="primary"
          carregando={enviando}
          disabled={somenteLeitura || !atual || !nova || !confirma}
        >
          {enviando ? "Trocando" : "Trocar a senha"}
        </Button>
      </div>
    </form>
  );
}

// Quatro faixas que enchem da esquerda para a direita. A cor sobe de vermelho para verde com a força.
function MedidorDeForca({ nivel, rotulo }: { nivel: 0 | 1 | 2 | 3 | 4; rotulo: string }) {
  const curva = useCurva();
  const cor = nivel <= 1 ? "bg-neg" : nivel === 2 ? "bg-pending" : "bg-pos";
  return (
    <div className="grid gap-2" aria-live="polite">
      <div className="grid grid-cols-4 gap-1" aria-hidden="true">
        {[1, 2, 3, 4].map((faixa) => (
          <span key={faixa} className="h-1 overflow-hidden bg-line">
            <motion.span
              className={`block h-full origin-left ${cor}`}
              initial={false}
              animate={{ scaleX: faixa <= nivel ? 1 : 0 }}
              transition={curva}
            />
          </span>
        ))}
      </div>
      <p className="etiqueta min-h-4 text-ink-2">{rotulo ? `Força: ${rotulo}` : ""}</p>
    </div>
  );
}
