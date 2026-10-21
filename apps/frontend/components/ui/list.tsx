import { cn } from "./cn";

export function List({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <ul className={cn("rounded-lg border border-line bg-surface", className ?? "overflow-hidden")}>
      {children}
    </ul>
  );
}
