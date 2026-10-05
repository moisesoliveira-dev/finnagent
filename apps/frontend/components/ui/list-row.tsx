import { cva, type VariantProps } from "class-variance-authority";

const row = cva(
  "flex min-w-0 items-center gap-3 border-b border-line px-4 py-3 last:border-b-0",
  {
    variants: {
      kind: {
        transaction: "",
        event: "border-l-4 border-l-event",
      },
    },
    defaultVariants: {
      kind: "transaction",
    },
  },
);

export function ListRow({
  kind,
  time,
  title,
  meta,
  value,
}: {
  time: string;
  title: string;
  meta?: React.ReactNode;
  value: React.ReactNode;
} & VariantProps<typeof row>) {
  return (
    <li className={row({ kind })}>
      <time className="text-sm text-ink-2">{time}</time>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="font-medium">{title}</span>
        {meta ? (
          <span className="flex flex-wrap gap-2 text-sm text-ink-2">{meta}</span>
        ) : null}
      </div>
      <span className="text-right">{value}</span>
    </li>
  );
}
