import { cva, type VariantProps } from "class-variance-authority";
import { cn, focusRing } from "./cn";

const button = cva(
  `inline-flex min-h-10 items-center justify-center rounded-sm border px-4 font-semibold ${focusRing}`,
  {
    variants: {
      variant: {
        primary: "border-brand bg-brand text-brand-ink",
        default: "border-line bg-surface text-ink",
        quiet: "border-transparent bg-transparent text-ink-2",
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
