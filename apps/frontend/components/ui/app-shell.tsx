"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { usePathname } from "next/navigation";
import { ContaDoMenu } from "../auth/conta-do-menu";
import { Marca, PainelDaMarca } from "../auth/painel-da-marca";
import { SessaoExpirada } from "../auth/sessao-expirada";
import { BotaoDaCalculadora, CalculadoraProvider, JanelaDaCalculadora } from "../calculadora/calculadora";
import { SinoDoMenu } from "../notificacoes/central";
import { cn, focusRing } from "./cn";
import { Icone } from "./icone";
import { LogoDoPrumo } from "./logo";
import { MenuContext, definirMenuRecolhido, useMenuRecolhido } from "./menu-lateral";
import { useCurva } from "./movimento";

type Icone = React.ComponentProps<typeof Icone>["name"];

const items: Array<{ href: string; label: string; icone: Icone }> = [
  { href: "/", label: "Dashboard", icone: "dashboard" },
  { href: "/assistente", label: "Assistente", icone: "chat" },
  { href: "/agenda", label: "Agenda", icone: "calendar" },
  { href: "/financas", label: "Finanças", icone: "wallet" },
  { href: "/metas", label: "Metas", icone: "target" },
  { href: "/relatorios", label: "Relatórios", icone: "chart" },
  { href: "/eventos", label: "Eventos", icone: "clock" },
];

const extratos: Array<{ href: string; label: string; icone: Icone }> = [
  { href: "/extratos", label: "Importações", icone: "upload" },
  { href: "/extratos/conferencia", label: "Conferência", icone: "check" },
];

const depois: Array<{ href: string; label: string; icone: Icone }> = [
  { href: "/grupos", label: "Grupos", icone: "layers" },
  { href: "/configuracoes", label: "Configurações", icone: "gear" },
];

function Item({
  href,
  label,
  icone,
  current,
  recolhido,
  nested = false,
}: {
  href: string;
  label: string;
  icone: Icone;
  current: boolean;
  recolhido: boolean;
  nested?: boolean;
}) {
  const curva = useCurva();
  return (
    <li>
      <Link
        href={href}
        aria-current={current ? "page" : undefined}
        // Recolhido, o nome vai para o `title` e para o leitor de tela; na tela fica só o ícone.
        title={recolhido ? label : undefined}
        className={cn(
          "etiqueta relative flex min-h-10 items-center gap-3 px-3 py-2 whitespace-nowrap text-ink-2 no-underline transition-colors hover:text-ink",
          focusRing,
          nested && !recolhido && "tab:pl-6",
          recolhido && "tab:justify-center tab:px-0",
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
        <span className="relative shrink-0">
          <Icone name={icone} />
        </span>
        <span className={cn("relative", recolhido && "tab:sr-only")}>{label}</span>
      </Link>
    </li>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const recolhido = useMenuRecolhido();
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
  const emExtratos = pathname === "/extratos" || pathname.startsWith("/extratos/");
  return (
    <CalculadoraProvider>
    <MenuContext value={recolhido}>
    <div
      className={cn(
        "grid min-h-dvh grid-cols-1 content-start pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]",
        // Só a coluna do menu muda de largura: o conteúdo ocupa o resto.
        recolhido ? "tab:grid-cols-[64px_minmax(0,1fr)]" : "tab:grid-cols-[200px_minmax(0,1fr)]",
      )}
    >
      <nav
        aria-label="Principal"
        className={cn(
          "pontos sticky top-[env(safe-area-inset-top)] z-20 flex items-center gap-1 self-start overflow-x-auto border-b border-line bg-bg p-3 tab:row-span-2 tab:h-dvh tab:flex-col tab:items-stretch tab:gap-6 tab:overflow-x-hidden tab:overflow-y-auto tab:border-r tab:border-b-0",
          recolhido ? "tab:p-2" : "tab:p-4",
        )}
      >
        <div className={cn("flex shrink-0 items-center justify-between gap-2", recolhido && "tab:flex-col tab:items-stretch")}>
          <Link
            href="/"
            aria-label="Prumo, início"
            title="Prumo"
            className={cn(
              "flex min-h-10 items-center gap-2 px-3 font-display text-lg font-bold tracking-titulo text-ink no-underline",
              focusRing,
              recolhido && "tab:justify-center tab:px-0",
            )}
          >
            <LogoDoPrumo />
            <span className={cn(recolhido && "tab:sr-only")}>Prumo</span>
          </Link>
          <SinoDoMenu />
        </div>
        <ul className="flex gap-1 tab:flex-col">
          {items.map((item) => (
            <Item key={item.href} {...item} current={pathname === item.href} recolhido={recolhido} />
          ))}
          <li className="flex items-center gap-1 tab:flex-col tab:items-stretch">
            <span
              className={cn(
                "etiqueta flex min-h-10 items-center gap-3 px-3 py-2 whitespace-nowrap",
                emExtratos ? "text-brand" : "text-ink",
                recolhido && "tab:justify-center tab:px-0",
              )}
              title={recolhido ? "Extratos" : undefined}
            >
              <Icone name="file" />
              <span className={cn(recolhido && "tab:sr-only")}>Extratos</span>
            </span>
            <ul className="flex gap-1 tab:flex-col">
              {extratos.map((item) => (
                <Item key={item.href} {...item} current={pathname === item.href} recolhido={recolhido} nested />
              ))}
            </ul>
          </li>
          {depois.map((item) => (
            <Item key={item.href} {...item} current={pathname === item.href} recolhido={recolhido} />
          ))}
          <li className="hidden tab:block">
            {/* Recolher e expandir: um item como os outros, no fim da lista, para não disputar espaço com a logo. */}
            <button
              type="button"
              aria-pressed={recolhido}
              aria-label={recolhido ? "Expandir o menu" : "Recolher o menu"}
              title={recolhido ? "Expandir o menu" : "Recolher o menu"}
              onClick={() => definirMenuRecolhido(!recolhido)}
              className={cn(
                "etiqueta flex min-h-10 w-full items-center gap-3 px-3 py-2 whitespace-nowrap text-ink-2 transition-colors hover:text-ink",
                focusRing,
                recolhido && "justify-center px-0",
              )}
            >
              <span className={cn("flex shrink-0 transition-transform", recolhido && "rotate-180")}>
                <Icone name="chevron" />
              </span>
              <span className={cn(recolhido && "sr-only")}>{recolhido ? "Expandir" : "Recolher"}</span>
            </button>
          </li>
        </ul>
        <ContaDoMenu />
      </nav>
      <SessaoExpirada />
      <main className="min-w-0 px-4 py-6 tab:px-8 tab:pt-8 tab:pb-12">
        {children}
      </main>
      <BotaoDaCalculadora />
      <JanelaDaCalculadora />
    </div>
    </MenuContext>
    </CalculadoraProvider>
  );
}
