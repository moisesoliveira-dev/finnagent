export function Stat({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1">
      <dt className="text-sm text-ink-2">{label}</dt>
      <dd className="text-lg font-semibold">{children}</dd>
    </div>
  );
}
