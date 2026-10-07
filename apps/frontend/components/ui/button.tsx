import { cva, type VariantProps } from "class-variance-authority";
import { cn, focusRing } from "./cn";

// O CSS base do botão define color:inherit fora de layer e cobre text-*.
const button = cva(
  `inline-flex min-h-10 items-center justify-center rounded-sm border px-4 font-semibold disabled:cursor-default disabled:opacity-50 ${focusRing}`,
  {
    variants: {
      variant: {
        primary: "border-brand bg-brand text-brand-ink!",
        default: "border-line bg-surface text-ink!",
        quiet: "border-transparent bg-transparent text-ink-2!",
        danger: "border-neg bg-transparent text-neg!",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export function Button({
  variant,
  className,
  type = "button",
  ...props
}: React.ComponentProps<"button"> & VariantProps<typeof button>) {
  return (
    <button
      type={type}
      className={cn(button({ variant }), className)}
      {...props}
    />
  );
}
