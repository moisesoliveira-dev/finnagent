"use client";

import { motion } from "motion/react";
import { useId } from "react";
import { LIMITES_DO_PERFIL, TONS_DO_AVATAR, type TomDoAvatar } from "@finnagent/contracts";
import { CampoDeTexto } from "../../components/auth/campo-de-texto";
import { Avatar, ROTULO_DO_TOM } from "../../components/ui/avatar";
import { Button } from "../../components/ui/button";
import { campo, cn, focusRing } from "../../components/ui/cn";
import { useCurva } from "../../components/ui/movimento";
import type { DadosDoCartao } from "./cartao";

export function AbaDoPerfil({
  rascunho,
  email,
  somenteLeitura,
  alterado,
  salvando,
  erro,
  onMudar,
  onSalvar,
  onDescartar,
}: {
  rascunho: DadosDoCartao;
  email: string;
  somenteLeitura: boolean;
  alterado: boolean;
  salvando: boolean;
  erro: string;
  onMudar: (parcial: Partial<DadosDoCartao>) => void;
  onSalvar: () => void;
  onDescartar: () => void;
}) {
  return (
    <form
      noValidate
      className="grid gap-6 border border-line bg-surface p-6"
      onSubmit={(event) => {
        event.preventDefault();
        onSalvar();
      }}
    >
      <div className="grid gap-4 tab:grid-cols-2">
        <CampoDeTexto
          id="perfil-nome"
          rotulo="Nome"
          name="name"
          autoComplete="name"
          maxLength={LIMITES_DO_PERFIL.name}
          value={rascunho.name}
          disabled={somenteLeitura}
          invalido={rascunho.name.trim() === "" && alterado}
          onChange={(event) => onMudar({ name: event.target.value })}
        />
        <CampoDeTexto
          id="perfil-cargo"
          rotulo="Cargo ou ocupação"
          name="headline"
          autoComplete="organization-title"
          maxLength={LIMITES_DO_PERFIL.headline}
          value={rascunho.headline}
          disabled={somenteLeitura}
          invalido={false}
          onChange={(event) => onMudar({ headline: event.target.value })}
        />
        <CampoDeTexto
          id="perfil-cidade"
          rotulo="Cidade"
          name="location"
          autoComplete="address-level2"
          maxLength={LIMITES_DO_PERFIL.location}
          value={rascunho.location}
          disabled={somenteLeitura}
          invalido={false}
          onChange={(event) => onMudar({ location: event.target.value })}
        />
        <div className="grid content-start gap-2">
          <CampoDeTexto id="perfil-email" rotulo="E-mail" value={email} readOnly disabled invalido={false} />
          <p className="text-sm text-ink-2">O e-mail é o seu acesso. Ele não muda por aqui.</p>
        </div>
      </div>

      <div className="grid gap-2">
        <label htmlFor="perfil-sobre" className="text-sm font-medium">
          Sobre você
        </label>
        <textarea
          id="perfil-sobre"
          rows={4}
          name="bio"
          maxLength={LIMITES_DO_PERFIL.bio}
          value={rascunho.bio}
          disabled={somenteLeitura}
          className={cn(campo, "w-full resize-none py-2")}
          onChange={(event) => onMudar({ bio: event.target.value })}
        />
        <p className="etiqueta justify-self-end text-ink-2">
          {rascunho.bio.length}/{LIMITES_DO_PERFIL.bio}
        </p>
      </div>

      <EscolhaDaCor
        valor={rascunho.avatarTone}
        nome={rascunho.name}
        desabilitado={somenteLeitura}
        onEscolher={(avatarTone) => onMudar({ avatarTone })}
      />

      {erro ? (
        <p role="alert" className="text-sm text-neg">
          {erro}
        </p>
      ) : null}

      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="quiet" disabled={!alterado || salvando || somenteLeitura} onClick={onDescartar}>
          Descartar
        </Button>
        <Button
          type="submit"
          variant="primary"
          carregando={salvando}
          disabled={!alterado || somenteLeitura || rascunho.name.trim() === ""}
        >
          {salvando ? "Salvando" : "Salvar perfil"}
        </Button>
      </div>
    </form>
  );
}

// Cada cor mostra as iniciais da pessoa. A moldura azul desliza de uma cor para a outra.
function EscolhaDaCor({
  valor,
  nome,
  desabilitado,
  onEscolher,
}: {
  valor: TomDoAvatar;
  nome: string;
  desabilitado: boolean;
  onEscolher: (tom: TomDoAvatar) => void;
}) {
  const marca = useId();
  const rotulo = useId();
  const curva = useCurva();
  return (
    <div className="grid gap-3">
      <span id={rotulo} className="text-sm font-medium">
        Cor do avatar
      </span>
      <div role="radiogroup" aria-labelledby={rotulo} className="flex flex-wrap gap-3 p-1">
        {TONS_DO_AVATAR.map((tom) => {
          const ativo = tom === valor;
          return (
            <button
              key={tom}
              type="button"
              role="radio"
              aria-checked={ativo}
              aria-label={ROTULO_DO_TOM[tom]}
              disabled={desabilitado}
              className={cn("relative size-10 disabled:opacity-50", focusRing)}
              onClick={() => onEscolher(tom)}
            >
              {ativo ? (
                <motion.span
                  layoutId={marca}
                  className="absolute -inset-1 border-2 border-brand"
                  transition={curva}
                />
              ) : null}
              <Avatar nome={nome} tom={tom} className="size-10 text-xs" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
