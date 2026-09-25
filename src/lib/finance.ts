import type {
  Category,
  EventVendor,
  Snapshot,
  Transaction,
  TxnKind,
  VendorPayment,
  VendorPaymentStatus,
} from "./types";
import { monthKey, monthLabel, monthRange, sum } from "./utils";

/**
 * Accounting model: a single-entry ledger.
 * Every rupee in or out is one row in `transactions`. Voided rows stay in the table
 * (for the audit trail) but never count toward totals.
 *
 *   Current balance = opening balance + Σ posted inflows − Σ posted outflows
 */
export const posted = (txns: Transaction[]) => txns.filter((t) => t.status === "posted");

export interface BalanceSummary {
  opening: number;
  totalIn: number;
  vendorRevenue: number;
  donations: number;
  otherIncome: number;
  expenses: number;
  aid: number;
  totalOut: number;
  balance: number;
  eventRevenue: number;
}

export function balanceSummary(s: Pick<Snapshot, "transactions" | "settings">, txns = s.transactions): BalanceSummary {
  const p = posted(txns);
  const byKind = (k: TxnKind) => sum(p.filter((t) => t.kind === k), (t) => t.amount);
  const vendorRevenue = byKind("vendor_payment");
  const donations = byKind("donation");
  const otherIncome = byKind("income");
  const expenses = byKind("expense");
  const aid = byKind("distribution");
  const totalIn = vendorRevenue + donations + otherIncome;
  const totalOut = expenses + aid;
  const eventRevenue = sum(
    p.filter((t) => t.direction === "in" && t.eventId),
    (t) => t.amount,
  );
  const opening = s.settings.openingBalance;
  return {
    opening,
    totalIn,
    vendorRevenue,
    donations,
    otherIncome,
    expenses,
    aid,
    totalOut,
    balance: opening + totalIn - totalOut,
    eventRevenue,
  };
}

// ---------------- Vendors ----------------

export interface VendorLedgerRow {
  booking: EventVendor;
  agreed: number;
  paid: number;
  remaining: number;
  status: VendorPaymentStatus;
  payments: { payment: VendorPayment; txn: Transaction }[];
  lastPaymentDate?: string;
}

export const agreedAmount = (ev: EventVendor) => sum(ev.dayFees, (f) => f);

export function vendorStatus(agreed: number, paid: number): VendorPaymentStatus {
  if (paid <= 0) return "pending";
  if (paid >= agreed) return "paid";
  return "partial";
}

export function vendorLedger(s: Snapshot, bookings = s.eventVendors): VendorLedgerRow[] {
  const txnById = new Map(s.transactions.map((t) => [t.id, t]));
  return bookings.map((booking) => {
    const payments = s.vendorPayments
      .filter((vp) => vp.eventVendorId === booking.id)
      .map((payment) => ({ payment, txn: txnById.get(payment.transactionId)! }))
      .filter((x) => x.txn)
      .sort((a, b) => a.txn.date.localeCompare(b.txn.date));
    const paid = sum(
      payments.filter((p) => p.txn.status === "posted"),
      (p) => p.txn.amount,
    );
    const agreed = agreedAmount(booking);
    return {
      booking,
      agreed,
      paid,
      remaining: Math.max(agreed - paid, 0),
      status: vendorStatus(agreed, paid),
      payments,
      lastPaymentDate: payments.filter((p) => p.txn.status === "posted").at(-1)?.txn.date,
    };
  });
}

// ---------------- Events ----------------

export interface EventSummary {
  vendorRevenue: number;
  donations: number;
  otherIncome: number;
  revenue: number;
  expenses: number;
  aid: number;
  spend: number;
  net: number;
  vendorCount: number;
  paidVendors: number;
  partialVendors: number;
  pendingVendors: number;
  agreedTotal: number;
  outstanding: number;
}

export function eventSummary(s: Snapshot, eventId: string): EventSummary {
  const txns = posted(s.transactions).filter((t) => t.eventId === eventId);
  const k = (kind: TxnKind) => sum(txns.filter((t) => t.kind === kind), (t) => t.amount);
  const ledger = vendorLedger(
    s,
    s.eventVendors.filter((b) => b.eventId === eventId),
  );
  const vendorRevenue = k("vendor_payment");
  const donations = k("donation");
  const otherIncome = k("income");
  const expenses = k("expense");
  const aid = k("distribution");
  const revenue = vendorRevenue + donations + otherIncome;
  const spend = expenses + aid;
  return {
    vendorRevenue,
    donations,
    otherIncome,
    revenue,
    expenses,
    aid,
    spend,
    net: revenue - spend,
    vendorCount: ledger.length,
    paidVendors: ledger.filter((l) => l.status === "paid").length,
    partialVendors: ledger.filter((l) => l.status === "partial").length,
    pendingVendors: ledger.filter((l) => l.status === "pending").length,
    agreedTotal: sum(ledger, (l) => l.agreed),
    outstanding: sum(ledger, (l) => l.remaining),
  };
}

// ---------------- Time series ----------------

