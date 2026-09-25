/**
 * Demo-mode write operations. Each one mirrors a Postgres function in
 * supabase/migrations/0003_functions.sql so behaviour is identical after migration:
 * same numbering, same audit entries, same rules (no deletes of money, void instead).
 */
import { KIND_META, ROLE_LABEL } from "../constants";
import type {
  AuditLog,
  EventType,
  PaymentMethod,
  Profile,
  RecipientType,
  Role,
  Snapshot,
  SocietyEvent,
  SocietySettings,
  Transaction,
  TxnKind,
} from "../types";
import { formatPKR, pad, uid } from "../utils";
import { agreedAmount, vendorLedger } from "../finance";

// ---------------- inputs (shared with the Supabase source) ----------------
export interface LedgerInput {
  date: string;
  amount: number;
  categoryId: string;
  eventId?: string;
  method: PaymentMethod;
  counterparty?: string;
  description: string;
  reference?: string;
}
export interface DonationInput {
  date: string;
  amount: number;
  categoryId: string;
  eventId?: string;
  method: PaymentMethod;
  donorName?: string;
  donorPhone?: string;
  isAnonymous: boolean;
  purpose: string;
  notes?: string;
}
export interface DistributionInput {
  date: string;
  amount: number;
  categoryId: string;
  eventId?: string;
  method: PaymentMethod;
  recipientName: string;
  recipientType: RecipientType;
  recipientContact?: string;
  beneficiaryCount: number;
  notes: string;
}
export interface VendorPaymentInput {
  eventVendorId: string;
  amount: number;
  date: string;
  method: PaymentMethod;
  notes?: string;
}
export interface EventInput {
  name: string;
  type: EventType;
  status: SocietyEvent["status"];
  startDate: string;
  endDate: string;
  days: number;
  location: string;
  description?: string;
  targetAmount?: number;
  budget?: number;
  expectedVendors?: number;
  defaultDayFee?: number;
}
export interface VendorInput {
  businessName: string;
  ownerName?: string;
  phone?: string;
  stallType?: string;
  notes?: string;
}
export interface BookingInput {
  eventId: string;
  vendorId: string;
  stallNo: string;
  stallType?: string;
  dayFees: number[];
  notes?: string;
}

export interface Result<T = undefined> {
  data: Snapshot;
  value: T;
}

// ---------------- helpers ----------------
const now = () => new Date().toISOString();

function audit(
  data: Snapshot,
  actor: Profile,
  action: AuditLog["action"],
  entity: string,
  summary: string,
  entityId?: string,
  changes?: AuditLog["changes"],
): AuditLog[] {
  return [
    { id: uid(), actorId: actor.id, actorName: actor.fullName, action, entity, entityId, summary, changes, createdAt: now() },
    ...data.auditLogs,
  ];
}

function nextTxnCode(txns: Transaction[]) {
  const max = txns.reduce((m, t) => Math.max(m, Number(t.code.replace(/\D/g, "")) || 0), 0);
  return `TXN-${pad(max + 1, 4)}`;
}

/** VR-2026-0007 style numbers that restart each year, like a physical receipt book. */
export function nextDocNo(prefix: string, date: string, existing: string[]) {
  const year = date.slice(0, 4);
  const stem = `${prefix}-${year}-`;
  const max = existing
    .filter((n) => n.startsWith(stem))
    .reduce((m, n) => Math.max(m, Number(n.slice(stem.length)) || 0), 0);
  return `${stem}${pad(max + 1, 4)}`;
}

function assertRole(actor: Profile, roles: Role[]) {
  if (!roles.includes(actor.role)) throw new Error("You do not have permission to do this.");
}
const assertFinance = (a: Profile) => assertRole(a, ["finance_secretary"]);

