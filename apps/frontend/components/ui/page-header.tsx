export function PageHeader({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  return (
    <>
      <header className="mb-6 flex items-baseline justify-between gap-3">
        <h1 className="font-display text-xl">{title}</h1>
        {subtitle ? <p className="text-sm text-ink-2">{subtitle}</p> : null}
      </header>
      {children}
    </>
  );
}
