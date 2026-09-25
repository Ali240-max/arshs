"use client";
/**
 * Live data source. Used automatically when NEXT_PUBLIC_SUPABASE_URL and
 * NEXT_PUBLIC_SUPABASE_ANON_KEY are set. Reads go straight to tables (RLS decides
 * what each role sees). Money writes go through the RPC functions in
 * supabase/migrations/..._functions.sql.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuditLog, Profile, Role, Snapshot, SocietySettings } from "../types";
import type {
  BookingInput,
  DistributionInput,
  DonationInput,
  EventInput,
  LedgerInput,
  VendorInput,
  VendorPaymentInput,
} from "./mutations";

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const num = (v: unknown) => (v === null || v === undefined ? undefined : Number(v));
const str = (v: unknown) => (v === null || v === undefined ? undefined : String(v));

async function must<T>(p: PromiseLike<{ data: T | null; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(error.message);
  return data as T;
}

export async function loadProfile(sb: SupabaseClient): Promise<Profile | null> {
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return null;
  const r = await must<Row>(sb.from("profiles").select("*").eq("id", user.id).single());
  return mapProfile(r);
}

const mapProfile = (r: Row): Profile => ({
  id: r.id,
  fullName: r.full_name || r.email,
  email: r.email,
  role: r.role as Role,
  phone: str(r.phone),
  joinedAt: r.joined_at,
});

export async function loadSnapshot(sb: SupabaseClient): Promise<Snapshot> {
  const [settings, profiles, categories, events, members, vendors, bookings, txns, donations, distributions, payments, audit] =
    await Promise.all([
      must<Row>(sb.from("society_settings").select("*").eq("id", 1).single()),
      must<Row[]>(sb.from("profiles").select("*").order("full_name")),
      must<Row[]>(sb.from("categories").select("*").eq("is_active", true)),
      must<Row[]>(sb.from("events").select("*").order("start_date", { ascending: false })),
      must<Row[]>(sb.from("event_members").select("*")),
      must<Row[]>(sb.from("vendors").select("*").order("business_name")),
      must<Row[]>(sb.from("event_vendors").select("*")),
      must<Row[]>(sb.from("transactions").select("*").order("txn_date")),
      must<Row[]>(sb.from("donations").select("*")),
      must<Row[]>(sb.from("distributions").select("*")),
      must<Row[]>(sb.from("vendor_payments").select("*")),
      must<Row[]>(sb.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(1000)),
    ]);

  const s: SocietySettings = {
    societyName: settings.society_name,
    subtitle: settings.subtitle,
    openingBalance: Number(settings.opening_balance),
    openingBalanceDate: settings.opening_balance_date,
    receiptFooter: settings.receipt_footer,
  };

  return {
    settings: s,
    profiles: profiles.map(mapProfile),
    categories: categories.map((c) => ({ id: c.id, name: c.name, kind: c.kind, color: c.color })),
    events: events.map((e) => ({
      id: e.id,
      code: e.code,
      name: e.name,
      type: e.type,
      status: e.status,
      startDate: e.start_date,
      endDate: e.end_date,
      days: e.days,
      location: e.location,
      description: str(e.description),
      targetAmount: num(e.target_amount),
      budget: num(e.budget),
      expectedVendors: num(e.expected_vendors),
      defaultDayFee: num(e.default_day_fee),
      createdBy: e.created_by ?? "",
      createdAt: e.created_at,
    })),
    eventMembers: members.map((m) => ({ eventId: m.event_id, profileId: m.profile_id, duty: m.duty })),
    vendors: vendors.map((v) => ({
      id: v.id,
      code: v.code,
      businessName: v.business_name,
      ownerName: str(v.owner_name),
      phone: str(v.phone),
      stallType: str(v.stall_type),
      notes: str(v.notes),
      createdAt: v.created_at,
    })),
    eventVendors: bookings.map((b) => ({
      id: b.id,
      eventId: b.event_id,
      vendorId: b.vendor_id,
      stallNo: b.stall_no,
      stallType: str(b.stall_type),
      dayFees: (b.day_fees ?? []).map(Number),
      notes: str(b.notes),
      createdAt: b.created_at,
    })),
    transactions: txns.map((t) => ({
      id: t.id,
      code: t.code,
      date: t.txn_date,
      kind: t.kind,
      direction: t.direction,
      amount: Number(t.amount),
      categoryId: t.category_id,
      eventId: str(t.event_id),
      method: t.method,
      counterparty: str(t.counterparty),
      description: t.description,
      reference: str(t.reference),
      status: t.status,
      voidReason: str(t.void_reason),
      voidedBy: str(t.voided_by),
      voidedAt: str(t.voided_at),
      verifiedBy: str(t.verified_by),
      verifiedAt: str(t.verified_at),
      createdBy: t.created_by ?? "",
      createdAt: t.created_at,
    })),
    donations: donations.map((d) => ({
      id: d.id,
      transactionId: d.transaction_id,
      donorName: str(d.donor_name),
      donorPhone: str(d.donor_phone),
      isAnonymous: d.is_anonymous,
      purpose: d.purpose,
      receiptNo: d.receipt_no,
    })),
    distributions: distributions.map((d) => ({
      id: d.id,
      transactionId: d.transaction_id,
      recipientName: d.recipient_name,
      recipientType: d.recipient_type,
      recipientContact: str(d.recipient_contact),
      beneficiaryCount: d.beneficiary_count,
      referenceNo: d.reference_no,
    })),
    vendorPayments: payments.map((p) => ({
      id: p.id,
      transactionId: p.transaction_id,
      eventVendorId: p.event_vendor_id,
      receiptNo: p.receipt_no,
    })),
    auditLogs: audit.map(
      (a): AuditLog => ({
        id: String(a.id),
        actorId: a.actor_id ?? "",
        actorName: a.actor_name,
        action: a.action,
        entity: a.entity,
        entityId: str(a.entity_id),
        summary: a.summary,
        changes: a.changes ?? undefined,
        createdAt: a.created_at,
      }),
    ),
  };
}

export async function loadMemberSummary(sb: SupabaseClient) {
  const r = await must<Row>(sb.rpc("get_member_summary"));
  return {
    totalRaised: Number(r.total_raised),
    totalDistributed: Number(r.total_distributed),
    peopleHelped: Number(r.people_helped),
    eventsCompleted: Number(r.events_completed),
  };
}

// ---------------- writes ----------------
const nil = (v?: string) => (v ? v : null);

export const remote = {
  recordLedger: (sb: SupabaseClient, kind: "income" | "expense", i: LedgerInput) =>
    must(
      sb.rpc("record_ledger", {
        p_kind: kind,
        p_date: i.date,
        p_amount: i.amount,
        p_category_id: i.categoryId,
        p_event_id: nil(i.eventId),
        p_method: i.method,
        p_counterparty: i.counterparty ?? "",
        p_description: i.description,
        p_reference: i.reference ?? "",
      }),
    ),
  recordDonation: (sb: SupabaseClient, i: DonationInput) =>
    must<Row>(
      sb.rpc("record_donation", {
        p_date: i.date,
        p_amount: i.amount,
        p_category_id: i.categoryId,
        p_event_id: nil(i.eventId),
        p_method: i.method,
        p_donor_name: i.donorName ?? "",
        p_donor_phone: i.donorPhone ?? "",
        p_is_anonymous: i.isAnonymous,
        p_purpose: i.purpose,
        p_notes: i.notes ?? "",
      }),
    ),
  recordDistribution: (sb: SupabaseClient, i: DistributionInput) =>
    must<Row>(
      sb.rpc("record_distribution", {
        p_date: i.date,
        p_amount: i.amount,
        p_category_id: i.categoryId,
        p_event_id: nil(i.eventId),
        p_method: i.method,
        p_recipient_name: i.recipientName,
        p_recipient_type: i.recipientType,
        p_recipient_contact: i.recipientContact ?? "",
        p_beneficiary_count: i.beneficiaryCount,
        p_notes: i.notes,
      }),
    ),
  recordVendorPayment: (sb: SupabaseClient, i: VendorPaymentInput) =>
    must<Row>(
      sb.rpc("record_vendor_payment", {
        p_event_vendor_id: i.eventVendorId,
        p_amount: i.amount,
        p_date: i.date,
        p_method: i.method,
        p_notes: i.notes ?? "",
      }),
    ),
  voidTransaction: (sb: SupabaseClient, id: string, reason: string) =>
    must(sb.rpc("void_transaction", { p_id: id, p_reason: reason })),
  verifyTransactions: (sb: SupabaseClient, ids: string[]) => must<number>(sb.rpc("verify_transactions", { p_ids: ids })),
  updateTransactionNotes: (sb: SupabaseClient, id: string, p: { description: string; counterparty?: string; reference?: string }) =>
    must(
      sb.rpc("update_transaction_notes", {
        p_id: id,
        p_description: p.description,
        p_counterparty: p.counterparty ?? "",
        p_reference: p.reference ?? "",
      }),
    ),
  setRole: (sb: SupabaseClient, profileId: string, role: Role) =>
    must(sb.rpc("set_user_role", { p_profile_id: profileId, p_role: role })),
  logActivity: (sb: SupabaseClient, action: string, entity: string, summary: string) =>
    must(sb.rpc("log_activity", { p_action: action, p_entity: entity, p_summary: summary })),

  createEvent: (sb: SupabaseClient, i: EventInput) =>
    must<Row>(
      sb
        .from("events")
        .insert({
          name: i.name,
          type: i.type,
          status: i.status,
          start_date: i.startDate,
          end_date: i.endDate,
          days: i.days,
          location: i.location,
          description: i.description ?? null,
          target_amount: i.targetAmount ?? null,
          budget: i.budget ?? null,
          expected_vendors: i.expectedVendors ?? null,
          default_day_fee: i.defaultDayFee ?? null,
        })
        .select("id")
        .single(),
    ),
  updateEvent: (sb: SupabaseClient, id: string, p: Partial<EventInput>) => {
    const map: Record<string, string> = {
      name: "name", type: "type", status: "status", startDate: "start_date", endDate: "end_date", days: "days",
      location: "location", description: "description", targetAmount: "target_amount", budget: "budget",
      expectedVendors: "expected_vendors", defaultDayFee: "default_day_fee",
    };
    const row: Row = {};
    for (const [k, v] of Object.entries(p)) row[map[k]] = v ?? null;
    return must(sb.from("events").update(row).eq("id", id));
  },
  createVendor: (sb: SupabaseClient, i: VendorInput) =>
    must<Row>(
      sb
        .from("vendors")
        .insert({ business_name: i.businessName, owner_name: i.ownerName ?? null, phone: i.phone ?? null, stall_type: i.stallType ?? null, notes: i.notes ?? null })
        .select("id")
        .single(),
    ),
  updateVendor: (sb: SupabaseClient, id: string, i: VendorInput) =>
    must(
      sb
        .from("vendors")
        .update({ business_name: i.businessName, owner_name: i.ownerName ?? null, phone: i.phone ?? null, stall_type: i.stallType ?? null, notes: i.notes ?? null })
        .eq("id", id),
    ),
  addBooking: (sb: SupabaseClient, i: BookingInput) =>
    must<Row>(
      sb
        .from("event_vendors")
        .insert({ event_id: i.eventId, vendor_id: i.vendorId, stall_no: i.stallNo, stall_type: i.stallType ?? null, day_fees: i.dayFees, notes: i.notes ?? null })
        .select("id")
        .single(),
    ),
  updateBooking: (sb: SupabaseClient, id: string, i: Omit<BookingInput, "eventId" | "vendorId">) =>
    must(
      sb
        .from("event_vendors")
        .update({ stall_no: i.stallNo, stall_type: i.stallType ?? null, day_fees: i.dayFees, notes: i.notes ?? null })
        .eq("id", id),
    ),
  removeBooking: (sb: SupabaseClient, id: string) => must(sb.from("event_vendors").delete().eq("id", id)),
  updateSettings: (sb: SupabaseClient, p: Partial<SocietySettings>) => {
    const row: Row = {};
    if (p.societyName !== undefined) row.society_name = p.societyName;
    if (p.subtitle !== undefined) row.subtitle = p.subtitle;
    if (p.openingBalance !== undefined) row.opening_balance = p.openingBalance;
    if (p.openingBalanceDate !== undefined) row.opening_balance_date = p.openingBalanceDate;
    if (p.receiptFooter !== undefined) row.receipt_footer = p.receiptFooter;
    return must(sb.from("society_settings").update(row).eq("id", 1));
  },
};
