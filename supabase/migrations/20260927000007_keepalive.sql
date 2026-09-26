-- Keep-alive for the Supabase free plan, which pauses a project after about a week with no activity.
-- A cron job calls keepalive_ping(): it writes one row and deletes it in the same call,
-- so the database sees real write activity but nothing is left behind.
create table if not exists public.keepalive (
  id        bigint generated always as identity primary key,
  pinged_at timestamptz not null default now()
);
alter table public.keepalive enable row level security;   -- no policies: nobody can read or write it directly
revoke all on public.keepalive from anon, authenticated;

create or replace function public.keepalive_ping() returns jsonb
language plpgsql security definer set search_path = public
as $$
declare v_id bigint; v_at timestamptz;
begin
  insert into public.keepalive default values returning id, pinged_at into v_id, v_at;
  delete from public.keepalive where id = v_id;
  return jsonb_build_object('ok', true, 'pinged_at', v_at);
end $$;

-- The cron job uses the public anon key, so anon may call this one function and nothing else new.
-- Worst case someone else calls it too: it only inserts and deletes one empty row.
revoke execute on function public.keepalive_ping() from public;
grant execute on function public.keepalive_ping() to anon, authenticated;
