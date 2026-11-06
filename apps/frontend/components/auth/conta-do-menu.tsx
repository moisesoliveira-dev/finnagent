"use client";

import type { PerfilDoUsuario } from "@finnagent/contracts";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Avatar } from "../ui/avatar";
import { cn, focusRing } from "../ui/cn";
import { Icone } from "../ui/icone";
import { curvaSaida, useCurva } from "../ui/movimento";
import { desligarPush } from "../notificacoes/push-do-navegador";
import { useToast } from "../ui/toast";
import { PERFIL_ATUALIZADO } from "./perfil-evento";

/** Quem está logado, no canto de cima à direita: o avatar abre o perfil e a saída da conta. */
export function MenuDaConta() {
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  const curva = useCurva();
  const caixa = useRef<HTMLDivElement>(null);
  const [perfil, setPerfil] = useState<PerfilDoUsuario | null>(null);
  const [saindo, setSaindo] = useState(false);
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    let vivo = true;
    fetch("/api/perfil")
      .then((resposta) => (resposta.ok ? resposta.json() : null))
      .then((corpo: PerfilDoUsuario | null) => {
        if (vivo && corpo) setPerfil(corpo);
      })
      .catch(() => undefined);
    // A tela de perfil avisa quando salva, e o avatar troca o nome e a cor sem recarregar.
    const atualizar = (evento: Event) => setPerfil((evento as CustomEvent<PerfilDoUsuario>).detail);
    window.addEventListener(PERFIL_ATUALIZADO, atualizar);
    return () => {
      vivo = false;
      window.removeEventListener(PERFIL_ATUALIZADO, atualizar);
    };
  }, []);

  // Fecha ao clicar fora e no Escape, como um menu.
  useEffect(() => {
    if (!aberto) return;
    const fora = (evento: PointerEvent) => {
      if (!caixa.current?.contains(evento.target as Node)) setAberto(false);
    };
    const tecla = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") setAberto(false);
    };
    document.addEventListener("pointerdown", fora);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("pointerdown", fora);
      document.removeEventListener("keydown", tecla);
    };
  }, [aberto]);

  async function sair() {
    setSaindo(true);
    try {
      // Este navegador deixa de receber o push de quem saiu.
      await desligarPush().catch(() => undefined);
      await fetch("/api/auth/sair", { method: "POST" });
      router.replace("/login");
      router.refresh();
    } catch {
      setSaindo(false);
      toast.erro("Não foi possível sair. Tente de novo.");
    }
  }

  if (!perfil) return <span className="size-10" aria-hidden />;
  const nome = perfil.name || perfil.email;
  return (
    <div ref={caixa} className="relative">
      <button
        type="button"
        aria-label={`Conta de ${nome}`}
        aria-haspopup="menu"
        aria-expanded={aberto}
        title={nome}
        onClick={() => setAberto((atual) => !atual)}
        className={cn("inline-flex size-10 items-center justify-center", focusRing)}
      >
        <Avatar nome={nome} tom={perfil.avatarTone} className="size-8 text-xs" />
      </button>
      <AnimatePresence>
        {aberto ? (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4, transition: curvaSaida }}
            transition={curva}
            className="absolute top-full right-0 z-30 mt-2 grid w-64 gap-1 border border-line bg-surface p-2"
          >
            <div className="grid min-w-0 gap-1 px-3 py-2">
              <span className="truncate font-medium">{perfil.name || perfil.email}</span>
              {perfil.name ? <span className="truncate text-sm text-ink-2">{perfil.email}</span> : null}
              {perfil.semLogin ? <span className="etiqueta text-pending">Dev, sem login</span> : null}
            </div>
            <Link
              href="/perfil"
              role="menuitem"
              aria-current={pathname === "/perfil" ? "page" : undefined}
              onClick={() => setAberto(false)}
              className={cn(
                "flex min-h-10 items-center gap-3 px-3 text-sm text-ink-2 no-underline transition-colors hover:text-ink",
                pathname === "/perfil" && "text-brand",
                focusRing,
              )}
            >
              <Icone name="gear" />
              Perfil
            </Link>
            <button
              type="button"
              role="menuitem"
              onClick={() => void sair()}
              disabled={saindo}
              className={cn("flex min-h-10 items-center gap-3 px-3 text-left text-sm text-ink-2 transition-colors hover:text-ink", focusRing)}
            >
              <Icone name="sair" />
              {saindo ? "Saindo" : "Sair"}
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
