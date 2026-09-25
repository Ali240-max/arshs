"use client";
import { motion } from "motion/react";

export function PageHeader({ title, description, actions, meta }: { title: string; description?: React.ReactNode; actions?: React.ReactNode; meta?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }} className="min-w-0">
        {meta && <div className="mb-2">{meta}</div>}
        <h1 className="font-display text-[28px] font-semibold leading-tight tracking-[-0.02em] text-ink md:text-[32px]">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-[14.5px] text-muted">{description}</p>}
      </motion.div>
      {actions && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.08, ease: [0.16, 1, 0.3, 1] }} className="flex flex-wrap items-center gap-2">
          {actions}
        </motion.div>
      )}
    </div>
  );
}
