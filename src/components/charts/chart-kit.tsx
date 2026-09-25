"use client";
import { cn, compactPKR, formatPKR } from "@/lib/utils";

export const axisProps = {
  tick: { fill: "var(--muted)", fontSize: 12 },
  tickLine: false,
  axisLine: false,
} as const;

export const gridProps = { stroke: "var(--line)", strokeDasharray: "3 4", vertical: false } as const;

export const yMoney = { ...axisProps, tickFormatter: (v: number) => compactPKR(v), width: 52 } as const;

interface TipEntry {
  name?: string | number;
  value?: number | string | (number | string)[];
  color?: string;
  dataKey?: string | number | ((obj: unknown) => unknown);
  payload?: Record<string, unknown>;
}

/** Glassy tooltip used by every chart. */
export function ChartTooltip({
  active,
  payload,
  label,
  format = (n: number) => formatPKR(n),
  footer,
}: {
  active?: boolean;
  payload?: TipEntry[];
  label?: string | number;
  format?: (n: number) => string;
  footer?: (p: TipEntry[]) => React.ReactNode;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass min-w-[180px] rounded-xl border border-line px-3 py-2.5 text-[12.5px] shadow-[var(--shadow-lift)]">
      {label !== undefined && label !== "" && <p className="mb-1.5 font-medium text-ink">{label}</p>}
      <div className="space-y-1">
        {payload.map((p, i) => (
          <div key={i} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-muted">
              <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
              {p.name}
            </span>
            <span className="num font-semibold text-ink">{format(Number(p.value))}</span>
          </div>
        ))}
      </div>
      {footer && <div className="mt-1.5 border-t border-line pt-1.5">{footer(payload)}</div>}
    </div>
  );
}

export function Legend({ items, className }: { items: { label: string; color: string; dashed?: boolean }[]; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-muted", className)}>
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5">
          {i.dashed ? (
            <span className="h-0 w-3.5 border-t-2 border-dashed" style={{ borderColor: i.color }} />
          ) : (
            <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: i.color }} />
          )}
          {i.label}
        </span>
      ))}
    </div>
  );
}
