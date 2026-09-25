-- =====================================================================
-- ARSHS Finance: roles and Row Level Security
--
--   finance_secretary  reads everything, writes events/vendors/bookings/settings
--                      directly, and writes money only through the RPC functions
--   president          reads everything, changes nothing (view-only)
--   member             reads events, own event assignments, and a totals-only summary
--
-- Money tables (transactions, donations, distributions, vendor_payments,
-- audit_logs) have NO insert/update/delete policies. Every write goes through
-- SECURITY DEFINER functions in 0003 that check the caller's role, number the
-- receipt and write the audit entry in one database transaction.
-- =====================================================================

-- ---------- role helpers ----------
create function public.app_role() returns public.app_role
language sql stable security definer set search_path = public
as $$ select role from public.profiles where id = auth.uid() $$;

create function public.is_finance() returns boolean
language sql stable security definer set search_path = public
as $$ select coalesce(public.app_role() = 'finance_secretary', false) $$;

create function public.is_officer() returns boolean
language sql stable security definer set search_path = public
as $$ select coalesce(public.app_role() in ('finance_secretary', 'president'), false) $$;

-- ---------- new sign-ups become members ----------
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- users may edit their name/phone, never their role ----------
create function public.protect_profile_role() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  -- Direct SQL from the dashboard/service role (auth.uid() is null) is allowed:
  -- that is how the first Finance Secretary and President are created.
  if new.role is distinct from old.role and auth.uid() is not null
     and coalesce(current_setting('app.role_change', true), '') <> 'on' then
    raise exception 'Roles can only be changed with set_user_role()';
  end if;
  return new;
end $$;

create trigger profiles_protect_role
  before update on public.profiles
  for each row execute function public.protect_profile_role();

-- ---------- enable RLS everywhere ----------
alter table public.profiles          enable row level security;
alter table public.society_settings  enable row level security;
alter table public.categories        enable row level security;
alter table public.events            enable row level security;
alter table public.event_members     enable row level security;
alter table public.vendors           enable row level security;
alter table public.event_vendors     enable row level security;
alter table public.transactions      enable row level security;
alter table public.donations         enable row level security;
alter table public.distributions     enable row level security;
alter table public.vendor_payments   enable row level security;
alter table public.doc_counters      enable row level security;
alter table public.audit_logs        enable row level security;

-- ---------- profiles ----------
create policy "profiles: read own or officer"
  on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_officer());

-- Only the Finance Secretary may edit their own name/phone. The President is view-only.
create policy "profiles: finance updates own details"
  on public.profiles for update to authenticated
  using (id = auth.uid() and public.is_finance()) with check (id = auth.uid() and public.is_finance());

-- ---------- settings & categories ----------
create policy "settings: read" on public.society_settings for select to authenticated using (true);
create policy "settings: finance updates" on public.society_settings for update to authenticated
  using (public.is_finance()) with check (public.is_finance());

create policy "categories: read" on public.categories for select to authenticated using (true);
create policy "categories: finance inserts" on public.categories for insert to authenticated with check (public.is_finance());
create policy "categories: finance updates" on public.categories for update to authenticated
  using (public.is_finance()) with check (public.is_finance());

-- ---------- events ----------
create policy "events: read" on public.events for select to authenticated
  using (public.is_officer() or status <> 'cancelled');
create policy "events: finance inserts" on public.events for insert to authenticated with check (public.is_finance());
create policy "events: finance updates" on public.events for update to authenticated
  using (public.is_finance()) with check (public.is_finance());

create policy "event_members: read own or officer" on public.event_members for select to authenticated
  using (profile_id = auth.uid() or public.is_officer());
create policy "event_members: finance inserts" on public.event_members for insert to authenticated with check (public.is_finance());
create policy "event_members: finance updates" on public.event_members for update to authenticated
  using (public.is_finance()) with check (public.is_finance());
create policy "event_members: finance deletes" on public.event_members for delete to authenticated using (public.is_finance());

-- ---------- vendors & bookings ----------
create policy "vendors: officers read" on public.vendors for select to authenticated using (public.is_officer());
create policy "vendors: finance inserts" on public.vendors for insert to authenticated with check (public.is_finance());
create policy "vendors: finance updates" on public.vendors for update to authenticated
  using (public.is_finance()) with check (public.is_finance());

create policy "event_vendors: officers read" on public.event_vendors for select to authenticated using (public.is_officer());
create policy "event_vendors: finance inserts" on public.event_vendors for insert to authenticated with check (public.is_finance());
create policy "event_vendors: finance updates" on public.event_vendors for update to authenticated
  using (public.is_finance()) with check (public.is_finance());
-- Bookings with payments cannot be deleted: vendor_payments references them with ON DELETE RESTRICT.
create policy "event_vendors: finance deletes" on public.event_vendors for delete to authenticated using (public.is_finance());

-- ---------- money: read-only for officers, writes via functions ----------
create policy "transactions: officers read"    on public.transactions    for select to authenticated using (public.is_officer());
create policy "donations: officers read"       on public.donations       for select to authenticated using (public.is_officer());
create policy "distributions: officers read"   on public.distributions   for select to authenticated using (public.is_officer());
create policy "vendor_payments: officers read" on public.vendor_payments for select to authenticated using (public.is_officer());
create policy "audit_logs: officers read"      on public.audit_logs      for select to authenticated using (public.is_officer());
-- doc_counters: no policies at all; only the SECURITY DEFINER functions touch it.

-- ---------- grants ----------
revoke all on all tables    in schema public from anon;
revoke all on all sequences in schema public from anon;
grant usage on schema public to authenticated;
grant select on all tables in schema public to authenticated;
grant insert, update on public.events, public.vendors, public.event_vendors, public.categories, public.event_members to authenticated;
grant delete on public.event_vendors, public.event_members to authenticated;
grant update on public.society_settings to authenticated;
-- Users may only change their own name and phone. The role column is not updatable by clients at all.
grant update (full_name, phone) on public.profiles to authenticated;
grant usage on all sequences in schema public to authenticated;
