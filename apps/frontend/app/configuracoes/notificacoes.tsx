"use client";

import {
  CANAIS_DE_NOTIFICACAO,
  ROTULO_DO_CANAL_DE_NOTIFICACAO,
  ROTULO_DO_TIPO_DE_NOTIFICACAO,
  TIPOS_DE_NOTIFICACAO,
  type CanaisDisponiveis,
  type CanalDeNotificacao,
  type PreferenciasDeNotificacao,
  type TipoDeNotificacao,
} from "@finnagent/contracts";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { estadoDoPush, desligarPush, ligarPush, pushSuportado, type EstadoDoPush } from "../../components/notificacoes/push-do-navegador";
import { Button } from "../../components/ui/button";
import { Chip } from "../../components/ui/chip";
import { campo, cn } from "../../components/ui/cn";
import { Esqueleto } from "../../components/ui/esqueleto";
import { Interruptor } from "../../components/ui/interruptor";
import { useCurva } from "../../components/ui/movimento";
import { useToast } from "../../components/ui/toast";

async function ler<T>(caminho: string, init?: RequestInit): Promise<T> {
  const resposta = await fetch(caminho, init);
  const corpo = (await resposta.json().catch(() => ({}))) as T & { message?: string };
  if (!resposta.ok) throw new Error(corpo.message || "Não foi possível carregar as notificações.");
  return corpo;
}

const DICA_DO_NAVEGADOR: Record<EstadoDoPush, string> = {
  ligado: "Este navegador recebe o push, mesmo com a aba fechada.",
  desligado: "Ative para receber o push neste navegador, mesmo com a aba fechada.",
  bloqueado: "O navegador bloqueou as notificações deste site. Libere nas permissões do site e volte aqui.",
  indisponivel: "",
};

/**
 * O que cada pessoa quer receber, por tipo e por canal, e o horário de silêncio. É do usuário, não da conta:
 * salva a cada mudança, fora do botão Salvar das configurações.
 */
