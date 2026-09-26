-- =====================================================================
-- EscrowAgent update 003 — per-user counts by status AND role
-- Run once in Supabase: SQL Editor -> New query -> paste -> Run.
-- Safe to run again. Replaces the function from update 002.
--
-- user_status_counts(email) now returns one row per (status, role),
-- where role is the part that email plays: Buyer or Seller.
-- Same privacy rule as before: yourself, your counterparties, or any
-- user if you are an administrator.
-- =====================================================================
drop function if exists public.user_status_counts(text);

create function public.user_status_counts(p_email text)
returns table (status public.txn_status, role public.txn_role, total bigint)
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
    select t.status,
           case
             when t.creator_email = v_email then t.creator_role
             when t.creator_role = 'Buyer'  then 'Seller'::public.txn_role
             else 'Buyer'::public.txn_role
           end,
           count(*)::bigint
      from public.transactions t
     where t.creator_email = v_email or t.counterparty_email = v_email
     group by 1, 2;
end $$;

revoke all on function public.user_status_counts(text) from public, anon;
grant execute on function public.user_status_counts(text) to authenticated;
