import { cn, formatPKR } from "@/lib/utils";

/** Signed amount with colour: green for money in, red/violet for money out. */
export function Money({ amount, direction, kind, className, muted }: { amount: number; direction?: "in" | "out"; kind?: string; className?: string; muted?: boolean }) {
  const out = direction === "out";
  const color = muted ? "text-muted line-through" : !direction ? "text-ink" : out ? (kind === "distribution" ? "text-violet" : "text-coral") : "text-inflow";
  return <span className={cn("num font-semibold", color, className)}>{direction ? (out ? "−" : "+") : ""}{formatPKR(amount).replace("PKR ", direction ? "" : "PKR ")}</span>;
}