function makeTxn(data: Snapshot, actor: Profile, kind: TxnKind, i: LedgerInput): Transaction {
  if (!(i.amount > 0)) throw new Error("Amount must be greater than zero.");
  return {
    id: uid(),
    code: nextTxnCode(data.transactions),
    date: i.date,
    kind,
    direction: KIND_META[kind].direction,
    amount: Math.round(i.amount),
    categoryId: i.categoryId,
    eventId: i.eventId || undefined,
    method: i.method,
    counterparty: i.counterparty?.trim() || undefined,
    description: i.description.trim(),
    reference: i.reference?.trim() || undefined,
    status: "posted",
    createdBy: actor.id,
    createdAt: now(),
  };
}

// ---------------- ledger ----------------
export function recordLedger(data: Snapshot, actor: Profile, kind: "income" | "expense", i: LedgerInput): Result<Transaction> {
  assertFinance(actor);
  const t = makeTxn(data, actor, kind, i);
  const label = kind === "income" ? "income" : "expense";
  return {
    value: t,
    data: {
      ...data,
      transactions: [...data.transactions, t],
      auditLogs: audit(data, actor, "create", "transaction", `Recorded ${formatPKR(t.amount)} ${label} "${t.description}" (${t.code})`, t.id),
    },
  };
}

export function recordDonation(data: Snapshot, actor: Profile, i: DonationInput): Result<{ txn: Transaction; receiptNo: string }> {
  assertFinance(actor);
  const receiptNo = nextDocNo("DR", i.date, data.donations.map((d) => d.receiptNo));
  const donor = i.isAnonymous ? "Anonymous" : i.donorName?.trim() || "Anonymous";
  const t = makeTxn(data, actor, "donation", {
    ...i,
    counterparty: donor,
    description: i.notes?.trim() || `${i.purpose} donation`,
    reference: receiptNo,
  });
  return {
    value: { txn: t, receiptNo },
    data: {
      ...data,
      transactions: [...data.transactions, t],
      donations: [
        ...data.donations,
        {
          id: uid(),
          transactionId: t.id,
          donorName: i.isAnonymous ? undefined : i.donorName?.trim() || undefined,
          donorPhone: i.isAnonymous ? undefined : i.donorPhone?.trim() || undefined,
          isAnonymous: i.isAnonymous || !i.donorName?.trim(),
          purpose: i.purpose,
          receiptNo,
        },
      ],
      auditLogs: audit(data, actor, "create", "transaction", `Recorded ${formatPKR(t.amount)} donation from ${donor} (${t.code}, ${receiptNo})`, t.id),
    },
  };
}

export function recordDistribution(data: Snapshot, actor: Profile, i: DistributionInput): Result<{ txn: Transaction; referenceNo: string }> {
  assertFinance(actor);
  const referenceNo = nextDocNo("AID", i.date, data.distributions.map((d) => d.referenceNo));
  const t = makeTxn(data, actor, "distribution", {
    ...i,
    counterparty: i.recipientName,
    description: i.notes,
    reference: referenceNo,
  });
  return {
    value: { txn: t, referenceNo },
    data: {
      ...data,
      transactions: [...data.transactions, t],
      distributions: [
        ...data.distributions,
        {
          id: uid(),
          transactionId: t.id,
          recipientName: i.recipientName.trim(),
          recipientType: i.recipientType,
          recipientContact: i.recipientContact?.trim() || undefined,
          beneficiaryCount: Math.max(1, Math.round(i.beneficiaryCount || 1)),
          referenceNo,
        },
      ],
      auditLogs: audit(data, actor, "create", "transaction", `Recorded ${formatPKR(t.amount)} aid to ${i.recipientName} (${t.code}, ${referenceNo})`, t.id),
    },
  };
}

