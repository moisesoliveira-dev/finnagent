"use client";

import { motion } from "motion/react";
import type { PapelDoUsuario, PerfilDoUsuario } from "@finnagent/contracts";
import { Avatar } from "../../components/ui/avatar";
import { Chip } from "../../components/ui/chip";
import { mola } from "../../components/ui/movimento";
import { desde } from "./api";

export type DadosDoCartao = Pick<PerfilDoUsuario, "name" | "headline" | "location" | "bio" | "avatarTone">;

// O cartão mostra o rascunho: o que a pessoa digita aparece nele na hora, antes de salvar.
export function CartaoDoPerfil({
  dados,
  email,
  role,
  createdAt,
  alterado,
}: {
  dados: DadosDoCartao;
  email: string;
  role: PapelDoUsuario;
  createdAt: string | null;
  alterado: boolean;
}) {
  return (
    <article aria-label="Cartão do perfil" className="min-w-0 overflow-hidden border border-line bg-surface">
      <div className="pontos h-12 border-b border-line bg-surface-2" />
      <div className="grid gap-4 p-6">
        <div className="flex items-end justify-between gap-3">
          <motion.span
            key={dados.avatarTone}
            className="-mt-12 block w-1/3 min-w-12"
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={mola}
          >
            <Avatar
              nome={dados.name}
              tom={dados.avatarTone}
              className="aspect-square w-full border-4 border-surface text-2xl"
            />
          </motion.span>
          {alterado ? (
            <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Chip tone="ai">Não salvo</Chip>
            </motion.span>
          ) : null}
        </div>

        <div className="grid gap-1">
          <h2 className="min-w-0 break-words font-display text-xl font-bold tracking-titulo">
            {dados.name.trim() || "Seu nome"}
          </h2>
          <p className="min-w-0 break-words text-ink-2">{dados.headline.trim() || "Seu cargo ou ocupação"}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Chip tone={role === "master" ? "ok" : "default"}>{role === "master" ? "Master" : "Membro"}</Chip>
          {createdAt ? <Chip>Desde {desde(createdAt)}</Chip> : null}
        </div>

        <dl className="grid gap-3 border-t border-line pt-4">
          <Item rotulo="E-mail">{email}</Item>
          <Item rotulo="Cidade">{dados.location.trim() || "—"}</Item>
          <Item rotulo="Sobre">{dados.bio.trim() || "—"}</Item>
        </dl>
      </div>
    </article>
  );
}

function Item({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1">
      <dt className="etiqueta text-ink-2">{rotulo}</dt>
      <dd className="min-w-0 break-words text-sm">{children}</dd>
    </div>
  );
}
