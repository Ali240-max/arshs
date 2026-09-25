import { cn } from "@/lib/utils";

export type Tone = "neutral" | "brand" | "inflow" | "coral" | "violet" | "marigold" | "outline";
const TONE: Record<Tone, string> = {
  neutral: "bg-surface-2 text-ink-2 ring-line",
  brand: "bg-brand-50 text-brand-700 ring-brand-200 dark:bg-brand-900/40 dark:text-brand-200 dark:ring-brand-800",
  inflow: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-900",
  coral: "bg-red-50 text-red-700 ring-red-200 dark:bg-red-950/40 dark:text-red-300 dark:ring-red-900",
  violet: "bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:ring-violet-900",
  marigold: "bg-marigold-50 text-marigold-700 ring-marigold-100 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900",
  outline: "bg-transparent text-muted ring-line-strong",
};

export function Badge({ tone = "neutral", className, children, dot }: { tone?: Tone; className?: string; children: React.ReactNode; dot?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[12px] font-medium ring-1 ring-inset", TONE[tone], className)}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />}
      {children}
    </span>
  );
}
