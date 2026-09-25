-- 1) Several Finance accounts and several view-only accounts are allowed.
--    Role meaning:  finance_secretary = full access,  president = view only,  member = no access.
--    The only rule kept: the last full-access account can't be removed, so you can't lock yourself out.
create or replace function public.set_user_role(p_profile_id uuid, p_role public.app_role) returns void
language plpgsql security definer set search_path = public
as $$
declare v_old public.app_role; v_name text;
begin
  if public.app_role() is distinct from 'finance_secretary' then
    raise exception 'Only a Finance account can change access' using errcode = '42501';
  end if;
  if p_profile_id = auth.uid() then raise exception 'You cannot change your own access'; end if;
  select role, full_name into v_old, v_name from public.profiles where id = p_profile_id;
  if not found then raise exception 'Account not found'; end if;
  if v_old = 'finance_secretary' and p_role <> 'finance_secretary'
     and (select count(*) from public.profiles where role = 'finance_secretary') <= 1 then
    raise exception 'At least one Finance account must remain';
  end if;
  perform set_config('app.role_change', 'on', true);
  update public.profiles set role = p_role where id = p_profile_id;
  perform public.write_audit('role_change', 'profile', p_profile_id,
    'Changed ' || v_name || '''s access to ' ||
      case p_role when 'finance_secretary' then 'Finance (full access)' when 'president' then 'View only' else 'No access' end,
    jsonb_build_object('role', jsonb_build_object('from', v_old, 'to', p_role)));
end $$;

-- 2) Delete an event together with everything recorded against it:
--    its transactions (and their donation / aid / vendor-payment rows), stall bookings and team.
--    One audit entry keeps a summary and a copy of the event row.
create or replace function public.delete_event(p_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_event    public.events;
  v_txns     uuid[];
  v_bookings uuid[];
  v_in       numeric;
  v_out      numeric;
begin
  perform public.require_finance();
  if length(trim(coalesce(p_reason, ''))) < 3 then raise exception 'Give a short reason for deleting'; end if;
  select * into v_event from public.events where id = p_id for update;
  if not found then raise exception 'Event not found'; end if;

  select coalesce(array_agg(id), '{}') into v_bookings from public.event_vendors where event_id = p_id;
  select coalesce(array_agg(id), '{}') into v_txns from public.transactions
   where event_id = p_id
      or id in (select transaction_id from public.vendor_payments where event_vendor_id = any (v_bookings));
  select coalesce(sum(amount) filter (where direction = 'in' and status = 'posted'), 0),
         coalesce(sum(amount) filter (where direction = 'out' and status = 'posted'), 0)
    into v_in, v_out from public.transactions where id = any (v_txns);

  delete from public.donations       where transaction_id = any (v_txns);
  delete from public.distributions   where transaction_id = any (v_txns);
  delete from public.vendor_payments where transaction_id = any (v_txns);
  delete from public.transactions    where id = any (v_txns);
  delete from public.event_vendors   where id = any (v_bookings);
  delete from public.event_members   where event_id = p_id;
  delete from public.events          where id = p_id;

  -- The row triggers logged each booking/event delete separately; replace them with one clear entry.
  delete from public.audit_logs
   where created_at = now() and action = 'delete' and (entity_id = p_id or entity_id = any (v_bookings));
  perform public.write_audit('delete', 'event', p_id,
    'Deleted event ' || v_event.name || ' with ' || cardinality(v_bookings) || ' stall bookings and ' || cardinality(v_txns)
      || ' transactions (in ' || public.pkr(v_in) || ', out ' || public.pkr(v_out) || '): ' || trim(p_reason),
    jsonb_build_object('deleted', to_jsonb(v_event), 'transactions', to_jsonb(v_txns), 'bookings', to_jsonb(v_bookings)));
end $$;

revoke execute on function public.delete_event(uuid, text) from public, anon;
grant execute on function public.delete_event(uuid, text) to authenticated;
grant execute on function public.set_user_role(uuid, public.app_role) to authenticated;
