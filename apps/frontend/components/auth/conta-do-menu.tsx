"use client";

import type { PerfilDoUsuario } from "@finnagent/contracts";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Avatar } from "../ui/avatar";
import { Button } from "../ui/button";
import { cn, focusRing } from "../ui/cn";
import { useToast } from "../ui/toast";
import { PERFIL_ATUALIZADO } from "./perfil-evento";

/** Quem está logado, o atalho para o perfil e a saída da conta, no pé do menu. */
export function ContaDoMenu() {
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  const [perfil, setPerfil] = useState<PerfilDoUsuario | null>(null);
  const [saindo, setSaindo] = useState(false);

  useEffect(() => {
    let vivo = true;
    fetch("/api/perfil")
      .then((resposta) => (resposta.ok ? resposta.json() : null))
      .then((corpo: PerfilDoUsuario | null) => {
        if (vivo && corpo) setPerfil(corpo);
      })
      .catch(() => undefined);
    // A tela de perfil avisa quando salva, e o menu troca o nome e a cor sem recarregar.
    const atualizar = (evento: Event) => setPerfil((evento as CustomEvent<PerfilDoUsuario>).detail);
    window.addEventListener(PERFIL_ATUALIZADO, atualizar);
    return () => {
      vivo = false;
      window.removeEventListener(PERFIL_ATUALIZADO, atualizar);
    };
  }, []);

  async function sair() {
    setSaindo(true);
    try {
      await fetch("/api/auth/sair", { method: "POST" });
      router.replace("/login");
      router.refresh();
    } catch {
      setSaindo(false);
      toast.erro("Não foi possível sair. Tente de novo.");
    }
  }

  const nome = perfil ? perfil.name || perfil.email : "";
  return (
    // Coluna flex, e não grid: o grid cresce até o tamanho do texto e empurra o nome para fora do menu.
    <div className="flex min-w-0 flex-col gap-1 tab:mt-auto">
      {perfil?.semLogin ? <p className="etiqueta px-3 text-pending">Dev, sem login</p> : null}
      {perfil ? (
        <Link
          href="/perfil"
          title={nome}
          aria-label={`Abrir o perfil de ${nome}`}
          aria-current={pathname === "/perfil" ? "page" : undefined}
          className={cn(
            "flex min-h-10 min-w-0 items-center gap-3 px-3 text-sm transition-colors hover:text-ink",
            pathname === "/perfil" ? "text-brand" : "text-ink-2",
            focusRing,
          )}
        >
          <Avatar nome={nome} tom={perfil.avatarTone} className="size-8 text-xs" />
          <span className="hidden min-w-0 flex-1 truncate tab:block">{nome}</span>
        </Link>
      ) : null}
      <Button variant="quiet" onClick={() => void sair()} disabled={saindo} className="justify-start">
        Sair
      </Button>
    </div>
  );
}
