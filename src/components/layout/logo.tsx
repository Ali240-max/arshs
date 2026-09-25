import { cn } from "@/lib/utils";

/** Society mark: a marigold heart on Rizvi green. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={cn("h-9 w-9 shrink-0", className)} aria-hidden>
      <defs>
        <linearGradient id="lg-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#16806A" />
          <stop offset="1" stopColor="#08342B" />
        </linearGradient>
        <linearGradient id="lg-heart" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#F3C55D" />
          <stop offset="1" stopColor="#E9A21B" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="18" fill="url(#lg-bg)" />
      <path d="M32 47c-9-6-15-11.5-15-18.5A8.5 8.5 0 0 1 32 23a8.5 8.5 0 0 1 15 5.5C47 35.5 41 41 32 47Z" fill="url(#lg-heart)" />
      <path d="M22 50c4 2 16 2 20 0" stroke="#A3D6C5" strokeWidth="2.5" strokeLinecap="round" fill="none" opacity=".7" />
    </svg>
  );
}
