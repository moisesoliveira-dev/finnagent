"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { usePathname } from "next/navigation";
import { ContaDoMenu } from "../auth/conta-do-menu";
import { Marca, PainelDaMarca } from "../auth/painel-da-marca";
import { SessaoExpirada } from "../auth/sessao-expirada";
import { cn, focusRing } from "./cn";
import { useCurva } from "./movimento";

const items = [
  { href: "/", label: "Dashboard" },
  { href: "/agenda", label: "Agenda" },
  { href: "/financas", label: "Finanças" },
  { href: "/grupos", label: "Grupos" },
];

const extratos = [
  { href: "/extratos", label: "Importações" },
  { href: "/extratos/conferencia", label: "Conferência" },
];

function Item({
  href,
  label,
  current,
  nested = false,
}: {
  href: string;
  label: string;
  current: boolean;
  nested?: boolean;
}) {
  const curva = useCurva();
  return (
    <li>
      <Link
        href={href}
        aria-current={current ? "page" : undefined}
        className={cn(
          "etiqueta relative flex min-h-10 items-center px-3 py-2 whitespace-nowrap text-ink-2 no-underline transition-colors hover:text-ink",
          focusRing,
          nested && "tab:pl-6",
          current && "text-brand hover:text-brand",
        )}
      >
        {current ? (
          <motion.span
            layoutId="aba"
            className="absolute inset-x-3 bottom-1 h-0.5 bg-brand tab:inset-x-auto tab:inset-y-2 tab:left-0 tab:h-auto tab:w-0.5"
            transition={curva}
          />
        ) : null}
        <span className="relative">{label}</span>
      </Link>
    </li>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // Login e cadastro têm casca própria, sem menu: painel da marca à esquerda
  // a partir de 1100 px e o formulário à direita.
  if (pathname === "/login" || pathname === "/cadastro") {
    return (
      <div className="grid min-h-dvh grid-cols-1 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] desk:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <PainelDaMarca />
        <div className="flex min-w-0 flex-col">
          <header className="px-4 pt-6 tab:px-8 desk:hidden">
            <Marca />
          </header>
          <main className="grid min-w-0 flex-1 grid-cols-1 place-items-center px-4 py-8 tab:px-8 tab:py-12">
            {children}
          </main>
        </div>
      </div>
    );
  }
  return (
    <div className="grid min-h-dvh grid-cols-1 content-start pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] tab:grid-cols-[200px_minmax(0,1fr)]">
      <nav
        aria-label="Principal"
        className="pontos sticky top-[env(safe-area-inset-top)] z-20 flex items-center gap-1 self-start overflow-x-auto border-b border-line bg-bg p-3 tab:row-span-2 tab:h-dvh tab:flex-col tab:items-stretch tab:gap-6 tab:overflow-y-auto tab:border-r tab:border-b-0 tab:p-4"
      >
        <div className="flex items-center gap-2 px-3 font-display text-lg font-bold tracking-titulo text-ink">
          <span aria-hidden className="size-3 shrink-0 bg-cta" />
          Prumo
        </div>
        <ul className="flex gap-1 tab:flex-col">
          {items.slice(0, 3).map((item) => (
            <Item key={item.href} href={item.href} label={item.label} current={pathname === item.href} />
          ))}
          <Item href="/metas" label="Metas" current={pathname === "/metas"} />
          <Item href="/relatorios" label="Relatórios" current={pathname === "/relatorios"} />
          <Item href="/eventos" label="Eventos" current={pathname === "/eventos"} />
          <li className="flex items-center gap-1 tab:flex-col tab:items-stretch">
            <span
              className={cn(
                "etiqueta px-3 py-2 whitespace-nowrap",
                pathname === "/extratos" || pathname.startsWith("/extratos/") ? "text-brand" : "text-ink",
              )}
            >
              Extratos
            </span>
            <ul className="flex gap-1 tab:flex-col">
              {extratos.map((item) => (
                <Item
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  current={pathname === item.href}
                  nested
                />
              ))}
            </ul>
          </li>
          {items.slice(3).map((item) => (
            <Item key={item.href} href={item.href} label={item.label} current={pathname === item.href} />
          ))}
          <Item href="/configuracoes" label="Configurações" current={pathname === "/configuracoes"} />
        </ul>
        <ContaDoMenu />
      </nav>
      <SessaoExpirada />
      <main className="min-w-0 px-4 py-6 tab:px-8 tab:pt-8 tab:pb-12">
        {children}
      </main>
    </div>
  );
}
