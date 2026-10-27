"use client";

import type { UsuarioDaConta } from "@finnagent/contracts";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "../ui/button";
import { useToast } from "../ui/toast";

/** Quem está logado e a saída da conta, no pé do menu. */
export function ContaDoMenu() {
  const router = useRouter();
  const toast = useToast();
  const [nome, setNome] = useState("");
  const [semLogin, setSemLogin] = useState(false);
  const [saindo, setSaindo] = useState(false);

  useEffect(() => {
    let vivo = true;
    fetch("/api/auth/eu")
      .then((resposta) => (resposta.ok ? resposta.json() : null))
      .then((corpo: UsuarioDaConta | null) => {
        if (!vivo || !corpo) return;
        setNome(corpo.name || corpo.email || "");
        setSemLogin(Boolean(corpo.semLogin));
      })
      .catch(() => undefined);
    return () => {
      vivo = false;
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

  return (
    <div className="grid gap-1 tab:mt-auto">
      {semLogin ? <p className="etiqueta px-3 text-pending">Dev, sem login</p> : null}
      {nome ? <p className="hidden truncate px-3 text-sm text-ink-2 tab:block">{nome}</p> : null}
      <Button variant="quiet" onClick={() => void sair()} disabled={saindo} className="justify-start">
        Sair
      </Button>
    </div>
  );
}
