import { cn } from "./cn";
import { ListaAnimada } from "./movimento";

export function List({
  children,
  className,
  animada = false,
}: {
  children: React.ReactNode;
  className?: string;
  // Linhas que entram em cascata: cada `ListRow` da lista leva `animado`.
  animada?: boolean;
}) {
  const classes = cn("rounded-lg border border-line bg-surface", className ?? "overflow-hidden");
  return animada ? <ListaAnimada className={classes}>{children}</ListaAnimada> : <ul className={classes}>{children}</ul>;
}
