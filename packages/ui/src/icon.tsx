import type { SVGAttributes } from "react";

export type IconName =
  | "achievements"
  | "admin"
  | "bell"
  | "catalog"
  | "chart"
  | "circle"
  | "clock"
  | "club-building"
  | "clubs"
  | "contact"
  | "device"
  | "hub"
  | "import-export"
  | "library"
  | "members"
  | "menu"
  | "overview"
  | "pricing"
  | "privacy"
  | "profile"
  | "pulse"
  | "ratings"
  | "search"
  | "sessions"
  | "settings"
  | "sign-out"
  | "watchlist";

export interface IconProps extends Omit<SVGAttributes<SVGSVGElement>, "children"> {
  readonly name: IconName;
}

export function Icon({ name, ...props }: IconProps) {
  const common = {
    ...props,
    "aria-hidden": true,
    fill: "none",
    focusable: "false",
    viewBox: "0 0 24 24",
  } as const;

  switch (name) {
    case "achievements":
      return <svg {...common}><circle cx="12" cy="9" r="6" /><path d="m8 14-1 7 5-3 5 3-1-7" /></svg>;
    case "admin":
      return <svg {...common}><path d="M12 3l8 4v5c0 5-3.4 8.5-8 10-4.6-1.5-8-5-8-10V7z" /><path d="m9 12 2 2 4-4" /></svg>;
    case "bell":
      return <svg {...common}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></svg>;
    case "catalog":
      return <svg {...common}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2ZM8 7h8M8 10h6" /></svg>;
    case "chart":
      return <svg {...common}><path d="M6 20v-4M12 20V10M18 20V4" /></svg>;
    case "circle":
      return <svg {...common}><circle cx="12" cy="12" r="7" /></svg>;
    case "clock":
      return <svg {...common}><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>;
    case "club-building":
      return <svg {...common}><path d="M3 21h18M5 21V8l7-5 7 5v13M9 21v-6h6v6" /></svg>;
    case "clubs":
      return <svg {...common}><rect height="18" rx="2" width="18" x="3" y="3" /><path d="M9 3v18M14 8h4M14 12h4" /></svg>;
    case "contact":
      return <svg {...common}><rect height="16" rx="2" width="20" x="2" y="4" /><path d="m2 6 10 7 10-7" /></svg>;
    case "device":
      return <svg {...common}><rect height="20" rx="3" width="14" x="5" y="2" /><path d="M10 18h4" /></svg>;
    case "hub":
    case "sessions":
      return <svg {...common}><path d="M4 6h16v14H4zM4 10h16M8 3l2 3m4-3 2 3" /></svg>;
    case "import-export":
      return <svg {...common}><path d="M8 3H4v16h4m8-16h4v16h-4M7 8l5-5 5 5m-5-5v13m5 0-5 5-5-5" /></svg>;
    case "library":
      return <svg {...common}><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="2" /><path d="M12 4v3m0 10v3m8-8h-3M7 12H4" /></svg>;
    case "members":
      return <svg {...common}><circle cx="9" cy="8" r="4" /><path d="M2 21v-2a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v2m1-11a4 4 0 0 1 4 4v2" /></svg>;
    case "menu":
      return <svg {...common}><path d="M4 7h16M4 12h16M4 17h16" /></svg>;
    case "overview":
      return <svg {...common}><rect height="7" width="7" x="3" y="3" /><rect height="7" width="7" x="14" y="3" /><rect height="7" width="7" x="3" y="14" /><rect height="7" width="7" x="14" y="14" /></svg>;
    case "pricing":
      return <svg {...common}><path d="M12 2v20m5-16H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H7" /></svg>;
    case "privacy":
      return <svg {...common}><rect height="10" rx="2" width="18" x="3" y="11" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>;
    case "profile":
      return <svg {...common}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>;
    case "pulse":
      return <svg {...common}><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>;
    case "ratings":
      return <svg {...common}><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9z" /></svg>;
    case "search":
      return <svg {...common}><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>;
    case "settings":
      return <svg {...common}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1-2.9 2.9-.1-.1a1.7 1.7 0 0 0-2.8 1.2V21h-4v-.1a1.7 1.7 0 0 0-2.8-1.2l-.1.1-2.9-2.9.1-.1A1.7 1.7 0 0 0 4.6 14H4v-4h.1a1.7 1.7 0 0 0 1.2-2.8l-.1-.1 2.9-2.9.1.1A1.7 1.7 0 0 0 11 3.1V3h4v.1a1.7 1.7 0 0 0 2.8 1.2l.1-.1 2.9 2.9-.1.1a1.7 1.7 0 0 0 1.2 2.8h.1v4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>;
    case "sign-out":
      return <svg {...common}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4m7 14 5-5-5-5m5 5H9" /></svg>;
    case "watchlist":
      return <svg {...common}><path d="M6 3h12v18l-6-4-6 4z" /></svg>;
  }
}
