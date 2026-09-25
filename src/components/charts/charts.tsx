"use client";
import { useState } from "react";
import { motion } from "motion/react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Sector,
  Tooltip,
  XAxis,
  YAxis,
  ReferenceLine,
} from "recharts";
import type { MonthPoint } from "@/lib/finance";
import { FLOW_COLORS } from "@/lib/constants";
import { compactPKR, formatPKR } from "@/lib/utils";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { ChartTooltip, Legend, axisProps, gridProps, yMoney } from "./chart-kit";

const EASE = "ease-out" as const;

// ---------------------------------------------------------------- Cashflow
/** Monthly money in vs money out, with net as a line. */
export function CashflowChart({ data, height = 300 }: { data: MonthPoint[]; height?: number }) {
  return (
    <div>
      <Legend
        className="mb-3"
        items={[
          { label: "Money in", color: FLOW_COLORS.in },
          { label: "Expenses", color: FLOW_COLORS.expense },
          { label: "Aid given", color: FLOW_COLORS.aid },
          { label: "Net", color: FLOW_COLORS.marigold, dashed: true },
        ]}
      />
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="g-in" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={FLOW_COLORS.in} stopOpacity={0.35} />
              <stop offset="100%" stopColor={FLOW_COLORS.in} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid {...gridProps} />
          <XAxis dataKey="label" {...axisProps} dy={6} />
          <YAxis {...yMoney} />
          <ReferenceLine y={0} stroke="var(--line-strong)" />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--surface-2)", opacity: 0.6 }} />
          <Area type="monotone" dataKey="income" name="Money in" stroke={FLOW_COLORS.in} strokeWidth={2.5} fill="url(#g-in)" animationDuration={1200} animationEasing={EASE} />
          <Bar dataKey="expense" name="Expenses" stackId="out" fill={FLOW_COLORS.expense} barSize={14} animationDuration={900} animationBegin={200} />
          <Bar dataKey="aid" name="Aid given" stackId="out" fill={FLOW_COLORS.aid} radius={[5, 5, 0, 0]} barSize={14} animationDuration={900} animationBegin={300} />
          <Line type="monotone" dataKey="net" name="Net" stroke={FLOW_COLORS.marigold} strokeWidth={2} strokeDasharray="5 4" dot={false} activeDot={{ r: 4 }} animationDuration={1400} animationBegin={400} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---------------------------------------------------------------- Balance sparkline
export function BalanceSparkline({ data, height = 70, color = "#F3C55D" }: { data: MonthPoint[]; height?: number; color?: string }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="g-spark" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.45} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Tooltip content={<ChartTooltip />} cursor={false} />
        <Area type="monotone" dataKey="balance" name="Balance" stroke={color} strokeWidth={2} fill="url(#g-spark)" animationDuration={1600} animationBegin={500} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ---------------------------------------------------------------- Donut
export interface Slice {
  name: string;
  value: number;
  color: string;
}

/** Donut with an animated centre total that switches to the hovered slice. */
export function DonutChart({ data, totalLabel = "Total", height = 220 }: { data: Slice[]; totalLabel?: string; height?: number }) {
  const [active, setActive] = useState<number | null>(null);
  const total = data.reduce((a, d) => a + d.value, 0);
  const current = active !== null ? data[active] : null;
  if (!total) return <p className="py-16 text-center text-sm text-muted">No data for this period.</p>;
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative w-full max-w-[200px] shrink-0" style={{ height: Math.min(height, 200) }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius="64%"
              outerRadius="92%"
              paddingAngle={2}
              cornerRadius={5}
              stroke="none"
              onMouseEnter={(_, i) => setActive(i)}
              onMouseLeave={() => setActive(null)}
              animationDuration={1100}
              animationEasing={EASE}
              activeShape={(p: unknown) => {
                const s = p as React.ComponentProps<typeof Sector> & { outerRadius: number };
                return <Sector {...s} outerRadius={s.outerRadius + 6} />;
              }}
            >
              {data.map((d, i) => (
                <Cell key={d.name} fill={d.color} opacity={active === null || active === i ? 1 : 0.35} style={{ transition: "opacity .2s" }} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <motion.p key={current?.name ?? "total"} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="max-w-[110px] truncate text-[11.5px] text-muted">
            {current?.name ?? totalLabel}
          </motion.p>
          <p className="font-display text-[19px] font-semibold tracking-tight">
            <AnimatedNumber value={current?.value ?? total} format={compactPKR} duration={0.6} />
          </p>
          {current && <p className="num text-[11.5px] text-muted">{Math.round((current.value / total) * 100)}%</p>}
        </div>
      </div>
      <ul className="w-full min-w-0 space-y-1.5">
        {data.map((d, i) => (
          <li
            key={d.name}
            onMouseEnter={() => setActive(i)}
            onMouseLeave={() => setActive(null)}
            className="flex cursor-default items-center gap-2 rounded-lg px-2 py-1 text-[13px] transition hover:bg-surface-2"
            style={{ opacity: active === null || active === i ? 1 : 0.5 }}
          >
            <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: d.color }} />
            <span className="min-w-0 flex-1 truncate text-ink-2">{d.name}</span>
            <span className="num text-muted">{Math.round((d.value / total) * 100)}%</span>
            <span className="num w-[84px] text-right font-medium">{compactPKR(d.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------- Event performance
export interface EventBar {
  name: string;
  revenue: number;
  spend: number;
  net: number;
}
export function EventPerformanceChart({ data, height = 300 }: { data: EventBar[]; height?: number }) {
  return (
    <div>
      <Legend className="mb-3" items={[{ label: "Revenue", color: FLOW_COLORS.in }, { label: "Expenses + aid", color: FLOW_COLORS.expense }, { label: "Net", color: FLOW_COLORS.net }]} />
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={3}>
          <CartesianGrid {...gridProps} />
          <XAxis dataKey="name" {...axisProps} interval={0} tick={{ fill: "var(--muted)", fontSize: 11 }} tickFormatter={(v: string) => (v.length > 14 ? v.slice(0, 13) + "…" : v)} dy={6} />
          <YAxis {...yMoney} />
          <ReferenceLine y={0} stroke="var(--line-strong)" />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--surface-2)", opacity: 0.6 }} />
          <Bar dataKey="revenue" name="Revenue" fill={FLOW_COLORS.in} radius={[5, 5, 0, 0]} maxBarSize={22} animationDuration={900} />
          <Bar dataKey="spend" name="Expenses + aid" fill={FLOW_COLORS.expense} radius={[5, 5, 0, 0]} maxBarSize={22} animationDuration={900} animationBegin={150} />
          <Bar dataKey="net" name="Net" radius={[5, 5, 0, 0]} maxBarSize={22} animationDuration={900} animationBegin={300}>
            {data.map((d) => (
              <Cell key={d.name} fill={d.net >= 0 ? FLOW_COLORS.net : "#9B2C1C"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---------------------------------------------------------------- Donation trend
export function DonationTrendChart({ data, height = 240 }: { data: MonthPoint[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="g-don" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={FLOW_COLORS.marigold} stopOpacity={0.9} />
            <stop offset="100%" stopColor={FLOW_COLORS.marigold} stopOpacity={0.35} />
          </linearGradient>
        </defs>
        <CartesianGrid {...gridProps} />
        <XAxis dataKey="label" {...axisProps} dy={6} />
        <YAxis yAxisId="amt" {...yMoney} />
        <YAxis yAxisId="cnt" orientation="right" {...axisProps} width={28} allowDecimals={false} />
        <Tooltip
          content={
            <ChartTooltip
              format={(n) => formatPKR(n)}
              footer={(p) => <span className="text-muted">{String((p[0]?.payload as { donationCount?: number })?.donationCount ?? 0)} donations</span>}
            />
          }
          cursor={{ fill: "var(--surface-2)", opacity: 0.6 }}
        />
        <Bar yAxisId="amt" dataKey="donations" name="Donations" fill="url(#g-don)" radius={[6, 6, 0, 0]} maxBarSize={30} animationDuration={1000} />
        <Line yAxisId="cnt" dataKey="donationCount" name="Count" stroke={FLOW_COLORS.net} strokeWidth={2} dot={{ r: 2.5 }} type="monotone" legendType="none" animationDuration={1300} animationBegin={300} tooltipType="none" />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

// ---------------------------------------------------------------- Vendor collections
export interface VendorBar {
  name: string;
  collected: number;
  outstanding: number;
}
export function VendorCollectionChart({ data, height = 260 }: { data: VendorBar[]; height?: number }) {
  return (
    <div>
      <Legend className="mb-3" items={[{ label: "Collected", color: FLOW_COLORS.net }, { label: "Still owed", color: FLOW_COLORS.marigold }]} />
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="var(--line)" strokeDasharray="3 4" horizontal={false} />
          <XAxis type="number" {...axisProps} tickFormatter={(v: number) => compactPKR(v)} />
          <YAxis type="category" dataKey="name" {...axisProps} width={130} tickFormatter={(v: string) => (v.length > 18 ? v.slice(0, 17) + "…" : v)} />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--surface-2)", opacity: 0.6 }} />
          <Bar dataKey="collected" name="Collected" stackId="v" fill={FLOW_COLORS.net} barSize={16} animationDuration={1000} />
          <Bar dataKey="outstanding" name="Still owed" stackId="v" fill={FLOW_COLORS.marigold} radius={[0, 5, 5, 0]} barSize={16} animationDuration={1000} animationBegin={250} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---------------------------------------------------------------- Event timeline
export interface TimelinePoint {
  label: string;
  cumIn: number;
  cumOut: number;
  net: number;
}
/** Running totals over the life of one event. */
export function EventTimelineChart({ data, height = 260 }: { data: TimelinePoint[]; height?: number }) {
  if (!data.length) return <p className="py-16 text-center text-sm text-muted">No money recorded for this event yet.</p>;
  return (
    <div>
      <Legend className="mb-3" items={[{ label: "Money in (running)", color: FLOW_COLORS.in }, { label: "Money out (running)", color: FLOW_COLORS.expense }, { label: "Net", color: FLOW_COLORS.marigold, dashed: true }]} />
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="g-tin" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={FLOW_COLORS.in} stopOpacity={0.3} />
              <stop offset="100%" stopColor={FLOW_COLORS.in} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="g-tout" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={FLOW_COLORS.expense} stopOpacity={0.25} />
              <stop offset="100%" stopColor={FLOW_COLORS.expense} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid {...gridProps} />
          <XAxis dataKey="label" {...axisProps} dy={6} />
          <YAxis {...yMoney} />
          <Tooltip content={<ChartTooltip />} />
          <Area type="stepAfter" dataKey="cumIn" name="Money in" stroke={FLOW_COLORS.in} strokeWidth={2} fill="url(#g-tin)" animationDuration={1300} />
          <Area type="stepAfter" dataKey="cumOut" name="Money out" stroke={FLOW_COLORS.expense} strokeWidth={2} fill="url(#g-tout)" animationDuration={1300} animationBegin={200} />
          <Line type="stepAfter" dataKey="net" name="Net" stroke={FLOW_COLORS.marigold} strokeWidth={2} strokeDasharray="5 4" dot={false} animationDuration={1500} animationBegin={400} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---------------------------------------------------------------- Budget bars
export function BudgetBarChart({ data, height = 260 }: { data: { name: string; budget: number; spent: number }[]; height?: number }) {
  return (
    <div>
      <Legend className="mb-3" items={[{ label: "Budget", color: "var(--line-strong)" }, { label: "Spent", color: FLOW_COLORS.expense }]} />
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={-18}>
          <CartesianGrid {...gridProps} />
          <XAxis dataKey="name" {...axisProps} interval={0} tick={{ fill: "var(--muted)", fontSize: 11 }} tickFormatter={(v: string) => (v.length > 14 ? v.slice(0, 13) + "…" : v)} dy={6} />
          <YAxis {...yMoney} />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--surface-2)", opacity: 0.6 }} />
          <Bar dataKey="budget" name="Budget" fill="var(--line-strong)" radius={[6, 6, 0, 0]} barSize={18} animationDuration={800} />
          <Bar dataKey="spent" name="Spent" radius={[6, 6, 0, 0]} barSize={18} animationDuration={1100} animationBegin={250}>
            {data.map((d) => (
              <Cell key={d.name} fill={d.spent > d.budget ? "#B42318" : FLOW_COLORS.expense} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
