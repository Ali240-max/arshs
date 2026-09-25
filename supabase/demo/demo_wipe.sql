-- ARSHS Finance: WIPE DEMO DATA
-- Paste into Supabase > SQL Editor and click Run.
-- Removes every demo row added by demo_load.sql, plus anything you recorded while testing
-- against demo events or demo vendors (payments, donations, expenses, bookings).
-- Real events, vendors and transactions are not touched. Your settings are restored.

begin;

create temp table _demo_events   on commit drop as select id from public.events  where id::text like '00000003-0000-4000-8000-%';
create temp table _demo_vendors  on commit drop as select id from public.vendors where id::text like '00000004-0000-4000-8000-%';
create temp table _demo_bookings on commit drop as
  select id from public.event_vendors
   where id::text like '00000005-0000-4000-8000-%'
      or event_id in (select id from _demo_events)
      or vendor_id in (select id from _demo_vendors);
create temp table _demo_txns on commit drop as
  select id from public.transactions
   where id::text like '00000006-0000-4000-8000-%'
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
