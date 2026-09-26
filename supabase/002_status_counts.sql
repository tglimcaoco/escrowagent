-- =====================================================================
-- EscrowAgent update 002 — per-user transaction counts by status
-- Run once in Supabase: SQL Editor -> New query -> paste -> Run.
-- Safe to run again.
--
-- user_status_counts(email) returns how many transactions that email is
-- part of (as buyer or seller), grouped by status. A user may look up:
--   * themselves,
--   * anyone they share at least one transaction with,
--   * anyone at all, if they are an administrator.
-- =====================================================================
create or replace function public.user_status_counts(p_email text)
returns table (status public.txn_status, total bigint)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_me    text := public.current_email();
begin
  if auth.uid() is null then raise exception 'Log in first.'; end if;

  if not (
    v_email = v_me
    or public.is_admin()
    or exists (
      select 1 from public.transactions t
      where (t.creator_id = auth.uid() or t.counterparty_email = v_me)
        and (t.creator_email = v_email or t.counterparty_email = v_email)
    )
  ) then
    raise exception 'You can only view summaries for your own counterparties.';
  end if;

  return query
    select t.status, count(*)::bigint
      from public.transactions t
     where t.creator_email = v_email or t.counterparty_email = v_email
     group by t.status;
end $$;

revoke all on function public.user_status_counts(text) from public, anon;
grant execute on function public.user_status_counts(text) to authenticated;
