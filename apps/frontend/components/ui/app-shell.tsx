"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { MenuDaConta } from "../auth/conta-do-menu";
import { Marca, PainelDaMarca } from "../auth/painel-da-marca";
import { SessaoExpirada } from "../auth/sessao-expirada";
import { BotaoDaCalculadora, CalculadoraProvider, JanelaDaCalculadora, useCalculadora } from "../calculadora/calculadora";
import { SinoDoMenu } from "../notificacoes/central";
import { BotaoDoTema } from "./botao-do-tema";
import { cn, focusRing } from "./cn";
import { Icone } from "./icone";
import { LogoDoPrumo } from "./logo";
import { MenuContext, definirMenuRecolhido, useMenuRecolhido } from "./menu-lateral";
import { curvaSaida, useCurva } from "./movimento";

type Icone = React.ComponentProps<typeof Icone>["name"];

const items: Array<{ href: string; label: string; icone: Icone }> = [
  { href: "/", label: "Dashboard", icone: "dashboard" },
  { href: "/assistente", label: "Assistente", icone: "chat" },
  { href: "/hoje", label: "Hoje", icone: "lista" },
  { href: "/agenda", label: "Agenda", icone: "calendar" },
  { href: "/financas", label: "Finanças", icone: "wallet" },
  { href: "/contas", label: "Contas", icone: "cartao" },
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
  onNavegar,
}: {
  href: string;
  label: string;
  icone: Icone;
  current: boolean;
  recolhido: boolean;
  nested?: boolean;
  onNavegar?: () => void;
}) {
  const curva = useCurva();
  return (
    <li>
      <Link
        href={href}
        aria-current={current ? "page" : undefined}
        // Recolhido, o nome vai para o `title` e para o leitor de tela; na tela fica só o ícone.
        title={recolhido ? label : undefined}
        onClick={onNavegar}
        className={cn(
          "etiqueta relative flex min-h-10 items-center gap-3 px-3 py-2 whitespace-nowrap text-ink-2 no-underline transition-colors hover:text-ink",
          focusRing,
          nested && !recolhido && "pl-6",
          recolhido && "tab:justify-center tab:px-0",
          current && "text-brand hover:text-brand",
        )}
      >
        {current ? (
          <motion.span layoutId="aba" className="absolute inset-y-2 left-0 w-0.5 bg-brand" transition={curva} />
        ) : null}
        <span className="relative shrink-0">
          <Icone name={icone} />
        </span>
        <span className={cn("relative", recolhido && "tab:sr-only")}>{label}</span>
      </Link>
    </li>
  );
}

/** Os quatro destinos da barra de baixo do celular. O quinto é o "Mais", que abre o resto. */
const principais: Array<{ href: string; label: string; icone: Icone }> = [
  { href: "/", label: "Dashboard", icone: "dashboard" },
  { href: "/financas", label: "Finanças", icone: "wallet" },
  { href: "/assistente", label: "Assistente", icone: "chat" },
  { href: "/agenda", label: "Agenda", icone: "calendar" },
];

