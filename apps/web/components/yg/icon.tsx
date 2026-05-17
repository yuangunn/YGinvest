// Plan #41: YG icon set — single-color simple geometry.
// Anthropic Frontend Design plugin이 권고한 대로 Lucide 대신 custom geometry.

type IconProps = { s?: number; c?: string; className?: string };

export const YGIcon = {
  Search: ({ s = 20, c = "currentColor", className }: IconProps) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="11" cy="11" r="6.5" stroke={c} strokeWidth="2" />
      <path d="m16 16 4 4" stroke={c} strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  ChevronRight: ({ s = 16, c = "currentColor", className }: IconProps) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" className={className}>
      <path d="m9 6 6 6-6 6" stroke={c} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  ChevronDown: ({ s = 16, c = "currentColor", className }: IconProps) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" className={className}>
      <path d="m6 9 6 6 6-6" stroke={c} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Bell: ({ s = 22, c = "currentColor", className }: IconProps) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M5 17h14l-2-3v-4a5 5 0 0 0-10 0v4l-2 3Z" stroke={c} strokeWidth="2" strokeLinejoin="round" />
      <path d="M10 20a2 2 0 0 0 4 0" stroke={c} strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  Settings: ({ s = 22, c = "currentColor", className }: IconProps) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="12" cy="12" r="3" stroke={c} strokeWidth="2" />
      <path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3.9a7 7 0 0 0-2-1.2L14 3h-4l-.6 2.6a7 7 0 0 0-2 1.2l-2.3-.9-2 3.4 2 1.5A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.4 2.3-.9a7 7 0 0 0 2 1.2L10 21h4l.6-2.6a7 7 0 0 0 2-1.2l2.3.9 2-3.4-2-1.5c.1-.4.1-.8.1-1.2Z" stroke={c} strokeWidth="1.6" />
    </svg>
  ),
  Briefcase: ({ s = 22, c = "currentColor", className }: IconProps) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="3" y="7" width="18" height="13" rx="2.5" stroke={c} strokeWidth="2" />
      <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18" stroke={c} strokeWidth="2" />
    </svg>
  ),
  Chart: ({ s = 22, c = "currentColor", className }: IconProps) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M4 4v16h16" stroke={c} strokeWidth="2" strokeLinecap="round" />
      <path d="m7 14 4-4 3 3 5-7" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Book: ({ s = 22, c = "currentColor", className }: IconProps) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M4 5a2 2 0 0 1 2-2h12v17H6a2 2 0 0 1-2-2V5Z" stroke={c} strokeWidth="2" strokeLinejoin="round" />
      <path d="M4 18a2 2 0 0 1 2-2h12" stroke={c} strokeWidth="2" />
    </svg>
  ),
  Wrench: ({ s = 22, c = "currentColor", className }: IconProps) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" className={className}>
      <path d="m14.7 6.3 3 3-9.5 9.5a2.1 2.1 0 1 1-3-3l9.5-9.5Z" stroke={c} strokeWidth="2" strokeLinejoin="round" />
      <path d="M14 4a4 4 0 0 1 5.6 5.6L17 7Z" stroke={c} strokeWidth="2" strokeLinejoin="round" />
    </svg>
  ),
  Game: ({ s = 22, c = "currentColor", className }: IconProps) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="2.5" y="7" width="19" height="11" rx="3.5" stroke={c} strokeWidth="2" />
      <path d="M6.5 12h3M8 10.5v3M14 11h.01M17 13h.01" stroke={c} strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  ArrowUpRight: ({ s = 16, c = "currentColor", className }: IconProps) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M7 17 17 7M9 7h8v8" stroke={c} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Home: ({ s = 22, c = "currentColor", className }: IconProps) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" className={className}>
      <path d="m3 11 9-7 9 7v9a1 1 0 0 1-1 1h-5v-7H10v7H5a1 1 0 0 1-1-1v-9Z" stroke={c} strokeWidth="2" strokeLinejoin="round" />
    </svg>
  ),
  Sparkles: ({ s = 18, c = "currentColor", className }: IconProps) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M12 3l2 4 4 2-4 2-2 4-2-4-4-2 4-2 2-4ZM19 14l1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2Z" stroke={c} strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  ),
};

export function YGLogo({ size = 22, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-label="YGinvest">
      <rect width="24" height="24" rx="6" fill={color} />
      <path
        d="M7 6.5 L12 12.2 L17 6.5 M12 12.2 L12 17.5 M15.5 14 L18 11.6"
        stroke="#fff"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