export function recordVendorPayment(data: Snapshot, actor: Profile, i: VendorPaymentInput): Result<{ txn: Transaction; paymentId: string; receiptNo: string }> {
  assertFinance(actor);
  const booking = data.eventVendors.find((b) => b.id === i.eventVendorId);
  if (!booking) throw new Error("Stall booking not found.");
  const [row] = vendorLedger(data, [booking]);
  if (i.amount > row.remaining) throw new Error(`Amount is more than the ${formatPKR(row.remaining)} still owed.`);
  const vendor = data.vendors.find((v) => v.id === booking.vendorId)!;
  const category = data.categories.find((c) => c.kind === "vendor_payment")!;
  const receiptNo = nextDocNo("VR", i.date, data.vendorPayments.map((p) => p.receiptNo));
  const t = makeTxn(data, actor, "vendor_payment", {
    date: i.date,
    amount: i.amount,
    method: i.method,
    categoryId: category.id,
    eventId: booking.eventId,
    counterparty: vendor.businessName,
    description: i.notes?.trim() || `Stall ${booking.stallNo} fee`,
    reference: receiptNo,
  });
  const paymentId = uid();
  return {
    value: { txn: t, paymentId, receiptNo },
    data: {
      ...data,
      transactions: [...data.transactions, t],
      vendorPayments: [...data.vendorPayments, { id: paymentId, transactionId: t.id, eventVendorId: booking.id, receiptNo }],
      auditLogs: audit(data, actor, "create", "transaction", `Recorded ${formatPKR(t.amount)} vendor payment from ${vendor.businessName} (${receiptNo})`, t.id),
    },
  };
}

/** Permanent delete. The linked donation/aid/vendor-payment row goes too; the audit log keeps a copy. */
export function deleteTransaction(data: Snapshot, actor: Profile, id: string, reason: string): Result {
  assertFinance(actor);
  const t = data.transactions.find((x) => x.id === id);
  if (!t) throw new Error("Transaction not found.");
  if (reason.trim().length < 3) throw new Error("Give a short reason for deleting.");
  const detail =
    data.donations.find((x) => x.transactionId === id) ?? data.distributions.find((x) => x.transactionId === id) ?? data.vendorPayments.find((x) => x.transactionId === id);
  return {
    value: undefined,
    data: {
      ...data,
      transactions: data.transactions.filter((x) => x.id !== id),
      donations: data.donations.filter((x) => x.transactionId !== id),
      distributions: data.distributions.filter((x) => x.transactionId !== id),
      vendorPayments: data.vendorPayments.filter((x) => x.transactionId !== id),
      auditLogs: audit(data, actor, "delete", "transaction", `Deleted ${t.code} (${formatPKR(t.amount)}, ${t.description}): ${reason.trim()}`, id, {
        deleted: { from: { ...t, detail }, to: null },
      }),
    },
  };
}

export function voidTransaction(data: Snapshot, actor: Profile, id: string, reason: string): Result {
  assertFinance(actor);
  const t = data.transactions.find((x) => x.id === id);
  if (!t) throw new Error("Transaction not found.");
  if (t.status === "void") throw new Error("This transaction is already void.");
  if (reason.trim().length < 5) throw new Error("Give a short reason for voiding.");
  return {
    value: undefined,
    data: {
      ...data,
      transactions: data.transactions.map((x) =>
        x.id === id ? { ...x, status: "void", voidReason: reason.trim(), voidedBy: actor.id, voidedAt: now() } : x,
      ),
      auditLogs: audit(data, actor, "void", "transaction", `Voided ${t.code}: ${reason.trim()}`, id, { status: { from: "posted", to: "void" } }),
    },
  };
}

export function verifyTransactions(data: Snapshot, actor: Profile, ids: string[]): Result<number> {
  assertRole(actor, ["president"]);
  const set = new Set(ids);
  const targets = data.transactions.filter((t) => set.has(t.id) && t.status === "posted" && !t.verifiedAt);
  let logs = data.auditLogs;
  for (const t of targets) logs = audit({ ...data, auditLogs: logs }, actor, "verify", "transaction", `Verified ${t.code}`, t.id);
  const stamp = now();
  return {
    value: targets.length,
    data: {
      ...data,
      transactions: data.transactions.map((t) =>
        targets.includes(t) ? { ...t, verifiedBy: actor.id, verifiedAt: stamp } : t,
      ),
      auditLogs: logs,
    },
  };
}

