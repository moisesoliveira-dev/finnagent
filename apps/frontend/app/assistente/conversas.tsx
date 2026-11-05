"use client";

import { motion } from "motion/react";
import { useState } from "react";
import type { ConversaResumo } from "@finnagent/contracts";
import { Button } from "../../components/ui/button";
import { campo, cn, focusRing } from "../../components/ui/cn";
import { Icone } from "../../components/ui/icone";
import { ItemAnimado, ListaAnimada, useCurva } from "../../components/ui/movimento";

const DIA = 24 * 60 * 60 * 1000;
const mesEAno = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" });

/** A seção da lista pela última vez em que a conversa foi usada, como nos chats de IA. */
export function secaoDe(iso: string, agora = new Date()) {
  const data = new Date(iso);
  const inicioDeHoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate()).getTime();
  const diasAtras = Math.floor((inicioDeHoje - new Date(data.getFullYear(), data.getMonth(), data.getDate()).getTime()) / DIA);
  if (diasAtras <= 0) return "Hoje";
  if (diasAtras === 1) return "Ontem";
  if (diasAtras < 7) return "Últimos 7 dias";
  if (diasAtras < 30) return "Últimos 30 dias";
  const nome = mesEAno.format(data);
  return nome.charAt(0).toUpperCase() + nome.slice(1);
}

type Secao = { titulo: string; itens: ConversaResumo[] };

/** Fixadas primeiro; o resto por recência, da mais recente para a mais antiga, em seções. */
export function agrupar(conversas: ConversaResumo[], agora = new Date()): Secao[] {
  const ordenadas = [...conversas].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const secoes: Secao[] = [];
  const fixadas = ordenadas.filter((item) => item.pinned);
  if (fixadas.length) secoes.push({ titulo: "Fixadas", itens: fixadas });
  for (const conversa of ordenadas.filter((item) => !item.pinned)) {
    const titulo = secaoDe(conversa.updatedAt, agora);
    const ultima = secoes[secoes.length - 1];
    if (ultima && ultima.titulo === titulo) ultima.itens.push(conversa);
    else secoes.push({ titulo, itens: [conversa] });
  }
  return secoes;
}

