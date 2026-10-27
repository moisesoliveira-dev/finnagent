import { cva, type VariantProps } from "class-variance-authority";
import { cn, focusRing } from "./cn";
import { PontoDeEspera } from "./esqueleto";

const button = cva(
  `inline-flex min-h-10 items-center justify-center gap-2 rounded-sm border px-4 transition-colors disabled:cursor-default disabled:opacity-50 ${focusRing}`,
  {
    variants: {
      variant: {
        primary: "etiqueta-botao border-cta bg-cta text-cta-ink! enabled:hover:brightness-95",
        default: "etiqueta-botao border-line bg-surface text-ink! enabled:hover:border-ink-2",
        quiet: "etiqueta-botao border-transparent bg-transparent text-ink-2! enabled:hover:text-ink!",
        danger: "etiqueta-botao border-neg bg-transparent text-neg! enabled:hover:bg-neg-soft",
        // Navegação dentro do texto: mantém a fonte e a caixa de quem chama.
        link: "border-transparent bg-transparent px-0 font-medium text-brand! underline-offset-4 enabled:hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

// `carregando` trava o botão e mostra o ponto de espera; quem chama troca o texto pelo gerúndio ("Cruzando").
export function Button({
  variant,
  className,
  type = "button",
  carregando = false,
  disabled,
  children,
  ...props
}: React.ComponentProps<"button"> & VariantProps<typeof button> & { carregando?: boolean }) {
  return (
    <button
      type={type}
      className={cn(button({ variant }), className)}
      disabled={disabled || carregando}
      aria-busy={carregando || undefined}
      {...props}
    >
      {carregando ? <PontoDeEspera /> : null}
      {children}
    </button>
  );
}