export function updateTransactionNotes(data: Snapshot, actor: Profile, id: string, patch: { description: string; counterparty?: string; reference?: string }): Result {
  assertFinance(actor);
  const t = data.transactions.find((x) => x.id === id)!;
  const changes: AuditLog["changes"] = {};
  (["description", "counterparty", "reference"] as const).forEach((k) => {
    if ((patch[k] ?? "") !== (t[k] ?? "")) changes[k] = { from: t[k], to: patch[k] };
  });
  if (!Object.keys(changes).length) return { data, value: undefined };
  return {
    value: undefined,
    data: {
      ...data,
      transactions: data.transactions.map((x) => (x.id === id ? { ...x, ...patch } : x)),
      auditLogs: audit(data, actor, "update", "transaction", `Edited details of ${t.code}`, id, changes),
    },
  };
}

// ---------------- events ----------------
export function createEvent(data: Snapshot, actor: Profile, i: EventInput): Result<SocietyEvent> {
  assertFinance(actor);
  const year = i.startDate.slice(0, 4);
  const count = data.events.length + 1;
  const ev: SocietyEvent = { ...i, id: uid(), code: `EVT-${year}-${pad(count)}`, createdBy: actor.id, createdAt: now() };
  return {
    value: ev,
    data: { ...data, events: [...data.events, ev], auditLogs: audit(data, actor, "create", "event", `Created event "${ev.name}"`, ev.id) },
  };
}

export function updateEvent(data: Snapshot, actor: Profile, id: string, patch: Partial<EventInput>): Result {
  assertFinance(actor);
  const ev = data.events.find((e) => e.id === id)!;
  const changes: AuditLog["changes"] = {};
  for (const [k, v] of Object.entries(patch)) {
    const old = (ev as unknown as Record<string, unknown>)[k];
    if (JSON.stringify(old) !== JSON.stringify(v)) changes[k] = { from: old, to: v };
  }
  if (!Object.keys(changes).length) return { data, value: undefined };
  const summary = changes.status ? `Marked "${ev.name}" as ${patch.status}` : `Edited event "${ev.name}"`;
  return {
    value: undefined,
    data: {
      ...data,
      events: data.events.map((e) => (e.id === id ? { ...e, ...patch } : e)),
      auditLogs: audit(data, actor, "update", "event", summary, id, changes),
    },
  };
}

// ---------------- vendors ----------------
export function createVendor(data: Snapshot, actor: Profile, i: VendorInput): Result<string> {
  assertFinance(actor);
  const dupe = data.vendors.find((v) => v.businessName.toLowerCase() === i.businessName.trim().toLowerCase());
  if (dupe) throw new Error(`"${dupe.businessName}" is already in the vendor directory (${dupe.code}).`);
  const id = uid();
  const code = `VND-${pad(data.vendors.length + 1, 3)}`;
  return {
    value: id,
    data: {
      ...data,
      vendors: [...data.vendors, { ...i, businessName: i.businessName.trim(), id, code, createdAt: now() }],
      auditLogs: audit(data, actor, "create", "vendor", `Added vendor "${i.businessName.trim()}" to the directory`, id),
    },
  };
}

export function updateVendor(data: Snapshot, actor: Profile, id: string, patch: VendorInput): Result {
  assertFinance(actor);
  const v = data.vendors.find((x) => x.id === id)!;
  return {
    value: undefined,
    data: {
      ...data,
      vendors: data.vendors.map((x) => (x.id === id ? { ...x, ...patch } : x)),
      auditLogs: audit(data, actor, "update", "vendor", `Edited vendor "${v.businessName}"`, id),
    },
  };
}

