"use client";
import { motion } from "motion/react";
import { useMemo } from "react";
import { Banknote, Building2, Smartphone, Wallet } from "lucide-react";
import type { PaymentMethod, TxnKind } from "@/lib/types";
import { METHOD_LABEL } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Select } from "@/components/ui/field";
import { useApp } from "@/lib/store";

const METHOD_ICON: Record<PaymentMethod, typeof Banknote> = {
  cash: Banknote,
  bank_transfer: Building2,
  easypaisa: Smartphone,
  jazzcash: Smartphone,
  cheque: Wallet,
  other: Wallet,
};

/** One-tap payment method picker. Faster than a dropdown at a busy stall. */
export function MethodPicker({ value, onChange, methods = ["cash", "easypaisa", "jazzcash", "bank_transfer", "cheque", "other"] }: { value: PaymentMethod; onChange: (m: PaymentMethod) => void; methods?: PaymentMethod[] }) {
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {methods.map((m) => {
        const Icon = METHOD_ICON[m];
        const active = m === value;
        return (
          <button
            key={m}
            type="button"
            onClick={() => onChange(m)}
            className={cn(
              "relative flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-[12.5px] font-medium transition",
              active ? "border-brand-500 text-brand-700 dark:text-brand-200" : "border-line text-ink-2 hover:border-line-strong",
            )}
          >
            {active && <motion.span layoutId="method-active" className="absolute inset-0 rounded-lg bg-brand-50 dark:bg-brand-900/40" transition={{ type: "spring", stiffness: 500, damping: 36 }} />}
            <Icon className="relative h-3.5 w-3.5" />
            <span className="relative truncate">{METHOD_LABEL[m]}</span>
          </button>
        );
      })}
    </div>
  );
}

export function CategorySelect({ kind, value, onChange, id }: { kind: TxnKind; value: string; onChange: (v: string) => void; id?: string }) {
  // Select the stable array, then filter. Filtering inside the selector returns a new
  // array on every store read, which zustand 5 treats as a change and loops forever.
  const all = useApp((s) => s.data.categories);
  const cats = useMemo(() => all.filter((c) => c.kind === kind), [all, kind]);
  return (
    <Select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
      {cats.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </Select>
  );
}

export function EventSelect({ value, onChange, id, placeholder = "Not linked to an event", filter }: { value: string; onChange: (v: string) => void; id?: string; placeholder?: string; filter?: (e: { type: string; status: string }) => boolean }) {
  const events = useApp((s) => s.data.events);
  const list = [...events].filter((e) => e.status !== "cancelled" && (!filter || filter(e))).sort((a, b) => b.startDate.localeCompare(a.startDate));
  return (
    <Select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{placeholder}</option>
      {list.map((e) => (
        <option key={e.id} value={e.id}>
          {e.name}
        </option>
      ))}
    </Select>
  );
}

export function FormGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("grid gap-4 px-6 py-5 sm:grid-cols-2", className)}>{children}</div>;
}

export function errorMessage(e: unknown) {
  return e instanceof Error ? e.message : "Something went wrong. Try again.";
}
