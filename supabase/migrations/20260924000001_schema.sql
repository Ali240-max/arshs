-- =====================================================================
-- ARSHS Finance: schema
-- Single-entry ledger. `transactions` is the source of truth for money.
-- donations / distributions / vendor_payments hold the extra details of
-- specific transaction kinds (1:1 with a transaction row).
-- =====================================================================

-- ---------- enums ----------
create type public.app_role       as enum ('finance_secretary', 'president', 'member');
create type public.event_type     as enum ('fundraiser', 'expenditure', 'collection');
create type public.event_status   as enum ('planned', 'active', 'completed', 'cancelled');
create type public.txn_kind       as enum ('vendor_payment', 'donation', 'income', 'expense', 'distribution');
create type public.txn_direction  as enum ('in', 'out');
create type public.txn_status     as enum ('posted', 'void');
create type public.payment_method as enum ('cash', 'bank_transfer', 'easypaisa', 'jazzcash', 'cheque', 'other');
create type public.recipient_type as enum ('individual', 'family', 'group', 'institution');

-- ---------- people ----------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null default '',
  email       text not null unique,
  role        public.app_role not null default 'member',
  phone       text,
  joined_at   date not null default current_date,
  created_at  timestamptz not null default now()
);

-- ---------- settings (single row) ----------
create table public.society_settings (
  id                    int primary key default 1 check (id = 1),
  society_name          text not null default 'Adeeb Rizvi Serving Humanity Society',
  subtitle              text not null default 'Finance Office',
  opening_balance       numeric(12,2) not null default 0,
  opening_balance_date  date not null default current_date,
  receipt_footer        text not null default '',
  updated_at            timestamptz not null default now()
);
insert into public.society_settings (id) values (1);

-- ---------- categories ----------
create table public.categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  kind       public.txn_kind not null,
  color      text not null default '#94A3A0',
  is_active  boolean not null default true,
  unique (kind, name)
);

-- ---------- events ----------
create sequence public.event_code_seq;

create table public.events (
  id                uuid primary key default gen_random_uuid(),
  code              text not null unique,
  name              text not null check (length(trim(name)) > 0),
  type              public.event_type not null,
  status            public.event_status not null default 'planned',
  start_date        date not null,
  end_date          date not null,
  days              int not null default 1 check (days between 1 and 14),
  location          text not null default '',
  description       text,
  target_amount     numeric(12,2) check (target_amount >= 0),
  budget            numeric(12,2) check (budget >= 0),
  expected_vendors  int check (expected_vendors >= 0),
  default_day_fee   numeric(12,2) check (default_day_fee >= 0),
  created_by        uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  check (end_date >= start_date)
);

create table public.event_members (
  event_id    uuid not null references public.events (id) on delete cascade,
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  duty        text not null default 'Volunteer',
  primary key (event_id, profile_id)
);

-- ---------- vendors ----------
create sequence public.vendor_code_seq;

create table public.vendors (
  id             uuid primary key default gen_random_uuid(),
  code           text not null unique default ('VND-' || lpad(nextval('public.vendor_code_seq')::text, 3, '0')),
  business_name  text not null,
  owner_name     text,
  phone          text,
  stall_type     text,
  notes          text,
  created_by     uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at     timestamptz not null default now()
);
create unique index vendors_business_name_key on public.vendors (lower(business_name));

-- Sum of an array, used for the generated agreed_amount column.
create function public.array_sum(numeric[]) returns numeric
language sql immutable parallel safe
as $$ select coalesce(sum(x), 0) from unnest($1) as x $$;

-- A vendor's stall booking at one event. Fees are per event day, like the Excel sheets.
create table public.event_vendors (
  id             uuid primary key default gen_random_uuid(),
  event_id       uuid not null references public.events (id) on delete cascade,
  vendor_id      uuid not null references public.vendors (id) on delete restrict,
  stall_no       text not null,
  stall_type     text,
  day_fees       numeric(12,2)[] not null default '{}',
  agreed_amount  numeric(12,2) generated always as (public.array_sum(day_fees)) stored,
  notes          text,
  created_by     uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at     timestamptz not null default now(),
  unique (event_id, vendor_id)
);
create unique index event_vendors_stall_key on public.event_vendors (event_id, lower(stall_no));

-- ---------- ledger ----------
create sequence public.transaction_code_seq;