/** Histórico de conversas: nova conversa no alto, as fixadas, e as demais por quando foram usadas. */
export function Conversas({
  conversas,
  atual,
  trabalhando,
  onNova,
  onAbrir,
  onApagar,
  onRenomear,
  onFixar,
}: {
  conversas: ConversaResumo[];
  atual: string | null;
  trabalhando: boolean;
  onNova: () => void;
  onAbrir: (id: string) => void;
  onApagar: (conversa: ConversaResumo) => void;
  onRenomear: (conversa: ConversaResumo, titulo: string) => void;
  onFixar: (conversa: ConversaResumo) => void;
}) {
  const curva = useCurva();
  // A conversa cujo título está sendo editado na própria lista.
  const [editando, setEditando] = useState<{ id: string; texto: string } | null>(null);

  function salvarTitulo(conversa: ConversaResumo) {
    if (!editando || editando.id !== conversa.id) return;
    const titulo = editando.texto.trim();
    setEditando(null);
    if (titulo && titulo !== conversa.title) onRenomear(conversa, titulo);
  }

  return (
    <nav aria-label="Conversas" className="grid content-start gap-4">
      <Button onClick={onNova} className="w-full justify-start">
        <Icone name="add" />
        Nova conversa
      </Button>
      {conversas.length === 0 ? (
        <p className="text-sm text-ink-2">As conversas aparecem aqui.</p>
      ) : (
        agrupar(conversas).map((secao) => (
          <section key={secao.titulo} className="grid gap-1" aria-label={secao.titulo}>
            <h2 className="etiqueta px-3 text-ink-2">{secao.titulo}</h2>
            <ListaAnimada className="grid gap-1">
              {secao.itens.map((conversa) => {
                const ativa = conversa.id === atual;
                const emEdicao = editando?.id === conversa.id;
                return (
                  <ItemAnimado key={conversa.id} className="group relative flex min-w-0 items-stretch">
                    {ativa ? (
                      <motion.span layoutId="conversa-ativa" transition={curva} className="absolute inset-y-1 left-0 w-0.5 bg-brand" />
                    ) : null}
                    {emEdicao ? (
                      <input
                        autoFocus
                        aria-label="Novo título da conversa"
                        className={cn(campo, "min-w-0 flex-1")}
                        maxLength={80}
                        value={editando.texto}
                        onChange={(event) => setEditando({ id: conversa.id, texto: event.target.value })}
                        onBlur={() => salvarTitulo(conversa)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            salvarTitulo(conversa);
                          }
                          if (event.key === "Escape") {
                            event.preventDefault();
                            setEditando(null);
                          }
                        }}
                      />
                    ) : (
                      <button
                        type="button"
                        disabled={trabalhando}
                        aria-current={ativa ? "true" : undefined}
                        onClick={() => onAbrir(conversa.id)}
                        onDoubleClick={() => setEditando({ id: conversa.id, texto: conversa.title })}
                        className={cn(
                          "grid min-h-10 min-w-0 flex-1 content-center gap-1 px-3 py-2 text-left transition-colors hover:bg-surface-2 disabled:cursor-default",
                          focusRing,
                          ativa && "bg-surface",
                        )}
                      >
                        <span className={cn("truncate text-sm", ativa ? "font-semibold text-brand" : "text-ink")}>{conversa.title}</span>
                        {conversa.emAndamento ? (
                          <span className="etiqueta text-brand">Trabalhando</span>
                        ) : conversa.pendente ? (
                          <span className="etiqueta text-pending">Esperando você</span>
                        ) : null}
                      </button>
                    )}
                    {emEdicao ? null : (
                      <span
                        className={cn(
                          "flex shrink-0 items-center transition-colors",
                          // No toque os ícones ficam sempre à vista. Com mouse, ficam por cima do fim da linha e só
                          // aparecem ao passar ou focar, para o título ter a largura inteira.
                          "tab:absolute tab:inset-y-0 tab:right-0 tab:bg-surface-2 tab:opacity-0 tab:group-hover:opacity-100 tab:group-focus-within:opacity-100",
                        )}
                      >
                        <Acao
                          rotulo={conversa.pinned ? `Soltar a conversa ${conversa.title}` : `Fixar a conversa ${conversa.title}`}
                          ativa={conversa.pinned}
                          desativada={trabalhando}
                          onClick={() => onFixar(conversa)}
                        >
                          <Icone name="pin" />
                        </Acao>
                        <Acao
                          rotulo={`Renomear a conversa ${conversa.title}`}
                          desativada={trabalhando}
                          onClick={() => setEditando({ id: conversa.id, texto: conversa.title })}
                        >
                          <Icone name="edit" />
                        </Acao>
                        <Acao rotulo={`Apagar a conversa ${conversa.title}`} desativada={trabalhando} perigo onClick={() => onApagar(conversa)}>
                          <Icone name="remove" />
                        </Acao>
                      </span>
                    )}
                  </ItemAnimado>
                );
              })}
            </ListaAnimada>
          </section>
        ))
      )}
    </nav>
  );
}

function Acao({
  rotulo,
  ativa = false,
  perigo = false,
  desativada,
  onClick,
  children,
}: {
  rotulo: string;
  ativa?: boolean;
  perigo?: boolean;
  desativada: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={desativada}
      aria-label={rotulo}
      aria-pressed={ativa || undefined}
      onClick={onClick}
      className={cn(
        "grid size-10 place-items-center transition-colors",
        ativa ? "text-brand" : "text-ink-2",
        perigo ? "hover:text-neg" : "hover:text-ink",
        focusRing,
      )}
    >
      {children}
    </button>
  );
}
