// Line-icon set ported from Brief 0 / Brief 2 (no third-party icon library).
// Pure SVG components — no hooks, no client directive needed.
import type { SVGProps } from "react";

type IcoProps = {
  size?: number;
  /** Stroke width override. */
  sw?: number;
  /** Render as a filled glyph (for the active "liked"/"bookmarked" state). */
  fill?: boolean;
};

/** Base 24×24 line icon wrapper. */
export function Svg({
  children,
  fill,
  size = 18,
  sw = 2,
  ...rest
}: IcoProps & { children: React.ReactNode } & Omit<SVGProps<SVGSVGElement>, "fill">) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...rest}
    >
      {children}
    </svg>
  );
}

/* ---- Action-bar icons (Brief 0) ---- */
export const IconReply = (p: IcoProps) => (
  <Svg {...p}>
    <path d="M4 4h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H10l-5 4v-4H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" />
  </Svg>
);
export const IconRetweet = (p: IcoProps) => (
  <Svg {...p}>
    <path d="M7 7h9a2 2 0 0 1 2 2v5" />
    <path d="m20 11-3 3-3-3" />
    <path d="M17 17H8a2 2 0 0 1-2-2v-5" />
    <path d="m4 13 3-3 3 3" />
  </Svg>
);
/** @-glyph for Mention notifications (Module 9B). */
export const IconAt = (p: IcoProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94" />
  </Svg>
);
export const IconLike = ({ on, ...p }: IcoProps & { on?: boolean }) => (
  <Svg fill={on} {...p}>
    <path d="M12 20.5S3.5 15.5 3.5 9.5C3.5 6.6 5.8 4.5 8.4 4.5c1.7 0 3.1 1 3.6 2.4C12.5 5.5 13.9 4.5 15.6 4.5c2.6 0 4.9 2.1 4.9 5 0 6-8.5 11-8.5 11z" />
  </Svg>
);
export const IconBookmark = ({ on, ...p }: IcoProps & { on?: boolean }) => (
  <Svg fill={on} {...p}>
    <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z" />
  </Svg>
);
export const IconShare = (p: IcoProps) => (
  <Svg {...p}>
    <path d="M12 3v12" />
    <path d="m8 7 4-4 4 4" />
    <path d="M5 12v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7" />
  </Svg>
);
export const IconMore = (p: IcoProps) => (
  <Svg {...p}>
    <circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none" />
  </Svg>
);
export const IconTrash = (p: IcoProps) => (
  <Svg {...p}>
    <path d="M4 7h16" />
    <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    <path d="M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" />
    <path d="M10 11v6M14 11v6" />
  </Svg>
);

/* ---- Nav / chrome icons (Brief 2) ---- */
export const IconHome = ({ on }: { on?: boolean }) => (
  <Svg fill={on}>
    <path d="M3 11.2 12 4l9 7.2V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
  </Svg>
);
export const IconExplore = () => (
  <Svg>
    <path d="M10 4h4M4 10v4M20 10v4M10 20h4M4 4l3 3M20 4l-3 3M4 20l3-3M20 20l-3-3" />
    <circle cx="12" cy="12" r="3.4" />
  </Svg>
);
export const IconBell = () => (
  <Svg>
    <path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6z" />
    <path d="M10.5 19a1.6 1.6 0 0 0 3 0" />
  </Svg>
);
export const IconMail = () => (
  <Svg>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="m3.5 7 8.5 6 8.5-6" />
  </Svg>
);
export const IconUser = () => (
  <Svg>
    <circle cx="12" cy="8" r="3.6" />
    <path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6" />
  </Svg>
);
export const IconPersonPlus = (p: IcoProps) => (
  <Svg {...p}>
    <circle cx="9" cy="8" r="3.4" />
    <path d="M3 20c0-3.3 2.7-5.6 6-5.6 1 0 2 .2 2.8.6" />
    <path d="M18 13v6M15 16h6" />
  </Svg>
);
export const IconMoreCircle = () => (
  <Svg>
    <circle cx="12" cy="12" r="9" />
    <circle cx="8" cy="12" r="1" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
    <circle cx="16" cy="12" r="1" fill="currentColor" stroke="none" />
  </Svg>
);
export const IconSearch = (p: IcoProps) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.2-3.2" />
  </Svg>
);
export const IconPlus = () => (
  <Svg sw={2.4}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);

/* ---- Compose-row icons (Brief 2) — visual only in 2B ---- */
export const IconImage = () => (
  <Svg size={20}>
    <rect x="3" y="4" width="18" height="16" rx="3" />
    <circle cx="8.5" cy="9.5" r="1.6" />
    <path d="m4 18 5-5 4 3.5 3-2.5 5 4" />
  </Svg>
);
export const IconGif = () => (
  <svg width="22" height="22" viewBox="0 0 24 24">
    <rect
      x="2.5"
      y="6"
      width="19"
      height="12"
      rx="3"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    />
    <text
      x="12"
      y="15.5"
      textAnchor="middle"
      fontSize="7.5"
      fontWeight="800"
      fill="currentColor"
      fontFamily="var(--font)"
    >
      GIF
    </text>
  </svg>
);
export const IconPoll = () => (
  <Svg size={20}>
    <path d="M6 20V11M12 20V4M18 20v-6" />
  </Svg>
);
export const IconEmoji = () => (
  <Svg size={20}>
    <circle cx="12" cy="12" r="9" />
    <path d="M8.5 14.5a4.5 4.5 0 0 0 7 0" />
    <circle cx="9" cy="10" r="1" fill="currentColor" stroke="none" />
    <circle cx="15" cy="10" r="1" fill="currentColor" stroke="none" />
  </Svg>
);
export const IconSchedule = () => (
  <Svg size={20}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7.5V12l3 2" />
  </Svg>
);
export const IconBack = () => (
  <Svg size={22}>
    <path d="M19 12H5" />
    <path d="m12 19-7-7 7-7" />
  </Svg>
);
export const IconCalendar = (p: IcoProps) => (
  <Svg {...p}>
    <rect x="3.5" y="5" width="17" height="16" rx="2" />
    <path d="M3.5 9.5h17M8 3.5v3M16 3.5v3" />
  </Svg>
);
export const IconClose = (p: IcoProps) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Svg>
);
export const IconCamera = (p: IcoProps) => (
  <Svg {...p}>
    <path d="M4 8a2 2 0 0 1 2-2h1.5l1-1.6A1 1 0 0 1 9.4 4h5.2a1 1 0 0 1 .9.5L16.5 6H18a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
    <circle cx="12" cy="13" r="3.2" />
  </Svg>
);
