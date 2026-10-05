export function List({ children }: { children: React.ReactNode }) {
  return (
    <ul className="overflow-hidden rounded-lg border border-line bg-surface">
      {children}
    </ul>
  );
}
