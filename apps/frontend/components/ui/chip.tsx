import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "./cn";

const chip = cva(
  "inline-block rounded-sm border px-2 py-1 text-xs",
  {
    variants: {
      tone: {
        default: "border-line bg-surface-2 text-ink-2",
        ok: "border-transparent bg-brand-soft text-brand",
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
