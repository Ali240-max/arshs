"use client";
import { useMemo } from "react";
import { CalendarDays, X } from "lucide-react";
import { useApp } from "@/lib/store";
import { cn, pad, todayISO } from "@/lib/utils";
import { Tabs } from "@/components/ui/tabs";

export type PeriodPreset = "month" | "3m" | "12m" | "all" | "custom";
export interface Period {
  preset: PeriodPreset;
  from: string;
  to: string;
}

/**
 * The date everything is relative to. Normally today. In demo mode we use the latest
 * transaction date if it is later, so the demo never looks empty.
 */
export function useAnchorDate() {
  const txns = useApp((s) => s.data.transactions);
  const mode = useApp((s) => s.mode);
  return useMemo(() => {
    const today = todayISO();
    if (mode !== "demo") return today;
    const latest = txns.reduce((m, t) => (t.date > m ? t.date : m), "");
    return latest > today ? latest : today;
  }, [txns, mode]);
}

export function useEarliestDate() {
  const txns = useApp((s) => s.data.transactions);
  const opening = useApp((s) => s.data.settings.openingBalanceDate);
  return useMemo(() => txns.reduce((m, t) => (t.date < m ? t.date : m), opening || todayISO()), [txns, opening]);
}

export function periodFor(preset: PeriodPreset, anchor: string, earliest: string): Pick<Period, "from" | "to"> {
  const [y, m] = anchor.split("-").map(Number);
  const back = (months: number) => {
    const d = new Date(y, m - 1 - months, 1);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`;
  };
  switch (preset) {
    case "month":
      return { from: back(0), to: anchor };
    case "3m":
      return { from: back(2), to: anchor };
    case "12m":
      return { from: back(11), to: anchor };
    default:
      return { from: earliest, to: anchor };
  }
}

export function usePeriod(preset: PeriodPreset, custom?: { from: string; to: string }): Period {
  const anchor = useAnchorDate();
  const earliest = useEarliestDate();
  if (preset === "custom" && custom) return { preset, ...custom };
  return { preset, ...periodFor(preset, anchor, earliest) };
}

export function PeriodPicker({
  value,
  onChange,
  custom,
  onCustom,
  className,
}: {
  value: PeriodPreset;
  onChange: (p: PeriodPreset) => void;
  custom: { from: string; to: string };
  onCustom: (c: { from: string; to: string }) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <Tabs
        size="sm"
        value={value}
        onChange={onChange}
        items={[
          { value: "month", label: "This month" },
          { value: "3m", label: "3 months" },
          { value: "12m", label: "12 months" },
          { value: "all", label: "All time" },
          { value: "custom", label: <><CalendarDays className="h-3.5 w-3.5" /> Custom</> },
        ]}
      />
      {value === "custom" && (
        <div className="flex items-center gap-1.5 rounded-xl border border-line bg-surface px-2 py-1">
          <input type="date" aria-label="From" value={custom.from} onChange={(e) => onCustom({ ...custom, from: e.target.value })} className="bg-transparent text-[13px] outline-none" />
          <span className="text-muted">to</span>
          <input type="date" aria-label="To" value={custom.to} onChange={(e) => onCustom({ ...custom, to: e.target.value })} className="bg-transparent text-[13px] outline-none" />
        </div>
      )}
    </div>
  );
}

/** A compact select used in filter bars. */
export function FilterSelect({
  value,
  onChange,
  options,
  placeholder,
  label,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
  label: string;
  className?: string;
}) {
  const active = !!value;
  return (
    <div className={cn("relative", className)}>
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "h-9 w-full appearance-none rounded-xl border bg-surface pl-3 pr-8 text-[13px] outline-none transition hover:border-line-strong focus:border-brand-400",
          active ? "border-brand-300 font-medium text-brand-800 dark:border-brand-700 dark:text-brand-200" : "border-line text-ink-2",
        )}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {active ? (
        <button onClick={() => onChange("")} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted hover:text-ink" aria-label={`Clear ${label}`}>
          <X className="h-3.5 w-3.5" />
        </button>
      ) : (
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted">▼</span>
      )}
    </div>
  );
}
