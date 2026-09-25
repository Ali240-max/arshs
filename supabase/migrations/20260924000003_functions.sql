-- =====================================================================
-- ARSHS Finance: functions
-- Every money write goes through one of these. Each function:
--   1. checks the caller's role
--   2. inserts the ledger row (+ its detail row)
--   3. numbers the receipt
--   4. writes the audit entry
-- all inside one database transaction.
-- =====================================================================

-- ---------- helpers ----------
create function public.actor_name() returns text
language sql stable security definer set search_path = public
as $$ select coalesce((select full_name from public.profiles where id = auth.uid()), 'System') $$;

create function public.write_audit(p_action text, p_entity text, p_entity_id uuid, p_summary text, p_changes jsonb default null)
returns void language sql security definer set search_path = public
as $$
  insert into public.audit_logs (actor_id, actor_name, action, entity, entity_id, summary, changes)
  values (auth.uid(), public.actor_name(), p_action, p_entity, p_entity_id, p_summary, p_changes);
$$;

create function public.next_doc_no(p_prefix text, p_date date) returns text
language plpgsql security definer set search_path = public
as $$
declare
  v_year int := extract(year from p_date)::int;
  v_next int;
begin
  insert into public.doc_counters (prefix, year, last_value) values (p_prefix, v_year, 1)
  on conflict (prefix, year) do update set last_value = public.doc_counters.last_value + 1
  returning last_value into v_next;
  return p_prefix || '-' || v_year || '-' || lpad(v_next::text, 4, '0');
end $$;

create function public.require_finance() returns void
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.is_finance() then
    raise exception 'Only the Finance Secretary can record money.' using errcode = '42501';
  end if;
end $$;

create function public.pkr(n numeric) returns text
language sql immutable
as $$ select 'PKR ' || to_char(n, 'FM999,999,999,990') $$;

-- ---------- event code and timestamps ----------
create function public.set_event_code() returns trigger
language plpgsql
as $$
begin
  if new.code is null or new.code = '' then
    new.code := 'EVT-' || extract(year from new.start_date)::int || '-' || lpad(nextval('public.event_code_seq')::text, 2, '0');
  end if;
  return new;
end $$;
create trigger events_set_code before insert on public.events
  for each row execute function public.set_event_code();

create function public.touch_updated_at() returns trigger
language plpgsql
as $$ begin new.updated_at := now(); return new; end $$;
create trigger events_touch before update on public.events
  for each row execute function public.touch_updated_at();
create trigger settings_touch before update on public.society_settings
  for each row execute function public.touch_updated_at();

-- ---------- audit trigger for directly-edited tables ----------
create function public.audit_row_change() returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_old jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  v_new jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  v_changes jsonb;
  v_label text;
  v_summary text;
  v_id uuid;
begin
  if auth.uid() is null then
    return coalesce(new, old); -- seed scripts and dashboard SQL are not logged
  end if;

  if tg_op = 'UPDATE' then
    select jsonb_object_agg(key, jsonb_build_object('from', v_old -> key, 'to', value))
      into v_changes
      from jsonb_each(v_new)
     where v_old -> key is distinct from value
       and key not in ('updated_at', 'agreed_amount');
    if v_changes is null then return new; end if;
  end if;

  v_label := coalesce(v_new, v_old) ->> case tg_table_name
    when 'events' then 'name'
    when 'vendors' then 'business_name'
    when 'event_vendors' then 'stall_no'
    else 'id' end;

  v_summary := case tg_op when 'INSERT' then 'Created ' when 'UPDATE' then 'Edited ' else 'Removed ' end
    || case tg_table_name
         when 'events' then 'event "' || v_label || '"'
         when 'vendors' then 'vendor "' || v_label || '"'
         when 'event_vendors' then 'stall booking ' || v_label
         when 'society_settings' then 'society settings'
         else tg_table_name end;

  v_id := case when tg_table_name = 'society_settings' then null else (coalesce(v_new, v_old) ->> 'id')::uuid end;

  perform public.write_audit(lower(case tg_op when 'INSERT' then 'create' when 'UPDATE' then 'update' else 'delete' end),
                             case tg_table_name when 'society_settings' then 'settings' else rtrim(tg_table_name, 's') end,
                             v_id, v_summary, v_changes);
  return coalesce(new, old);