export interface MonthPoint {
  key: string;
  label: string;
  income: number;
  expense: number;
  aid: number;
  outflow: number;
  net: number;
  balance: number;
  donations: number;
  donationCount: number;
}

export function monthlySeries(
  s: Pick<Snapshot, "transactions" | "settings">,
  from: string,
  to: string,
  txns = s.transactions,
): MonthPoint[] {
  const p = posted(txns);
  const keys = monthRange(from, to);
  // Balance carried into the first month shown
  let running =
    s.settings.openingBalance +
    sum(
      posted(s.transactions).filter((t) => monthKey(t.date) < keys[0]),
      (t) => (t.direction === "in" ? t.amount : -t.amount),
    );
  return keys.map((key) => {
    const m = p.filter((t) => monthKey(t.date) === key);
    const income = sum(m.filter((t) => t.direction === "in"), (t) => t.amount);
    const expense = sum(m.filter((t) => t.kind === "expense"), (t) => t.amount);
    const aid = sum(m.filter((t) => t.kind === "distribution"), (t) => t.amount);
    const d = m.filter((t) => t.kind === "donation");
    running += income - expense - aid;
    return {
      key,
      label: monthLabel(key),
      income,
      expense,
      aid,
      outflow: expense + aid,
      net: income - expense - aid,
      balance: running,
      donations: sum(d, (t) => t.amount),
      donationCount: d.length,
    };
  });
}

export function categoryBreakdown(txns: Transaction[], categories: Category[], kinds: TxnKind[]) {
  const catById = new Map(categories.map((c) => [c.id, c]));
  const totals = new Map<string, number>();
  for (const t of posted(txns)) {
    if (!kinds.includes(t.kind)) continue;
    totals.set(t.categoryId, (totals.get(t.categoryId) ?? 0) + t.amount);
  }
  return [...totals.entries()]
    .map(([id, value]) => ({
      name: catById.get(id)?.name ?? "Uncategorised",
      value,
      color: catById.get(id)?.color ?? "#94A3A0",
    }))
    .sort((a, b) => b.value - a.value);
}

/** Groups inflows by source for the income donut. */
export function incomeBySource(txns: Transaction[], categories: Category[]) {
  const p = posted(txns).filter((t) => t.direction === "in");
  const catById = new Map(categories.map((c) => [c.id, c]));
  const vendor = sum(p.filter((t) => t.kind === "vendor_payment"), (t) => t.amount);
  const donations = sum(p.filter((t) => t.kind === "donation"), (t) => t.amount);
  const incomeRows = p.filter((t) => t.kind === "income");
  const stalls = sum(
    incomeRows.filter((t) => catById.get(t.categoryId)?.name === "Student stalls"),
    (t) => t.amount,
  );
  const direct = sum(
    incomeRows.filter((t) => catById.get(t.categoryId)?.name === "Direct contributions"),
    (t) => t.amount,
  );
  const other = sum(incomeRows, (t) => t.amount) - stalls - direct;
  return [
    { name: "Vendor stall fees", value: vendor, color: "#0E6B57" },
    { name: "Donations received", value: donations, color: "#E9A21B" },
    { name: "Student stalls", value: stalls, color: "#34B38A" },
    { name: "Direct contributions", value: direct, color: "#5EA8D6" },
    { name: "Other income", value: other, color: "#A3B1AD" },
  ].filter((x) => x.value > 0);
}

// ---------------- Filtering ----------------

export interface TxnFilters {
  search?: string;
  from?: string;
  to?: string;
  kinds?: TxnKind[];
  direction?: "in" | "out" | "all";
  categoryId?: string;
  eventId?: string;
  method?: string;
  status?: "posted" | "void" | "all";
  createdBy?: string;
  verification?: "all" | "verified" | "unverified";
}

export function filterTxns(txns: Transaction[], f: TxnFilters, searchIndex?: (t: Transaction) => string) {
  const q = f.search?.trim().toLowerCase();
  return txns.filter((t) => {
    if (f.from && t.date < f.from) return false;
    if (f.to && t.date > f.to) return false;
    if (f.kinds?.length && !f.kinds.includes(t.kind)) return false;
    if (f.direction && f.direction !== "all" && t.direction !== f.direction) return false;
    if (f.categoryId && t.categoryId !== f.categoryId) return false;
    if (f.eventId && (f.eventId === "none" ? !!t.eventId : t.eventId !== f.eventId)) return false;
    if (f.method && t.method !== f.method) return false;
    if (f.status && f.status !== "all" && t.status !== f.status) return false;
    if (f.createdBy && t.createdBy !== f.createdBy) return false;
    if (f.verification === "verified" && !t.verifiedAt) return false;
    if (f.verification === "unverified" && (t.verifiedAt || t.status === "void")) return false;
    if (q) {
      const hay = searchIndex ? searchIndex(t) : `${t.code} ${t.description} ${t.counterparty ?? ""} ${t.reference ?? ""}`;
      if (!hay.toLowerCase().includes(q)) return false;
    }
    return true;
  });
}