export function addBooking(data: Snapshot, actor: Profile, i: BookingInput): Result<string> {
  assertFinance(actor);
  if (data.eventVendors.some((b) => b.eventId === i.eventId && b.vendorId === i.vendorId))
    throw new Error("This vendor already has a stall at this event.");
  if (data.eventVendors.some((b) => b.eventId === i.eventId && b.stallNo.toLowerCase() === i.stallNo.trim().toLowerCase()))
    throw new Error(`Stall ${i.stallNo} is already taken at this event.`);
  const v = data.vendors.find((x) => x.id === i.vendorId)!;
  const e = data.events.find((x) => x.id === i.eventId)!;
  const id = uid();
  return {
    value: id,
    data: {
      ...data,
      eventVendors: [...data.eventVendors, { ...i, stallNo: i.stallNo.trim(), id, createdAt: now() }],
      auditLogs: audit(data, actor, "create", "event_vendor", `Added vendor "${v.businessName}" to ${e.name} (stall ${i.stallNo.trim()})`, id),
    },
  };
}

export function updateBooking(data: Snapshot, actor: Profile, id: string, patch: Omit<BookingInput, "eventId" | "vendorId">): Result {
  assertFinance(actor);
  const b = data.eventVendors.find((x) => x.id === id)!;
  const [row] = vendorLedger(data, [b]);
  const newTotal = patch.dayFees.reduce((a, x) => a + x, 0);
  if (newTotal < row.paid) throw new Error(`The vendor has already paid ${formatPKR(row.paid)}. Fees cannot be lower than that.`);
  if (data.eventVendors.some((x) => x.id !== id && x.eventId === b.eventId && x.stallNo.toLowerCase() === patch.stallNo.trim().toLowerCase()))
    throw new Error(`Stall ${patch.stallNo} is already taken at this event.`);
  const v = data.vendors.find((x) => x.id === b.vendorId)!;
  const e = data.events.find((x) => x.id === b.eventId)!;
  const changes: AuditLog["changes"] = {};
  if (agreedAmount(b) !== newTotal) changes.dayFees = { from: b.dayFees, to: patch.dayFees };
  if (b.stallNo !== patch.stallNo) changes.stallNo = { from: b.stallNo, to: patch.stallNo };
  return {
    value: undefined,
    data: {
      ...data,
      eventVendors: data.eventVendors.map((x) => (x.id === id ? { ...x, ...patch } : x)),
      auditLogs: audit(data, actor, "update", "event_vendor", `Edited stall booking for "${v.businessName}" at ${e.name}`, id, changes),
    },
  };
}

export function removeBooking(data: Snapshot, actor: Profile, id: string): Result {
  assertFinance(actor);
  if (data.vendorPayments.some((p) => p.eventVendorId === id))
    throw new Error("This vendor has payments recorded. Void the payments first, or keep the booking.");
  const b = data.eventVendors.find((x) => x.id === id)!;
  const v = data.vendors.find((x) => x.id === b.vendorId)!;
  const e = data.events.find((x) => x.id === b.eventId)!;
  return {
    value: undefined,
    data: {
      ...data,
      eventVendors: data.eventVendors.filter((x) => x.id !== id),
      auditLogs: audit(data, actor, "delete", "event_vendor", `Removed vendor "${v.businessName}" from ${e.name}`, id),
    },
  };
}

// ---------------- people & settings ----------------
export function setRole(data: Snapshot, actor: Profile, profileId: string, role: Role): Result {
  assertFinance(actor);
  if (profileId === actor.id) throw new Error("You cannot change your own access.");
  const p = data.profiles.find((x) => x.id === profileId);
  if (!p) throw new Error("Account not found.");
  if (p.role === "finance_secretary" && role !== "finance_secretary" && data.profiles.filter((x) => x.role === "finance_secretary").length <= 1)
    throw new Error("At least one Finance account must remain.");
  return {
    value: undefined,
    data: {
      ...data,
      profiles: data.profiles.map((x) => (x.id === profileId ? { ...x, role } : x)),
      auditLogs: audit(data, actor, "role_change", "profile", `Changed ${p.fullName}'s access to ${ROLE_LABEL[role]}`, profileId, { role: { from: p.role, to: role } }),
    },
  };
}

