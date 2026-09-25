"use client";
import { motion } from "motion/react";
import { ArrowDownLeft, ArrowUpRight, BadgeCheck, HandHeart, HeartHandshake, ReceiptText } from "lucide-react";
import type { Transaction } from "@/lib/types";
import { useLookups } from "@/lib/hooks";
import { useUI } from "@/lib/ui-store";
import { KIND_META } from "@/lib/constants";
import { cn, formatDate } from "@/lib/utils";
import { Money } from "@/components/ui/money";

export const KIND_ICON = {
  vendor_payment: { Icon: ReceiptText, cls: "bg-brand-50 text-brand-700 dark:bg-brand-900/50 dark:text-brand-200" },
  donation: { Icon: HandHeart, cls: "bg-marigold-50 text-marigold-700 dark:bg-amber-950/40 dark:text-amber-300" },
  income: { Icon: ArrowDownLeft, cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" },
  expense: { Icon: ArrowUpRight, cls: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300" },
  distribution: { Icon: HeartHandshake, cls: "bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300" },
} as const;

export function KindIcon({ kind, className }: { kind: Transaction["kind"]; className?: string }) {
  const { Icon, cls } = KIND_ICON[kind];
  return (
    <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl", cls, className)}>
      <Icon className="h-4 w-4" />
    </span>
  );
}

/** Compact list of transactions; clicking a row opens the detail sheet. */
export function TxnList({ txns, empty = "No transactions yet." }: { txns: Transaction[]; empty?: string }) {
  const L = useLookups();
  const open = useUI((s) => s.open);
  if (!txns.length) return <p className="px-5 py-10 text-center text-sm text-muted">{empty}</p>;
  return (
    <ul className="divide-y divide-line">
      {txns.map((t, i) => {
        const who = t.counterparty || L.donationByTxn.get(t.id)?.donorName || L.distributionByTxn.get(t.id)?.recipientName;
        return (
          <motion.li key={t.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.03 * i, duration: 0.3 }}>
            <button onClick={() => open({ kind: "txn", txnId: t.id })} className="group flex w-full items-center gap-3 px-5 py-3 text-left transition hover:bg-surface-2">
              <KindIcon kind={t.kind} className="transition-transform group-hover:scale-105" />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 text-[13.5px] font-medium">
                  <span className="truncate">{who || t.description}</span>
                  {t.verifiedAt && <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-brand-500" aria-label="Verified" />}
                </span>
                <span className="block truncate text-[12px] text-muted">
                  {t.code} · {KIND_META[t.kind].label}
                  {t.eventId ? ` · ${L.event.get(t.eventId)?.name}` : ""}
                </span>
              </span>
              <span className="text-right">
                <Money amount={t.amount} direction={t.direction} kind={t.kind} muted={t.status === "void"} className="block text-[13.5px]" />
                <span className="block text-[11.5px] text-muted">{formatDate(t.date)}</span>
              </span>
            </button>
          </motion.li>
        );
      })}
    </ul>
  );
}