create table public.transactions (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique default ('TXN-' || lpad(nextval('public.transaction_code_seq')::text, 4, '0')),
  txn_date      date not null,
  kind          public.txn_kind not null,
  direction     public.txn_direction not null,
  amount        numeric(12,2) not null check (amount > 0),
  category_id   uuid not null references public.categories (id),
  event_id      uuid references public.events (id) on delete restrict,
  method        public.payment_method not null default 'cash',
  counterparty  text,
  description   text not null default '',
  reference     text,
  status        public.txn_status not null default 'posted',
  void_reason   text,
  voided_by     uuid references public.profiles (id) on delete set null,
  voided_at     timestamptz,
  verified_by   uuid references public.profiles (id) on delete set null,
  verified_at   timestamptz,
  created_by    uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at    timestamptz not null default now(),
  -- money in for vendor payments, donations and income; money out for expenses and aid
  constraint direction_matches_kind check ((kind in ('expense', 'distribution')) = (direction = 'out')),
  constraint void_has_reason check (status = 'posted' or void_reason is not null)
);
create index transactions_date_idx   on public.transactions (txn_date);
create index transactions_event_idx  on public.transactions (event_id);
create index transactions_kind_idx   on public.transactions (kind);

create table public.donations (
  id              uuid primary key default gen_random_uuid(),
  transaction_id  uuid not null unique references public.transactions (id) on delete restrict,
  donor_name      text,
  donor_phone     text,
  is_anonymous    boolean not null default false,
  purpose         text not null default 'General fund',
  receipt_no      text not null unique
);

create table public.distributions (
  id                 uuid primary key default gen_random_uuid(),
  transaction_id     uuid not null unique references public.transactions (id) on delete restrict,
  recipient_name     text not null,
  recipient_type     public.recipient_type not null default 'individual',
  recipient_contact  text,
  beneficiary_count  int not null default 1 check (beneficiary_count > 0),
  reference_no       text not null unique
);

create table public.vendor_payments (
  id               uuid primary key default gen_random_uuid(),
  transaction_id   uuid not null unique references public.transactions (id) on delete restrict,
  event_vendor_id  uuid not null references public.event_vendors (id) on delete restrict,
  receipt_no       text not null unique
);

-- Receipt books restart numbering every year: VR-2026-0001, DR-2026-0001, AID-2026-0001
create table public.doc_counters (
  prefix      text not null,
  year        int  not null,
  last_value  int  not null default 0,
  primary key (prefix, year)
);

-- ---------- audit ----------
create table public.audit_logs (
  id          bigint generated always as identity primary key,
  actor_id    uuid references public.profiles (id) on delete set null,
  actor_name  text not null default 'System',
  action      text not null,
  entity      text not null,
  entity_id   uuid,
  summary     text not null,
  changes     jsonb,
  created_at  timestamptz not null default now()
);
create index audit_logs_created_idx on public.audit_logs (created_at desc);

-- ---------- views (security_invoker so RLS of the caller applies) ----------
create view public.v_balance with (security_invoker = true) as
select
  s.opening_balance,
  coalesce(sum(t.amount) filter (where t.direction = 'in'), 0)                                   as total_in,
  coalesce(sum(t.amount) filter (where t.kind = 'expense'), 0)                                   as total_expenses,
  coalesce(sum(t.amount) filter (where t.kind = 'distribution'), 0)                              as total_aid,
  s.opening_balance
    + coalesce(sum(t.amount) filter (where t.direction = 'in'), 0)
    - coalesce(sum(t.amount) filter (where t.direction = 'out'), 0)                              as current_balance
from public.society_settings s
left join public.transactions t on t.status = 'posted'
group by s.opening_balance;

create view public.v_vendor_balances with (security_invoker = true) as
select
  ev.id as event_vendor_id,
  ev.event_id,
  ev.vendor_id,
  ev.stall_no,
  ev.agreed_amount,
  coalesce(sum(t.amount) filter (where t.status = 'posted'), 0) as paid,
  greatest(ev.agreed_amount - coalesce(sum(t.amount) filter (where t.status = 'posted'), 0), 0) as remaining,
  case
    when coalesce(sum(t.amount) filter (where t.status = 'posted'), 0) = 0 then 'pending'
    when coalesce(sum(t.amount) filter (where t.status = 'posted'), 0) >= ev.agreed_amount then 'paid'
    else 'partial'
  end as payment_status
from public.event_vendors ev
left join public.vendor_payments vp on vp.event_vendor_id = ev.id
left join public.transactions t on t.id = vp.transaction_id
group by ev.id;

create view public.v_event_summary with (security_invoker = true) as
select
  e.id as event_id,
  coalesce(sum(t.amount) filter (where t.direction = 'in'), 0)  as revenue,
  coalesce(sum(t.amount) filter (where t.direction = 'out'), 0) as spend,
  coalesce(sum(t.amount) filter (where t.direction = 'in'), 0)
    - coalesce(sum(t.amount) filter (where t.direction = 'out'), 0) as net
from public.events e
left join public.transactions t on t.event_id = e.id and t.status = 'posted'
group by e.id;
