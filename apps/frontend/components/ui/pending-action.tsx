import { cva, type VariantProps } from "class-variance-authority";
import { Chip } from "./chip";

const pending = cva("grid gap-3 rounded-md border p-4", {
  variants: {
    state: {
      open: "border-dashed border-pending-line bg-pending-soft",
      done: "border-brand bg-brand-soft",
      gone: "border-line bg-surface-2 opacity-60",
    },
  },
  defaultVariants: {
    state: "open",
  },
});

export function PendingAction({
  state,
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
} & VariantProps<typeof pending>) {
  return (
    <article className={pending({ state })}>
      {(state ?? "open") === "open" ? (
        <Chip tone="ai" className="justify-self-start font-normal">
          Sugerido pela IA
        </Chip>
      ) : null}
      <strong className="font-semibold">{title}</strong>
      {children}
    </article>
  );
}