export function NotificacoesDaPessoa() {
  const toast = useToast();
  const curva = useCurva();
  const [preferencias, setPreferencias] = useState<PreferenciasDeNotificacao | null>(null);
  const [canais, setCanais] = useState<CanaisDisponiveis | null>(null);
  const [navegador, setNavegador] = useState<EstadoDoPush>("indisponivel");
  const [erro, setErro] = useState("");
  const [situacao, setSituacao] = useState<"" | "salvando" | "salvo">("");
  const [ligando, setLigando] = useState(false);
  const pedido = useRef(0);

  useEffect(() => {
    let vivo = true;
    Promise.all([
      ler<PreferenciasDeNotificacao>("/api/notificacoes/preferencias"),
      ler<CanaisDisponiveis>("/api/notificacoes/canais").catch(() => null),
    ])
      .then(async ([lidas, disponiveis]) => {
        if (!vivo) return;
        setPreferencias(lidas);
        setCanais(disponiveis);
        setNavegador(await estadoDoPush(disponiveis));
      })
      .catch((error: unknown) => {
        if (vivo) setErro(error instanceof Error ? error.message : "Não foi possível carregar as notificações.");
      });
    return () => {
      vivo = false;
    };
  }, []);

  async function salvar(proximas: PreferenciasDeNotificacao) {
    const anteriores = preferencias;
    const atual = ++pedido.current;
    setPreferencias(proximas);
    setSituacao("salvando");
    try {
      await ler("/api/notificacoes/preferencias", { method: "PUT", body: JSON.stringify(proximas) });
      if (atual === pedido.current) setSituacao("salvo");
    } catch (error) {
      if (atual !== pedido.current) return;
      setPreferencias(anteriores);
      setSituacao("");
      toast.erro(error instanceof Error ? error.message : "Não foi possível salvar.");
    }
  }

  function mudarCanal(tipo: TipoDeNotificacao, canal: CanalDeNotificacao, valor: boolean) {
    if (!preferencias) return;
    void salvar({
      ...preferencias,
      canais: { ...preferencias.canais, [tipo]: { ...preferencias.canais[tipo], [canal]: valor } },
    });
  }

  async function alternarNavegador() {
    if (!canais?.navegador) return;
    setLigando(true);
    try {
      if (navegador === "ligado") {
        await desligarPush();
        setNavegador("desligado");
      } else {
        const estado = await ligarPush(canais.navegador);
        setNavegador(estado);
        if (estado === "ligado") toast.sucesso("Push ativado neste navegador");
      }
    } catch (error) {
      toast.erro(error instanceof Error ? error.message : "Não foi possível ativar o push.");
    } finally {
      setLigando(false);
    }
  }

  if (erro) {
    return (
      <p role="alert" className="border-t border-line py-4 text-sm text-neg">
        {erro}
      </p>
    );
  }
  if (!preferencias) {
    return (
      <div className="grid gap-2 border-t border-line py-4" aria-busy="true" aria-label="Carregando as notificações">
        <Esqueleto className="h-10" />
        <Esqueleto className="h-40" />
      </div>
    );
  }

  const semChave = !canais?.navegador;
  const dicaDoNavegador = !pushSuportado()
    ? "Este navegador não recebe push. No celular, use o app do Prumo."
    : semChave
      ? "O servidor ainda não tem as chaves do push do navegador. A central dentro do sistema continua valendo."
      : DICA_DO_NAVEGADOR[navegador];

  return (
    <div className="grid">
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line py-4">
        <p className="max-w-prose text-sm text-ink-2">Estas escolhas são suas. Cada pessoa da conta tem as próprias.</p>
        <AnimatePresence mode="wait" initial={false}>
          {situacao ? (
            <motion.span
              key={situacao}
              role="status"
              className="etiqueta text-ink-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={curva}
            >
              {situacao === "salvando" ? "Salvando" : "Salvo"}
            </motion.span>
          ) : null}
        </AnimatePresence>
      </div>

      <div className="flex flex-col gap-3 border-t border-line py-4 tab:flex-row tab:items-center tab:gap-6">
        <div className="grid min-w-0 gap-1 tab:flex-1">
          <span className="flex flex-wrap items-center gap-2 font-semibold">
            Este navegador
            {navegador === "ligado" ? <Chip tone="ok">Ativo</Chip> : null}
          </span>
          <p className="max-w-prose text-sm text-ink-2">{dicaDoNavegador}</p>
        </div>
        {pushSuportado() && !semChave && navegador !== "bloqueado" ? (
          <Button onClick={() => void alternarNavegador()} carregando={ligando} className="self-start tab:self-center">
            {ligando ? (navegador === "ligado" ? "Desativando" : "Ativando") : navegador === "ligado" ? "Desativar" : "Ativar"}
          </Button>
        ) : null}
      </div>

      <div className="grid gap-3 border-t border-line py-4">
        <span className="font-semibold">O que você recebe e onde</span>
        <div className="min-w-0 overflow-x-auto">
          <table className="w-full border-separate border-spacing-0 text-sm">
            <caption className="sr-only">Tipos de aviso por canal</caption>
            <thead>
              <tr>
                <th scope="col" className="etiqueta border-b border-line py-2 pr-3 text-left font-normal text-ink-2">
                  Aviso
                </th>
                {CANAIS_DE_NOTIFICACAO.map((canal) => (
                  <th key={canal} scope="col" className="etiqueta border-b border-line px-2 py-2 text-center font-normal text-ink-2">
                    {ROTULO_DO_CANAL_DE_NOTIFICACAO[canal]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TIPOS_DE_NOTIFICACAO.map((tipo) => {
                const rotulo = ROTULO_DO_TIPO_DE_NOTIFICACAO[tipo];
                const central = preferencias.canais[tipo].central;
                return (
                  <tr key={tipo}>
                    <th scope="row" className="border-b border-line py-3 pr-3 text-left align-middle font-normal">
                      <span className="grid min-w-0 gap-1">
                        <span className="font-semibold">{rotulo.titulo}</span>
                        <span className="text-ink-2">{rotulo.dica}</span>
                      </span>
                    </th>
                    {CANAIS_DE_NOTIFICACAO.map((canal) => (
                      <td key={canal} className="border-b border-line px-2 py-3 text-center align-middle">
                        <span className="inline-flex">
                          <Interruptor
                            id={`aviso-${tipo}-${canal}`}
                            rotulo={`${rotulo.titulo}: ${ROTULO_DO_CANAL_DE_NOTIFICACAO[canal].toLowerCase()}`}
                            checked={preferencias.canais[tipo][canal] && (canal === "central" || central)}
                            disabled={canal !== "central" && !central}
                            onChange={(valor) => mudarCanal(tipo, canal, valor)}
                          />
                        </span>
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="max-w-prose text-sm text-ink-2">
          Desligar &quot;No sistema&quot; desliga o aviso todo: o push só sai do que entra na central.
          {canais && !canais.celular ? " O push do celular ainda não está configurado no servidor." : ""}
        </p>
      </div>

      <div className="flex flex-col gap-3 border-t border-line py-4 tab:flex-row tab:items-center tab:gap-6">
        <div className="grid min-w-0 gap-1 tab:flex-1">
          <label htmlFor="silencio" className="font-semibold">
            Horário de silêncio
          </label>
          <p id="silencio-dica" className="max-w-prose text-sm text-ink-2">
            O push não toca nesse intervalo, no fuso da conta. Os avisos continuam chegando na central.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 tab:justify-end">
          <input
            type="time"
            aria-label="Início do silêncio"
            value={preferencias.silencio.inicio}
            disabled={!preferencias.silencio.ativo}
            className={cn(campo, "w-auto")}
            onChange={(evento) => {
              if (evento.target.value) void salvar({ ...preferencias, silencio: { ...preferencias.silencio, inicio: evento.target.value } });
            }}
          />
          <span className="text-sm text-ink-2">até</span>
          <input
            type="time"
            aria-label="Fim do silêncio"
            value={preferencias.silencio.fim}
            disabled={!preferencias.silencio.ativo}
            className={cn(campo, "w-auto")}
            onChange={(evento) => {
              if (evento.target.value) void salvar({ ...preferencias, silencio: { ...preferencias.silencio, fim: evento.target.value } });
            }}
          />
          <Interruptor
            id="silencio"
            checked={preferencias.silencio.ativo}
            onChange={(valor) => void salvar({ ...preferencias, silencio: { ...preferencias.silencio, ativo: valor } })}
          />
        </div>
      </div>
    </div>
  );
}
