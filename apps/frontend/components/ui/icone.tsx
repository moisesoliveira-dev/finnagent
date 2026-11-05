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
  name:
    | "add"
    | "bell"
    | "calc"
    | "calendar"
    | "chart"
    | "chat"
    | "check"
    | "chevron"
    | "clip"
    | "clock"
    | "dashboard"
    | "edit"
    | "file"
    | "gear"
    | "layers"
    | "mic"
    | "pin"
    | "sair"
    | "send"
    | "stop"
    | "target"
    | "wallet" | "remove" | "refresh" | "search" | "upload";
}) {
  if (name === "calc") {
    return (
      <svg {...comum}>
        <rect x="5" y="3" width="14" height="18" />
        <path d="M8 7h8M8 12h1M12 12h1M16 12h0M8 16h1M12 16h1M16 15v2" strokeLinecap="round" />
      </svg>
    );
  }
  if (name === "dashboard") {
    return (
      <svg {...comum}>
        <rect x="4" y="4" width="7" height="7" />
        <rect x="13" y="4" width="7" height="7" />
        <rect x="4" y="13" width="7" height="7" />
        <rect x="13" y="13" width="7" height="7" />
      </svg>
    );
  }
  if (name === "chat") {
    return (
      <svg {...comum}>
        <path d="M4 5h16v11H9l-5 4V5z" strokeLinejoin="round" />
      </svg>
    );
  }
  if (name === "calendar") {
    return (
      <svg {...comum}>
        <rect x="4" y="5" width="16" height="15" />
        <path d="M4 10h16M8 3v4M16 3v4" strokeLinecap="round" />
      </svg>
    );
  }
  if (name === "wallet") {
    return (
      <svg {...comum}>
        <path d="M4 7h14v12H4zM4 7V5h11v2M14 12h4v3h-4z" strokeLinejoin="round" />
      </svg>
    );
  }
  if (name === "layers") {
    return (
      <svg {...comum}>
        <path d="M12 4l8 4-8 4-8-4 8-4zM4 12l8 4 8-4M4 16l8 4 8-4" strokeLinejoin="round" />
      </svg>
    );
  }
  if (name === "target") {
    return (
      <svg {...comum}>
        <circle cx="12" cy="12" r="8" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="12" cy="12" r="1" fill="currentColor" />
      </svg>
    );
  }
  if (name === "chart") {
    return (
      <svg {...comum}>
        <path d="M5 20V10M12 20V4M19 20v-7" strokeLinecap="round" />
      </svg>
    );
  }
  if (name === "clock") {
    return (
      <svg {...comum}>
        <circle cx="12" cy="12" r="8" />
        <path d="M12 8v4l3 2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (name === "file") {
    return (
      <svg {...comum}>
        <path d="M6 3h8l4 4v14H6z" strokeLinejoin="round" />
        <path d="M14 3v4h4M9 12h6M9 16h6" strokeLinecap="round" />
      </svg>
    );
  }
  if (name === "check") {
    return (
      <svg {...comum}>
        <rect x="4" y="4" width="16" height="16" />
        <path d="M8 12l3 3 5-6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (name === "gear") {
    return (
      <svg {...comum}>
        <circle cx="12" cy="12" r="3" />
        <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" strokeLinecap="round" />
      </svg>
    );
  }
  if (name === "chevron") {
    return (
      <svg {...comum}>
        <path d="M14 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (name === "sair") {
    return (
      <svg {...comum}>
        <path d="M10 4H5v16h5M14 8l4 4-4 4M18 12H9" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (name === "pin") {
    return (
      <svg {...comum}>
        <path d="M9 4h6l-1 6 3 3v2H7v-2l3-3-1-6zM12 15v6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (name === "send") {
    return (
      <svg {...comum}>
        <path d="M12 19V5M6 11l6-6 6 6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (name === "stop") {
    return (
      <svg {...comum}>
        <rect x="6" y="6" width="12" height="12" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  if (name === "mic") {
    return (
      <svg {...comum}>
        <rect x="9" y="3" width="6" height="11" rx="3" />
        <path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6" strokeLinecap="round" strokeLinejoin="round" />
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
