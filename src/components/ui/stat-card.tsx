"use client";
import { motion } from "motion/react";
import { AnimatedNumber } from "./animated-number";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  icon,
  accent = "var(--color-brand-600)",
  sub,
  index = 0,
  format,
  className,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  accent?: string;
  sub?: React.ReactNode;
  index?: number;
  format?: (n: number) => string;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.05 * index, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -3 }}
      className={cn("print-card group relative overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-[var(--shadow-card)] transition-shadow hover:shadow-[var(--shadow-lift)]", className)}
    >
      <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-[0.12] blur-2xl transition-opacity group-hover:opacity-25" style={{ background: accent }} />
      <div className="flex items-center gap-2.5">
        <span className="grid h-8 w-8 place-items-center rounded-lg" style={{ background: `color-mix(in oklab, ${accent} 14%, transparent)`, color: accent }}>
          {icon}
        </span>
        <span className="text-[13px] font-medium text-muted">{label}</span>
      </div>
      <div className="mt-3 font-display text-[24px] font-semibold tracking-tight text-ink">
        <AnimatedNumber value={value} format={format} delay={0.05 * index} />
      </div>
      {sub && <div className="mt-1 text-[12.5px] text-muted">{sub}</div>}
    </motion.div>
  );
}
