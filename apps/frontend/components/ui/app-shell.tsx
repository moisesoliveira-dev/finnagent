"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "./button";
import { cn, focusRing } from "./cn";

const items = [
  { href: "/", label: "Hoje" },
  { href: "/agenda", label: "Agenda" },
  { href: "/financas", label: "Finanças" },
  { href: "/grupos", label: "Grupos" },
  { href: "/ajustes", label: "Ajustes" },
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
  return (
    <li>
      <Link
        href={href}
        aria-current={current ? "page" : undefined}
        className={cn(
          "flex min-h-10 items-center rounded-sm px-3 py-2 font-medium text-ink-2 no-underline",
          focusRing,
          nested && "tab:pl-6",
          current && "bg-brand-soft font-semibold text-brand",
        )}
      >
        {label}
      </Link>
    </li>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const semAssistente = ["/grupos", "/agenda", "/financas", "/extratos", "/metas"];
  const assistant = !semAssistente.some(
    (rota) => pathname === rota || pathname.startsWith(`${rota}/`),
  );

  return (
    <div
      className={cn(
        "grid min-h-dvh grid-cols-1 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] tab:grid-cols-[200px_minmax(0,1fr)]",
        assistant && "desk:grid-cols-[200px_minmax(0,1fr)_340px]",
      )}
    >
      <nav
        aria-label="Principal"
        className={cn(
          "flex items-center gap-1 overflow-x-auto border-b border-line p-3 tab:row-span-2 tab:flex-col tab:items-stretch tab:gap-6 tab:border-r tab:border-b-0 tab:p-4",
          assistant && "desk:row-span-1",
        )}
      >
        <div className="px-3 font-display text-lg font-bold text-brand">Prumo</div>
        <ul className="flex gap-1 tab:flex-col">
          {items.slice(0, 3).map((item) => (
            <Item key={item.href} href={item.href} label={item.label} current={pathname === item.href} />
          ))}
          <Item href="/metas" label="Metas" current={pathname === "/metas"} />
          <li className="flex items-center gap-1 tab:flex-col tab:items-stretch">
            <span
              className={cn(
                "px-3 py-2 text-sm font-semibold",
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
        </ul>
      </nav>
      <main className="min-w-0 px-4 py-6 tab:px-8 tab:pt-8 tab:pb-12">
        {children}
      </main>
      {assistant ? (
      <aside
        aria-label="Assistente"
        className="flex flex-col gap-4 border-t border-line bg-surface p-6 tab:col-start-2 desk:col-start-3 desk:row-start-1 desk:border-t-0 desk:border-l"
      >
        <h2 className="font-display text-lg">Assistente</h2>
        <p className="max-w-prose text-sm text-ink-2">
          Escreva um gasto ou um compromisso. A proposta aparece aqui para você
          confirmar.
        </p>
        <form
          className="grid gap-2"
          onSubmit={(event) => event.preventDefault()}
        >
          <label htmlFor="assistant-message" className="text-sm text-ink-2">
            Mensagem
          </label>
          <div className="flex gap-2">
            <input
              id="assistant-message"
              placeholder="Registre um gasto ou marque um compromisso"
              className={`min-h-10 min-w-0 flex-1 rounded-sm border border-line bg-surface px-3 text-base text-ink ${focusRing}`}
            />
            <Button type="submit" variant="primary">
              Enviar
            </Button>
          </div>
        </form>
      </aside>
      ) : null}
    </div>
  );
}
