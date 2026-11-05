import { cn } from "./cn";

/**
 * A marca do Prumo: o fio pendurado e o peso amarelo assentado na vertical, o mesmo desenho do painel de login,
 * em miniatura. O fio usa a cor do texto e o peso usa a cor da ação, então serve no claro e no escuro.
 */
export function LogoDoPrumo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("size-6 shrink-0", className)} aria-hidden fill="none">
      <path d="M12 2v10" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
      <rect x="7" y="12" width="10" height="10" className="fill-cta" />
    </svg>
  );
}
