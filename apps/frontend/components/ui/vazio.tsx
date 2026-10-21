export function Vazio({ children }: { children: React.ReactNode }) {
  return (
    <p className="min-w-0 rounded-lg border border-line bg-surface px-4 py-6 text-sm text-ink-2">{children}</p>
  );
}
