import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "./cn";

const chip = cva(
  "etiqueta inline-block rounded-sm border px-2 py-1",
  {
    variants: {
      // O tom diz o que a etiqueta significa, não onde ela está: verde é o que deu certo, vermelho o erro ou o
      // atraso, âmbar o que espera alguém, azul a informação e a seleção, índigo a agenda, cinza o neutro.
      tone: {
        default: "border-line bg-surface-2 text-ink-2",
        ok: "border-transparent bg-pos-soft text-pos",
        info: "border-transparent bg-brand-soft text-brand",
        neg: "border-transparent bg-neg-soft text-neg",
        pending: "border-pending-line bg-pending-soft text-pending",
        event: "border-transparent bg-event-soft text-event",
        ai: "border-pending-line bg-pending-soft text-pending",
      },
    },
    defaultVariants: {
      tone: "default",
    },
  },
);

export function Chip({
  tone,
  className,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof chip>) {
  return <span className={cn(chip({ tone }), className)} {...props} />;
}
