const comum = {
  viewBox: "0 0 24 24",
  className: "size-4",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  "aria-hidden": true as const,
};

export function Icone({
  name,
}: {
  name: "add" | "bell" | "calc" | "clip" | "edit" | "remove" | "refresh" | "search" | "upload";
}) {
  if (name === "calc") {
    return (
      <svg {...comum}>
        <rect x="5" y="3" width="14" height="18" />
        <path d="M8 7h8M8 12h1M12 12h1M16 12h0M8 16h1M12 16h1M16 15v2" strokeLinecap="round" />
      </svg>
    );
  }
  if (name === "clip") {
    return (
      <svg {...comum}>
        <path d="M21 11.5l-8.6 8.6a5 5 0 0 1-7-7l9-9a3.3 3.3 0 0 1 4.7 4.7l-9 9a1.7 1.7 0 0 1-2.4-2.4l8.3-8.3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (name === "bell") {
    return (
      <svg {...comum}>
        <path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4l2-2z" strokeLinejoin="round" />
        <path d="M10 20a2 2 0 0 0 4 0" strokeLinecap="round" />
      </svg>
    );
  }
  if (name === "upload") {
    return (
      <svg {...comum}>
        <path d="M12 16V5M7 10l5-5 5 5M5 19h14" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (name === "search") {
    return (
      <svg {...comum}>
        <circle cx="11" cy="11" r="6" />
        <path d="M20 20l-4.5-4.5" strokeLinecap="round" />
      </svg>
    );
  }
  if (name === "add") {
    return (
      <svg {...comum}>
        <path d="M12 5v14M5 12h14" strokeLinecap="round" />
      </svg>
    );
  }
  if (name === "refresh") {
    return (
      <svg {...comum}>
        <path d="M21 12a9 9 0 1 1-2.64-6.36" strokeLinecap="round" />
        <path d="M21 4v5h-5" strokeLinecap="round" strokeLinejoin="round" />
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