export interface AccountInput {
  fullName: string;
  email: string;
  password: string;
  role: "finance_secretary" | "president";
}

/** Demo version of creating a login. In live mode the /api/accounts route creates the Supabase user. */
export function addAccount(data: Snapshot, actor: Profile, i: AccountInput): Result<string> {
  assertFinance(actor);
  if (data.profiles.some((p) => p.email.toLowerCase() === i.email.trim().toLowerCase())) throw new Error("An account with this email already exists.");
  const id = uid();
  return {
    value: id,
    data: {
      ...data,
      profiles: [...data.profiles, { id, fullName: i.fullName.trim(), email: i.email.trim().toLowerCase(), role: i.role, joinedAt: now().slice(0, 10) }],
      auditLogs: audit(data, actor, "create", "profile", `Created ${ROLE_LABEL[i.role]} account for ${i.fullName.trim()}`, id),
    },
  };
}

/** Deletes an event with its bookings, team and every transaction recorded against it. */
export function deleteEvent(data: Snapshot, actor: Profile, id: string, reason: string): Result {
  assertFinance(actor);
  const e = data.events.find((x) => x.id === id);
  if (!e) throw new Error("Event not found.");
  if (reason.trim().length < 3) throw new Error("Give a short reason for deleting.");
  const bookings = new Set(data.eventVendors.filter((b) => b.eventId === id).map((b) => b.id));
  const txnIds = new Set([
    ...data.transactions.filter((t) => t.eventId === id).map((t) => t.id),
    ...data.vendorPayments.filter((p) => bookings.has(p.eventVendorId)).map((p) => p.transactionId),
  ]);
  const gone = data.transactions.filter((t) => txnIds.has(t.id) && t.status === "posted");
  const tin = gone.filter((t) => t.direction === "in").reduce((a, t) => a + t.amount, 0);
  const tout = gone.filter((t) => t.direction === "out").reduce((a, t) => a + t.amount, 0);
  return {
    value: undefined,
    data: {
      ...data,
      events: data.events.filter((x) => x.id !== id),
      eventVendors: data.eventVendors.filter((b) => !bookings.has(b.id)),
      eventMembers: data.eventMembers.filter((m) => m.eventId !== id),
      transactions: data.transactions.filter((t) => !txnIds.has(t.id)),
      donations: data.donations.filter((d) => !txnIds.has(d.transactionId)),
      distributions: data.distributions.filter((d) => !txnIds.has(d.transactionId)),
      vendorPayments: data.vendorPayments.filter((p) => !txnIds.has(p.transactionId)),
      auditLogs: audit(
        data,
        actor,
        "delete",
        "event",
        `Deleted event ${e.name} with ${bookings.size} stall bookings and ${txnIds.size} transactions (in ${formatPKR(tin)}, out ${formatPKR(tout)}): ${reason.trim()}`,
        id,
        { deleted: { from: e, to: null } },
      ),
    },
  };
}

export function updateSettings(data: Snapshot, actor: Profile, patch: Partial<SocietySettings>): Result {
  assertFinance(actor);
  const changes: AuditLog["changes"] = {};
  for (const [k, v] of Object.entries(patch)) {
    const old = (data.settings as unknown as Record<string, unknown>)[k];
    if (old !== v) changes[k] = { from: old, to: v };
  }
  if (!Object.keys(changes).length) return { data, value: undefined };
  const summary = changes.openingBalance
    ? `Changed opening balance from ${formatPKR(Number(changes.openingBalance.from))} to ${formatPKR(Number(changes.openingBalance.to))}`
    : "Updated society settings";
  return {
    value: undefined,
    data: { ...data, settings: { ...data.settings, ...patch }, auditLogs: audit(data, actor, "update", "settings", summary, undefined, changes) },
  };
}

export function logActivity(data: Snapshot, actor: Profile, action: AuditLog["action"], entity: string, summary: string): Result {
  return { value: undefined, data: { ...data, auditLogs: audit(data, actor, action, entity, summary) } };
}
