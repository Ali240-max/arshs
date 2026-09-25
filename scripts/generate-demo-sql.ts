/**
 * Writes supabase/demo/demo_load.sql and supabase/demo/demo_wipe.sql from the
 * in-browser demo data.   Run:  npm run demo:sql
 *
 * Designed to run on a REAL project next to real data:
 *  - every demo id starts with 0000000N-0000-4000-8000- and every code starts with DEMO-,
 *    so nothing collides with real TXN-/VR-/DR- numbers and the wipe can find it all
 *  - demo rows are credited to your existing Finance / View-only accounts
 *  - current society settings are stashed on load and restored on wipe
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { demoSnapshot as s } from "../src/lib/demo/seed";

const q = (v: unknown): string => {
  if (v === undefined || v === null || v === "") return "null";
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "true" : "false";
  return `'${String(v).replace(/'/g, "''")}'`;
};
const demo = (code: string) => q(`DEMO-${code}`);
const roleOf = new Map(s.profiles.map((p) => [p.id, p.role]));
const person = (id?: string) => {
  if (!id) return "null";
  const r = roleOf.get(id);
  return r === "finance_secretary" ? "(select id from _demo_people where role = 'finance_secretary')" : r === "president" ? "(select id from _demo_people where role = 'president')" : "null";
};
const rows = (lines: string[]) => lines.join(",\n");
const PREFIX = (n: number) => `0000000${n}-0000-4000-8000-%`;

// ------------------------------------------------------------------ LOAD
const L: string[] = [];
L.push(`-- ARSHS Finance: LOAD DEMO DATA
-- Paste into Supabase > SQL Editor and click Run. Takes a few seconds.
-- Adds ${s.events.length} events, ${s.vendors.length} vendors, ${s.eventVendors.length} stall bookings and ${s.transactions.length} transactions.
-- Every demo code starts with DEMO- so you can tell it apart from real entries.
-- Remove everything with demo_wipe.sql. Your real data is not touched by either file.
-- Needs migrations 1 to 6 and at least one Finance account (SUPABASE_SETUP.md steps 1 to 5).

do $$
begin
  if exists (select 1 from public.events where id = '${s.events[0].id}') then
    raise exception 'Demo data is already loaded. Run demo_wipe.sql first if you want a fresh copy.';
  end if;
  if not exists (select 1 from public.profiles where role = 'finance_secretary') then
    raise exception 'Create your Finance account first (SUPABASE_SETUP.md steps 4 and 5).';
  end if;
end $$;

begin;

-- Demo entries are credited to your first Finance account and first View-only account
create temp table _demo_people on commit drop as
  select distinct on (role) id, role from public.profiles
   where role in ('finance_secretary', 'president') order by role, created_at;

-- Keep your real settings so the wipe can put them back
create table if not exists public.demo_stash (key text primary key, value jsonb not null);
alter table public.demo_stash enable row level security;
insert into public.demo_stash (key, value)
  select 'settings', to_jsonb(s) from public.society_settings s where id = 1
  on conflict (key) do update set value = excluded.value;

update public.society_settings set
  opening_balance = ${s.settings.openingBalance},
  opening_balance_date = ${q(s.settings.openingBalanceDate)}
where id = 1;
`);

L.push(`insert into public.categories (id, name, kind, color) values
${rows(s.categories.map((c) => `  (${q(c.id)}, ${q(c.name)}, ${q(c.kind)}, ${q(c.color)})`))}
on conflict do nothing;
`);

L.push(`insert into public.events (id, code, name, type, status, start_date, end_date, days, location, description, target_amount, budget, expected_vendors, default_day_fee, created_by, created_at) values
${rows(
  s.events.map(
    (e, i) =>
      `  (${q(e.id)}, ${demo(`EVT-${String(i + 1).padStart(2, "0")}`)}, ${q(e.name)}, ${q(e.type)}, ${q(e.status)}, ${q(e.startDate)}, ${q(e.endDate)}, ${e.days}, ${q(e.location)}, ${q(e.description)}, ${q(e.targetAmount)}, ${q(e.budget)}, ${q(e.expectedVendors)}, ${q(e.defaultDayFee)}, ${person(e.createdBy)}, ${q(e.createdAt)})`,
  ),
)};
`);

L.push(`insert into public.vendors (id, code, business_name, owner_name, phone, stall_type, notes, created_at) values
${rows(s.vendors.map((v, i) => `  (${q(v.id)}, ${demo(`V${String(i + 1).padStart(3, "0")}`)}, ${q(v.businessName)}, ${q(v.ownerName)}, ${q(v.phone)}, ${q(v.stallType)}, ${q(v.notes)}, ${q(v.createdAt)})`))};
`);

L.push(`insert into public.event_vendors (id, event_id, vendor_id, stall_no, stall_type, day_fees, notes, created_at) values
${rows(s.eventVendors.map((b) => `  (${q(b.id)}, ${q(b.eventId)}, ${q(b.vendorId)}, ${q(b.stallNo)}, ${q(b.stallType)}, '{${b.dayFees.join(",")}}', ${q(b.notes)}, ${q(b.createdAt)})`))};
`);

L.push(`insert into public.transactions (id, code, txn_date, kind, direction, amount, category_id, event_id, method, counterparty, description, reference, status, void_reason, voided_by, voided_at, verified_by, verified_at, created_by, created_at) values
${rows(
  s.transactions.map(
    (t) =>
      `  (${q(t.id)}, ${demo(t.code.replace("TXN-", ""))}, ${q(t.date)}, ${q(t.kind)}, ${q(t.direction)}, ${t.amount}, ${q(t.categoryId)}, ${q(t.eventId)}, ${q(t.method)}, ${q(t.counterparty)}, ${q(t.description)}, ${q(t.reference)}, ${q(t.status)}, ${q(t.voidReason)}, ${person(t.voidedBy)}, ${q(t.voidedAt)}, ${person(t.verifiedBy)}, ${q(t.verifiedAt)}, ${person(t.createdBy)}, ${q(t.createdAt)})`,
  ),
)};
`);

L.push(`insert into public.donations (id, transaction_id, donor_name, donor_phone, is_anonymous, purpose, receipt_no) values
${rows(s.donations.map((d) => `  (${q(d.id)}, ${q(d.transactionId)}, ${q(d.donorName)}, ${q(d.donorPhone)}, ${q(d.isAnonymous)}, ${q(d.purpose)}, ${demo(d.receiptNo)})`))};
`);
L.push(`insert into public.distributions (id, transaction_id, recipient_name, recipient_type, recipient_contact, beneficiary_count, reference_no) values
${rows(s.distributions.map((d) => `  (${q(d.id)}, ${q(d.transactionId)}, ${q(d.recipientName)}, ${q(d.recipientType)}, ${q(d.recipientContact)}, ${d.beneficiaryCount}, ${demo(d.referenceNo)})`))};
`);
L.push(`insert into public.vendor_payments (id, transaction_id, event_vendor_id, receipt_no) values
${rows(s.vendorPayments.map((p) => `  (${q(p.id)}, ${q(p.transactionId)}, ${q(p.eventVendorId)}, ${demo(p.receiptNo)})`))};
`);

// Audit history: tagged with "_demo" so the wipe removes exactly these rows
L.push(`insert into public.audit_logs (actor_id, actor_name, action, entity, entity_id, summary, changes, created_at) values
${rows(
  [...s.auditLogs]
    .filter((a) => a.action !== "role_change" && a.entity !== "profile")
    .reverse()
    .map(
      (a) =>
        `  (${person(a.actorId)}, ${q(a.actorName)}, ${q(a.action)}, ${q(a.entity)}, ${q(a.entityId)}, ${q(a.summary)}, ${q(JSON.stringify({ ...(a.changes ?? {}), _demo: true }))}::jsonb, ${q(a.createdAt)})`,
    ),
)};

commit;

-- Check: should show ${s.events.length} demo events
select count(*) as demo_events from public.events where code like 'DEMO-%';
`);

// ------------------------------------------------------------------ WIPE
const W = `-- ARSHS Finance: WIPE DEMO DATA
-- Paste into Supabase > SQL Editor and click Run.
-- Removes every demo row added by demo_load.sql, plus anything you recorded while testing
-- against demo events or demo vendors (payments, donations, expenses, bookings).
-- Real events, vendors and transactions are not touched. Your settings are restored.

begin;

create temp table _demo_events   on commit drop as select id from public.events  where id::text like '${PREFIX(3)}';
create temp table _demo_vendors  on commit drop as select id from public.vendors where id::text like '${PREFIX(4)}';
create temp table _demo_bookings on commit drop as
  select id from public.event_vendors
   where id::text like '${PREFIX(5)}'
      or event_id in (select id from _demo_events)
      or vendor_id in (select id from _demo_vendors);
create temp table _demo_txns on commit drop as
  select id from public.transactions
   where id::text like '${PREFIX(6)}'
      or event_id in (select id from _demo_events)
      or id in (select transaction_id from public.vendor_payments where event_vendor_id in (select id from _demo_bookings));

delete from public.donations       where transaction_id in (select id from _demo_txns);
delete from public.distributions   where transaction_id in (select id from _demo_txns);
delete from public.vendor_payments where transaction_id in (select id from _demo_txns);
delete from public.transactions    where id in (select id from _demo_txns);
delete from public.event_vendors   where id in (select id from _demo_bookings);
delete from public.event_members   where event_id in (select id from _demo_events);
delete from public.vendors         where id in (select id from _demo_vendors);
delete from public.events          where id in (select id from _demo_events);

delete from public.audit_logs
 where changes ? '_demo'
    or entity_id in (select id from _demo_txns union all select id from _demo_events
                     union all select id from _demo_vendors union all select id from _demo_bookings);

-- Put your settings back (only if demo_load.sql saved them)
do $$
declare v jsonb;
begin
  if to_regclass('public.demo_stash') is not null then
    select value into v from public.demo_stash where key = 'settings';
    if v is not null then
      update public.society_settings set
        society_name         = v ->> 'society_name',
        subtitle             = v ->> 'subtitle',
        opening_balance      = (v ->> 'opening_balance')::numeric,
        opening_balance_date = (v ->> 'opening_balance_date')::date,
        receipt_footer       = v ->> 'receipt_footer'
      where id = 1;
    end if;
    drop table public.demo_stash;
  end if;
end $$;

commit;

-- Check: all three should be 0
select (select count(*) from public.events where code like 'DEMO-%')       as demo_events,
       (select count(*) from public.transactions where code like 'DEMO-%') as demo_transactions,
       (select count(*) from public.vendors where code like 'DEMO-%')      as demo_vendors;
`;

const dir = join(__dirname, "..", "supabase", "demo");
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, "demo_load.sql"), L.join("\n"));
writeFileSync(join(dir, "demo_wipe.sql"), W);
console.log("Wrote supabase/demo/demo_load.sql and demo_wipe.sql");
