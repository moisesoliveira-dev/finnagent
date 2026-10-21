const comum = {
  viewBox: "0 0 24 24",
  className: "size-4",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  "aria-hidden": true as const,
};

export function Icone({ name }: { name: "add" | "edit" | "remove" }) {
  if (name === "add") {
    return (
      <svg {...comum}>
        <path d="M12 5v14M5 12h14" strokeLinecap="round" />
      </svg>
    );
  }
  if (name === "edit") {
    return (
      <svg {...comum}>
        <path d="M4 20h4L18 10l-4-4L4 16v4z" strokeLinejoin="round" />
        <path d="M13 6l4 4" />
      </svg>
    );
  }
  return (
    <svg {...comum}>
      <path d="M5 7h14" strokeLinecap="round" />
      <path d="M9 7V5h6v2" strokeLinejoin="round" />
      <path d="M8 7l1 12h6l1-12" strokeLinejoin="round" />
    </svg>
  );
}
