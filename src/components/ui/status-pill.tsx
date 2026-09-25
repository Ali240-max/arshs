"use client";
import { AnimatePresence, motion } from "motion/react";
import { CheckCircle2, CircleDashed, CircleDot } from "lucide-react";
import type { VendorPaymentStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const META: Record<VendorPaymentStatus, { label: string; cls: string; Icon: typeof CheckCircle2 }> = {
  paid: { label: "Paid", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-900", Icon: CheckCircle2 },
  partial: { label: "Partial", cls: "bg-marigold-50 text-marigold-700 ring-marigold-100 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900", Icon: CircleDot },
  pending: { label: "Pending", cls: "bg-red-50 text-red-700 ring-red-200 dark:bg-red-950/40 dark:text-red-300 dark:ring-red-900", Icon: CircleDashed },
};

/** Vendor payment status. Animates when the status changes after a payment. */
export function StatusPill({ status }: { status: VendorPaymentStatus }) {
  const m = META[status];
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.span
        key={status}
        initial={{ opacity: 0, scale: 0.7, y: 4 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.7, y: -4 }}
        transition={{ type: "spring", stiffness: 500, damping: 28 }}
        className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-semibold ring-1 ring-inset", m.cls)}
      >
        <m.Icon className="h-3.5 w-3.5" />
        {m.label}
      </motion.span>
    </AnimatePresence>
  );
}
