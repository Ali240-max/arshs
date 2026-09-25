"use client";
import { motion } from "motion/react";
import { Info, Wallet } from "lucide-react";
import type { BalanceSummary, MonthPoint } from "@/lib/finance";
import { compactPKR, formatDate, formatPKR } from "@/lib/utils";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { BalanceSparkline } from "@/components/charts/charts";

const ease = [0.16, 1, 0.3, 1] as const;

/**
 * The signature panel. It shows the balance and the equation that produces it,
 * so anyone reading the dashboard can check the number themselves.
 */
export function BalanceHero({ s, series, openingDate }: { s: BalanceSummary; series: MonthPoint[]; openingDate: string }) {
  const available = s.opening + s.totalIn;
  const parts = [
    { key: "exp", label: "Expenses", value: s.expenses, color: "#F08A5D" },
    { key: "aid", label: "Aid given", value: s.aid, color: "#A48BFA" },
    { key: "bal", label: "Balance", value: Math.max(s.balance, 0), color: "#F3C55D" },
  ];
  const terms = [
    { label: "Opening balance", value: s.opening, sign: "", tone: "text-brand-100" },
    { label: "Money in", value: s.totalIn, sign: "+", tone: "text-emerald-300" },
    { label: "Expenses", value: s.expenses, sign: "−", tone: "text-orange-300" },
    { label: "Aid given", value: s.aid, sign: "−", tone: "text-violet-300" },
  ];

  return (
    <motion.section
      initial={{ opacity: 0, y: 16, scale: 0.99 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.6, ease }}
      className="print-card relative overflow-hidden rounded-[28px] bg-brand-950 text-white shadow-[0_30px_60px_-30px_rgba(4,31,26,.9)]"
    >
      {/* moving light */}
      <div className="pointer-events-none absolute inset-0">
        <motion.div
          className="absolute -left-24 -top-32 h-[380px] w-[380px] rounded-full bg-brand-500/40 blur-3xl"
          animate={{ x: [0, 60, 0], y: [0, 20, 0] }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute -bottom-40 right-10 h-[340px] w-[340px] rounded-full bg-marigold-500/20 blur-3xl"
          animate={{ x: [0, -50, 0] }}
          transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
        />
        <div className="absolute inset-0 opacity-[0.06] [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:20px_20px]" />
      </div>

      <div className="relative grid gap-8 p-6 sm:p-8 lg:grid-cols-[1.1fr_1fr]">
        <div>
          <div className="flex items-center gap-2 text-[13px] font-medium text-brand-100/80">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-white/10">
              <Wallet className="h-4 w-4" />
            </span>
            Current balance
            <span className="group relative">
              <Info className="h-3.5 w-3.5 opacity-60" />
              <span className="pointer-events-none absolute left-1/2 top-6 z-10 w-60 -translate-x-1/2 rounded-lg bg-black/80 p-2 text-[11.5px] font-normal leading-snug opacity-0 transition group-hover:opacity-100">
                Worked out from every posted transaction since the opening balance on {formatDate(openingDate)}. Voided entries are excluded. Page filters do not change it.
              </span>
            </span>
          </div>
          <p className="mt-3 font-display text-[44px] font-semibold leading-none tracking-[-0.03em] sm:text-[56px]">
            <AnimatedNumber value={s.balance} duration={1.8} />
          </p>
          <div className="mt-5 -mx-1 max-w-md">
            <BalanceSparkline data={series} />
          </div>
        </div>

        <div className="flex flex-col justify-end gap-5">
          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
            {terms.map((t, i) => (
              <motion.div key={t.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 + i * 0.12, duration: 0.5, ease }}>
                <p className="text-[12px] text-brand-100/70">{t.label}</p>
                <p className={`mt-0.5 font-display text-[20px] font-semibold tracking-tight ${t.tone}`}>
                  <span className="mr-1 opacity-70">{t.sign}</span>
                  <AnimatedNumber value={t.value} delay={0.3 + i * 0.12} />
                </p>
              </motion.div>
            ))}
          </div>

          {/* Where the money went: opening + in = expenses + aid + balance */}
          <div>
            <div className="flex h-3 w-full overflow-hidden rounded-full bg-white/10">
              {parts.map((p, i) => (
                <motion.div
                  key={p.key}
                  className="h-full first:rounded-l-full last:rounded-r-full"
                  style={{ background: p.color }}
                  initial={{ width: 0 }}
                  animate={{ width: available > 0 ? `${(p.value / available) * 100}%` : 0 }}
                  transition={{ delay: 0.7 + i * 0.15, duration: 1, ease }}
                  title={`${p.label}: ${formatPKR(p.value)}`}
                />
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-brand-100/80">
              <span>Of {compactPKR(available)} available so far:</span>
              {parts.map((p) => (
                <span key={p.key} className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
                  {p.label} {available > 0 ? Math.round((p.value / available) * 100) : 0}%
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </motion.section>
  );
}
