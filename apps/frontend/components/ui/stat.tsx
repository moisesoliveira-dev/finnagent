export function Stat({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1">
      <dt className="etiqueta text-ink-2">{label}</dt>
      <dd className="font-display text-lg font-bold tracking-titulo">{children}</dd>
    </div>
  );
}