const estaEm = (pathname: string, href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`));

/** A lista de abas: o menu lateral do tablet e, no celular, o "Mais" sem o que já está na barra de baixo. */
function ListaDoMenu({
  pathname,
  recolhido,
  onNavegar,
  semOsPrincipais = false,
}: {
  pathname: string;
  recolhido: boolean;
  onNavegar?: () => void;
  semOsPrincipais?: boolean;
}) {
  const emExtratos = pathname === "/extratos" || pathname.startsWith("/extratos/");
  const itensDoMenu = semOsPrincipais ? items.filter((item) => !principais.some((principal) => principal.href === item.href)) : items;
  return (
    <ul className="flex flex-col gap-1">
      {itensDoMenu.map((item) => (
        <Item key={item.href} {...item} current={pathname === item.href} recolhido={recolhido} onNavegar={onNavegar} />
      ))}
      <li className="flex flex-col">
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
        <ul className="flex flex-col gap-1">
          {extratos.map((item) => (
            <Item key={item.href} {...item} current={pathname === item.href} recolhido={recolhido} nested onNavegar={onNavegar} />
          ))}
        </ul>
      </li>
      {depois.map((item) => (
        <Item key={item.href} {...item} current={pathname === item.href} recolhido={recolhido} onNavegar={onNavegar} />
      ))}
    </ul>
  );
}

function Logo({ recolhido = false }: { recolhido?: boolean }) {
  return (
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
  );
}

/** Celular: os destinos do dia a dia ao alcance do polegar. O "Mais" abre a folha com o resto. */
function BarraInferior({ pathname, maisAberto, aoAbrirMais }: { pathname: string; maisAberto: boolean; aoAbrirMais: () => void }) {
  const curva = useCurva();
  const maisAtivo = maisAberto || !principais.some((item) => estaEm(pathname, item.href));
  const celula = "relative flex h-full min-w-0 flex-col items-center justify-center gap-1 text-2xs font-medium text-ink-2 no-underline transition-colors hover:text-ink";
  const marca = <motion.span layoutId="aba-de-baixo" className="absolute inset-x-3 top-0 h-0.5 bg-brand" transition={curva} />;
  return (
    <nav aria-label="Navegação rápida" className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-bg pb-[env(safe-area-inset-bottom)] tab:hidden">
      <ul className="grid h-[var(--barra-inferior)] grid-cols-5">
        {principais.map((item) => {
          const atual = estaEm(pathname, item.href) && !maisAberto;
          return (
            <li key={item.href} className="min-w-0">
              <Link href={item.href} aria-current={atual ? "page" : undefined} className={cn(celula, focusRing, atual && "text-brand hover:text-brand")}>
                {atual ? marca : null}
                <Icone name={item.icone} />
                <span className="truncate">{item.label}</span>
              </Link>
            </li>
          );
        })}
        <li className="min-w-0">
          <button
            type="button"
            aria-expanded={maisAberto}
            aria-controls="mais-do-celular"
            onClick={aoAbrirMais}
            className={cn(celula, "w-full", focusRing, maisAtivo && "text-brand hover:text-brand")}
          >
            {maisAtivo ? marca : null}
            <Icone name="menu" />
            <span className="truncate">Mais</span>
          </button>
        </li>
      </ul>
    </nav>
  );
}

/** O "Mais" do celular: sobe de baixo, acima da barra, com as abas que não cabem nela e a calculadora. */
function FolhaDoMais({ aberta, pathname, aoFechar }: { aberta: boolean; pathname: string; aoFechar: () => void }) {
  const curva = useCurva();
  const calculadora = useCalculadora();
  return (
    <AnimatePresence>
      {aberta ? (
        <motion.div
          key="veu"
          className="fixed inset-0 z-30 bg-overlay/70 tab:hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: curvaSaida }}
          transition={curva}
          onClick={aoFechar}
          aria-hidden
        />
      ) : null}
      {aberta ? (
        <motion.nav
          key="folha"
          id="mais-do-celular"
          aria-label="Mais"
          className="acima-da-barra pontos fixed inset-x-0 z-40 flex max-h-[75dvh] flex-col gap-3 overflow-y-auto border-t border-line bg-bg p-4 tab:hidden"
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%", transition: curvaSaida }}
          transition={curva}
        >
          <div className="flex items-center justify-between gap-1">
            <span className="etiqueta px-3 text-ink-2">Mais</span>
            <button
              type="button"
              aria-label="Fechar"
              onClick={aoFechar}
              className={cn("inline-flex size-10 shrink-0 items-center justify-center text-ink-2 transition-colors hover:text-ink", focusRing)}
            >
              <Icone name="fechar" />
            </button>
          </div>
          <ListaDoMenu pathname={pathname} recolhido={false} semOsPrincipais onNavegar={aoFechar} />
          <ul className="flex flex-col gap-1 border-t border-line pt-3">
            <li>
              <button
                type="button"
                onClick={() => {
                  calculadora.alternar();
                  aoFechar();
                }}
                className={cn("etiqueta flex min-h-10 w-full items-center gap-3 px-3 py-2 whitespace-nowrap text-ink-2 transition-colors hover:text-ink", focusRing)}
              >
                <Icone name="calc" />
                <span>Calculadora</span>
              </button>
            </li>
          </ul>
        </motion.nav>
      ) : null}
    </AnimatePresence>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const recolhido = useMenuRecolhido();
  // O "Mais" do celular: abre pela barra de baixo e fecha ao escolher uma aba, ao tocar fora ou no Escape.
  const [gaveta, setGaveta] = useState(false);

  useEffect(() => {
    if (!gaveta) return;
    const tecla = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") setGaveta(false);
    };
    document.addEventListener("keydown", tecla);
    return () => document.removeEventListener("keydown", tecla);
  }, [gaveta]);

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
    <CalculadoraProvider>
    <MenuContext value={recolhido}>
    <div
      className={cn(
        "grid min-h-dvh grid-cols-1 content-start pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]",
        // Só a coluna do menu muda de largura: o conteúdo ocupa o resto.
        recolhido ? "tab:grid-cols-[64px_minmax(0,1fr)]" : "tab:grid-cols-[200px_minmax(0,1fr)]",
      )}
    >
      {/* Celular: a barra de cima com a logo e, à direita, tema, avisos e conta. A navegação fica na barra de baixo. */}
      <header className="pontos sticky top-[env(safe-area-inset-top)] z-20 flex items-center gap-1 border-b border-line bg-bg px-2 py-2 tab:hidden">
        <Logo />
        <span className="flex-1" />
        <BotaoDoTema />
        <SinoDoMenu />
        <MenuDaConta />
      </header>

      {/* Tablet e desktop: o menu lateral, recolhível pelo ícone ao lado da logo. */}
      <nav
        aria-label="Principal"
        className={cn(
          "pontos sticky top-[env(safe-area-inset-top)] z-20 hidden h-dvh flex-col items-stretch gap-6 self-start overflow-x-hidden overflow-y-auto border-r border-line bg-bg tab:row-span-3 tab:flex",
          recolhido ? "p-2" : "p-4",
        )}
      >
        <div className={cn("flex shrink-0 items-center justify-between gap-1", recolhido && "flex-col items-center")}>
          <Logo recolhido={recolhido} />
          <button
            type="button"
            aria-pressed={recolhido}
            aria-label={recolhido ? "Expandir o menu" : "Recolher o menu"}
            title={recolhido ? "Expandir o menu" : "Recolher o menu"}
            onClick={() => definirMenuRecolhido(!recolhido)}
            className={cn("inline-flex size-10 shrink-0 items-center justify-center text-ink-2 transition-colors hover:text-ink", focusRing)}
          >
            <span className={cn("flex transition-transform", recolhido && "rotate-180")}>
              <Icone name="chevron" />
            </span>
          </button>
        </div>
        <ListaDoMenu pathname={pathname} recolhido={recolhido} />
      </nav>

      <BarraInferior pathname={pathname} maisAberto={gaveta} aoAbrirMais={() => setGaveta((aberta) => !aberta)} />
      <FolhaDoMais aberta={gaveta} pathname={pathname} aoFechar={() => setGaveta(false)} />

      <SessaoExpirada />
      {/* Tablet e desktop: o canto de cima à direita com tema, avisos e a conta. */}
      <div className="hidden items-center justify-end gap-1 px-8 pt-6 tab:flex">
        <BotaoDoTema />
        <SinoDoMenu />
        <MenuDaConta />
      </div>
      <main className="min-w-0 px-4 pt-6 pb-[calc(var(--barra-inferior)+1.5rem)] tab:px-8 tab:pt-4 tab:pb-12">
        {children}
      </main>
      <BotaoDaCalculadora />
      <JanelaDaCalculadora />
    </div>
    </MenuContext>
    </CalculadoraProvider>
  );
}