end $$;

create trigger audit_events          after insert or update or delete on public.events          for each row execute function public.audit_row_change();
create trigger audit_vendors         after insert or update or delete on public.vendors         for each row execute function public.audit_row_change();
create trigger audit_event_vendors   after insert or update or delete on public.event_vendors   for each row execute function public.audit_row_change();
create trigger audit_settings        after update                     on public.society_settings for each row execute function public.audit_row_change();

-- Fees on a booking can never drop below what the vendor has already paid.
create function public.check_booking_fees() returns trigger
language plpgsql security definer set search_path = public
as $$
declare v_paid numeric;
begin
  select coalesce(sum(t.amount), 0) into v_paid
    from public.vendor_payments vp join public.transactions t on t.id = vp.transaction_id
   where vp.event_vendor_id = new.id and t.status = 'posted';
  if public.array_sum(new.day_fees) < v_paid then
    raise exception 'Vendor has already paid %. Fees cannot be lower than that.', public.pkr(v_paid);
  end if;
  return new;
end $$;
create trigger event_vendors_check_fees before update of day_fees on public.event_vendors
  for each row execute function public.check_booking_fees();

-- =====================================================================
-- Money RPCs (called from the app with supabase.rpc)
-- =====================================================================

create function public.record_ledger(
  p_kind public.txn_kind, p_date date, p_amount numeric, p_category_id uuid, p_event_id uuid,
  p_method public.payment_method, p_counterparty text, p_description text, p_reference text
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare v_txn public.transactions;
begin
  perform public.require_finance();
  if p_kind not in ('income', 'expense') then
    raise exception 'Use record_donation, record_distribution or record_vendor_payment for %', p_kind;
  end if;
  insert into public.transactions (txn_date, kind, direction, amount, category_id, event_id, method, counterparty, description, reference)
  values (p_date, p_kind, case when p_kind = 'expense' then 'out'::public.txn_direction else 'in'::public.txn_direction end,
          p_amount, p_category_id, p_event_id, p_method, nullif(trim(p_counterparty), ''), trim(p_description), nullif(trim(p_reference), ''))
  returning * into v_txn;
  perform public.write_audit('create', 'transaction', v_txn.id,
    'Recorded ' || public.pkr(v_txn.amount) || ' ' || p_kind::text || ' "' || v_txn.description || '" (' || v_txn.code || ')');
  return v_txn.id;
end $$;

create function public.record_donation(
  p_date date, p_amount numeric, p_category_id uuid, p_event_id uuid, p_method public.payment_method,
  p_donor_name text, p_donor_phone text, p_is_anonymous boolean, p_purpose text, p_notes text
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_receipt text;
  v_anon boolean := p_is_anonymous or coalesce(trim(p_donor_name), '') = '';
  v_donor text := case when v_anon then 'Anonymous' else trim(p_donor_name) end;
  v_txn public.transactions;
begin
  perform public.require_finance();
  v_receipt := public.next_doc_no('DR', p_date);
  insert into public.transactions (txn_date, kind, direction, amount, category_id, event_id, method, counterparty, description, reference)
  values (p_date, 'donation', 'in', p_amount, p_category_id, p_event_id, p_method, v_donor,
          coalesce(nullif(trim(p_notes), ''), p_purpose || ' donation'), v_receipt)
  returning * into v_txn;
  insert into public.donations (transaction_id, donor_name, donor_phone, is_anonymous, purpose, receipt_no)
  values (v_txn.id, case when v_anon then null else trim(p_donor_name) end,
          case when v_anon then null else nullif(trim(p_donor_phone), '') end, v_anon, p_purpose, v_receipt);
  perform public.write_audit('create', 'transaction', v_txn.id,
    'Recorded ' || public.pkr(p_amount) || ' donation from ' || v_donor || ' (' || v_txn.code || ', ' || v_receipt || ')');
  return jsonb_build_object('transaction_id', v_txn.id, 'receipt_no', v_receipt);
end $$;

create function public.record_distribution(
  p_date date, p_amount numeric, p_category_id uuid, p_event_id uuid, p_method public.payment_method,
  p_recipient_name text, p_recipient_type public.recipient_type, p_recipient_contact text,
  p_beneficiary_count int, p_notes text
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_ref text;
  v_txn public.transactions;
begin
  perform public.require_finance();
  v_ref := public.next_doc_no('AID', p_date);
  insert into public.transactions (txn_date, kind, direction, amount, category_id, event_id, method, counterparty, description, reference)
  values (p_date, 'distribution', 'out', p_amount, p_category_id, p_event_id, p_method, trim(p_recipient_name), trim(p_notes), v_ref)
  returning * into v_txn;
  insert into public.distributions (transaction_id, recipient_name, recipient_type, recipient_contact, beneficiary_count, reference_no)
  values (v_txn.id, trim(p_recipient_name), p_recipient_type, nullif(trim(p_recipient_contact), ''), greatest(coalesce(p_beneficiary_count, 1), 1), v_ref);
  perform public.write_audit('create', 'transaction', v_txn.id,
    'Recorded ' || public.pkr(p_amount) || ' aid to ' || trim(p_recipient_name) || ' (' || v_txn.code || ', ' || v_ref || ')');
  return jsonb_build_object('transaction_id', v_txn.id, 'reference_no', v_ref);
end $$;

create function public.record_vendor_payment(
  p_event_vendor_id uuid, p_amount numeric, p_date date, p_method public.payment_method, p_notes text
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_booking public.event_vendors;
  v_vendor public.vendors;
  v_remaining numeric;
  v_category uuid;
  v_receipt text;
  v_txn public.transactions;
  v_payment_id uuid;
begin
  perform public.require_finance();
  select * into v_booking from public.event_vendors where id = p_event_vendor_id for update;
  if not found then raise exception 'Stall booking not found'; end if;
  select * into v_vendor from public.vendors where id = v_booking.vendor_id;
  select remaining into v_remaining from public.v_vendor_balances where event_vendor_id = p_event_vendor_id;
  if p_amount > v_remaining then
    raise exception 'Amount is more than the % still owed', public.pkr(v_remaining);
  end if;
  select id into v_category from public.categories where kind = 'vendor_payment' order by name limit 1;
  v_receipt := public.next_doc_no('VR', p_date);
  insert into public.transactions (txn_date, kind, direction, amount, category_id, event_id, method, counterparty, description, reference)
  values (p_date, 'vendor_payment', 'in', p_amount, v_category, v_booking.event_id, p_method, v_vendor.business_name,
          coalesce(nullif(trim(p_notes), ''), 'Stall ' || v_booking.stall_no || ' fee'), v_receipt)
  returning * into v_txn;
  insert into public.vendor_payments (transaction_id, event_vendor_id, receipt_no)
  values (v_txn.id, p_event_vendor_id, v_receipt)
  returning id into v_payment_id;
  perform public.write_audit('create', 'transaction', v_txn.id,
    'Recorded ' || public.pkr(p_amount) || ' vendor payment from ' || v_vendor.business_name || ' (' || v_receipt || ')');
  return jsonb_build_object('transaction_id', v_txn.id, 'payment_id', v_payment_id, 'receipt_no', v_receipt);
end $$;

create function public.void_transaction(p_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = public
as $$
declare v_txn public.transactions;
begin
  perform public.require_finance();
  if length(trim(coalesce(p_reason, ''))) < 5 then raise exception 'Give a short reason for voiding'; end if;
  update public.transactions
     set status = 'void', void_reason = trim(p_reason), voided_by = auth.uid(), voided_at = now()
   where id = p_id and status = 'posted'
  returning * into v_txn;
  if not found then raise exception 'Transaction not found or already void'; end if;
  perform public.write_audit('void', 'transaction', p_id, 'Voided ' || v_txn.code || ': ' || trim(p_reason),
    jsonb_build_object('status', jsonb_build_object('from', 'posted', 'to', 'void')));
end $$;

create function public.update_transaction_notes(p_id uuid, p_description text, p_counterparty text, p_reference text) returns void
language plpgsql security definer set search_path = public
as $$
declare v_old public.transactions;
begin
  perform public.require_finance();
  select * into v_old from public.transactions where id = p_id;
  update public.transactions
     set description = trim(p_description), counterparty = nullif(trim(p_counterparty), ''), reference = nullif(trim(p_reference), '')
   where id = p_id;
  perform public.write_audit('update', 'transaction', p_id, 'Edited details of ' || v_old.code,
    jsonb_build_object('description', jsonb_build_object('from', v_old.description, 'to', trim(p_description))));
end $$;

-- No verify function: the President is view-only and cannot change any row.
-- The verified_by / verified_at columns stay for a future sign-off workflow.

create function public.set_user_role(p_profile_id uuid, p_role public.app_role) returns void
language plpgsql security definer set search_path = public
as $$
declare v_old public.app_role; v_name text;
begin
  -- The Finance Secretary controls everything, including roles. The President is view-only.
  if public.app_role() is distinct from 'finance_secretary' then
    raise exception 'Only the Finance Secretary can change roles' using errcode = '42501';
  end if;
  if p_profile_id = auth.uid() then raise exception 'You cannot change your own role'; end if;
  select role, full_name into v_old, v_name from public.profiles where id = p_profile_id;
  perform set_config('app.role_change', 'on', true);
  if p_role = 'finance_secretary' then
    -- keep exactly one Finance Secretary
    update public.profiles set role = 'member' where role = 'finance_secretary' and id <> p_profile_id;
  end if;
  update public.profiles set role = p_role where id = p_profile_id;
  perform public.write_audit('role_change', 'profile', p_profile_id,
    'Changed ' || v_name || '''s role to ' || replace(p_role::text, '_', ' '),
    jsonb_build_object('role', jsonb_build_object('from', v_old, 'to', p_role)));
end $$;

-- Lets the app log reads it considers sensitive (viewing reports, printing, exports).
create function public.log_activity(p_action text, p_entity text, p_summary text) returns void
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if p_action not in ('view', 'print', 'export', 'login') then raise exception 'Action not allowed'; end if;
  perform public.write_audit(p_action, p_entity, null, left(p_summary, 300));
end $$;

-- Totals-only summary that any signed-in member may see. No names, no rows.
create function public.get_member_summary() returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'total_raised',      coalesce(sum(amount) filter (where t.direction = 'in'), 0),
    'total_distributed', coalesce(sum(amount) filter (where t.kind = 'distribution'), 0),
    'people_helped',     (select coalesce(sum(d.beneficiary_count), 0)
                            from public.distributions d join public.transactions x on x.id = d.transaction_id
                           where x.status = 'posted'),
    'events_completed',  (select count(*) from public.events where status = 'completed')
  )
  from public.transactions t
  where t.status = 'posted' and auth.uid() is not null;
$$;

-- ---------- execute rights ----------
revoke execute on all functions in schema public from public, anon;
grant execute on function
  public.app_role(), public.is_finance(), public.is_officer(), public.array_sum(numeric[]), public.pkr(numeric),
  public.record_ledger(public.txn_kind, date, numeric, uuid, uuid, public.payment_method, text, text, text),
  public.record_donation(date, numeric, uuid, uuid, public.payment_method, text, text, boolean, text, text),
  public.record_distribution(date, numeric, uuid, uuid, public.payment_method, text, public.recipient_type, text, int, text),
  public.record_vendor_payment(uuid, numeric, date, public.payment_method, text),
  public.void_transaction(uuid, text),
  public.update_transaction_notes(uuid, text, text, text),
  public.set_user_role(uuid, public.app_role),
  public.log_activity(text, text, text),
  public.get_member_summary()
to authenticated;
