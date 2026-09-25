-- Lets the Finance Secretary permanently delete a transaction.
-- The linked donation / aid / vendor-payment row goes with it. A full copy of what was
-- deleted is kept in audit_logs, so the record can still be traced after deletion.
create or replace function public.delete_transaction(p_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_txn    public.transactions;
  v_detail jsonb;
begin
  perform public.require_finance();
  if length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception 'Give a short reason for deleting';
  end if;

  select * into v_txn from public.transactions where id = p_id for update;
  if not found then raise exception 'Transaction not found'; end if;

  select coalesce(
           (select to_jsonb(d) from public.donations d where d.transaction_id = p_id),
           (select to_jsonb(x) from public.distributions x where x.transaction_id = p_id),
           (select to_jsonb(v) from public.vendor_payments v where v.transaction_id = p_id))
    into v_detail;

  delete from public.donations       where transaction_id = p_id;
  delete from public.distributions   where transaction_id = p_id;
  delete from public.vendor_payments where transaction_id = p_id;
  delete from public.transactions    where id = p_id;

  perform public.write_audit('delete', 'transaction', p_id,
    'Deleted ' || v_txn.code || ' (' || public.pkr(v_txn.amount) || ', ' || v_txn.description || '): ' || trim(p_reason),
    jsonb_build_object('deleted', to_jsonb(v_txn), 'detail', v_detail));
end $$;

revoke execute on function public.delete_transaction(uuid, text) from public, anon;
grant execute on function public.delete_transaction(uuid, text) to authenticated;
