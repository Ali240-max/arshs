"use client";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function Table({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full min-w-[640px] border-separate border-spacing-0 text-sm">{children}</table>
    </div>
  );
}
export function THead({ children }: { children: React.ReactNode }) {
  return <thead className="text-left text-[12px] font-medium text-muted">{children}</thead>;
}
export function TH({ className, children, align = "left" }: { className?: string; children?: React.ReactNode; align?: "left" | "right" | "center" }) {
  return (
    <th className={cn("sticky top-0 z-[1] whitespace-nowrap border-b border-line bg-surface px-4 py-2.5 font-medium first:pl-5 last:pr-5", align === "right" && "text-right", align === "center" && "text-center", className)}>
      {children}
    </th>
  );
}
export function TD({ className, children, align = "left", colSpan }: { className?: string; children?: React.ReactNode; align?: "left" | "right" | "center"; colSpan?: number }) {
  return (
    <td colSpan={colSpan} className={cn("border-b border-line px-4 py-3 align-middle first:pl-5 last:pr-5", align === "right" && "text-right", align === "center" && "text-center", className)}>
      {children}
    </td>
  );
}
export function SortTH<K extends string>({ label, k, sort, onSort, align }: { label: string; k: K; sort: { key: K; dir: "asc" | "desc" }; onSort: (k: K) => void; align?: "left" | "right" }) {
  const active = sort.key === k;
  const Icon = !active ? ArrowUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <TH align={align}>
      <button onClick={() => onSort(k)} className={cn("inline-flex items-center gap-1 transition hover:text-ink", active && "text-ink")}>
        {label}
        <Icon className="h-3 w-3" />
      </button>
    </TH>
  );
}
