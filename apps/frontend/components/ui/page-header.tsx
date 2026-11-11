import { BotaoFlutuante } from "./botao-flutuante";

export function PageHeader({
  title,
  subtitle,
  actions,
  flutuante,
  children,
}: {
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  /** A ação principal no celular: um botão flutuante acima da barra de baixo. O `primary` de `actions` some no celular. */
  flutuante?: { rotulo: string; onClick: () => void; disabled?: boolean };
  children?: React.ReactNode;
}) {
  return (
    <>
      {flutuante ? <BotaoFlutuante rotulo={flutuante.rotulo} onClick={flutuante.onClick} disabled={flutuante.disabled} /> : null}
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-xl tab:text-2xl">{title}</h1>
          {subtitle ? <p className="mt-2 max-w-prose text-ink-2">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </header>
      {children}
    </>
  );
}
