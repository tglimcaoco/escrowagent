-- =====================================================================
-- EscrowAgent — Supabase schema
-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run.
--
-- Design: users can READ only transactions they are part of. Nobody
-- writes to the tables directly — every change goes through the
-- functions below, which enforce the status rules on the server:
--   Waiting  -> Pending     counterparty accepts (email must match)
--   Waiting/Pending -> Cancelled   either party
--   Funded   -> Completed   buyer releases payment
--   Funded   -> Refunded    seller returns payment
--   anything -> anything    administrators only (admin_set_status)
-- =====================================================================

-- ---------- types ----------
do $$ begin
  create type public.txn_status as enum ('Waiting','Pending','Funded','Completed','Refunded','Cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.txn_role as enum ('Buyer','Seller');
exception when duplicate_object then null; end $$;

-- ---------- administrators ----------
create table if not exists public.admins (
  user_id  uuid primary key references auth.users(id) on delete cascade,
  added_at timestamptz not null default now()
);
alter table public.admins enable row level security;
drop policy if exists "read own admin row" on public.admins;
create policy "read own admin row" on public.admins
  for select using (user_id = auth.uid());

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

create or replace function public.current_email()
returns text language sql stable as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''));
$$;

-- ---------- transactions ----------
create table if not exists public.transactions (
  code               text primary key,
  description        text not null check (char_length(description) between 1 and 500),
  amount             numeric(14,2) not null check (amount > 0),
  currency           text not null default 'PHP',
  creator_id         uuid not null references auth.users(id),
  creator_email      text not null,
  creator_role       public.txn_role not null,
  counterparty_email text not null,
  counterparty_id    uuid references auth.users(id),
  status             public.txn_status not null default 'Waiting',
  created_at         timestamptz not null default now(),
  accepted_at        timestamptz,
  updated_at         timestamptz not null default now(),
  check (creator_email <> counterparty_email)
);
create index if not exists transactions_creator_idx      on public.transactions (creator_id);
create index if not exists transactions_counterparty_idx on public.transactions (counterparty_email);
create index if not exists transactions_updated_idx      on public.transactions (updated_at desc);

alter table public.transactions enable row level security;
drop policy if exists "parties and admins read" on public.transactions;
create policy "parties and admins read" on public.transactions
  for select using (
    creator_id = auth.uid()
    or counterparty_email = public.current_email()
    or public.is_admin()
  );
-- No insert / update / delete policies on purpose.

-- ---------- status history ----------
create table if not exists public.transaction_events (
  id          bigint generated always as identity primary key,
  code        text not null references public.transactions(code) on delete cascade,
  from_status public.txn_status,
  to_status   public.txn_status not null,
  actor_id    uuid,
  actor_email text,
  by_admin    boolean not null default false,
  note        text,
  created_at  timestamptz not null default now()
);
create index if not exists transaction_events_code_idx on public.transaction_events (code);

alter table public.transaction_events enable row level security;
drop policy if exists "read events of visible transactions" on public.transaction_events;
create policy "read events of visible transactions" on public.transaction_events
  for select using (
    exists (select 1 from public.transactions t where t.code = transaction_events.code)
  );

create or replace function public._log_event(p_code text, p_from public.txn_status, p_to public.txn_status, p_admin boolean, p_note text)
returns void language sql security definer set search_path = public as $$
  insert into public.transaction_events (code, from_status, to_status, actor_id, actor_email, by_admin, note)
  values (p_code, p_from, p_to, auth.uid(), public.current_email(), p_admin, nullif(trim(coalesce(p_note,'')), ''));
$$;

-- ---------- create ----------
create or replace function public.create_transaction(
  p_role public.txn_role, p_description text, p_amount numeric, p_counterparty_email text)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_me    text := public.current_email();
  v_cp    text := lower(trim(coalesce(p_counterparty_email, '')));
  v_alpha text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';  -- no 0/O/1/I
  v_idx   int[] := array[0,1,2,3,4,5,10,11];           -- fully random bytes of a v4 uuid
  v_bytes bytea;
  v_raw   text;
  v_code  text;
  i       int;
begin
  if auth.uid() is null then raise exception 'Log in to create a transaction.'; end if;
  if coalesce(trim(p_description), '') = '' then raise exception 'Describe what''s being bought or sold.'; end if;
  if char_length(trim(p_description)) > 500 then raise exception 'Keep the description under 500 characters.'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Enter an amount greater than zero.'; end if;
  if v_cp !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Enter the other party''s email address.'; end if;
  if v_cp = v_me then raise exception 'The other party must use a different email from yours.'; end if;

  loop
    v_bytes := uuid_send(gen_random_uuid());
    v_raw := '';
    for i in 1..8 loop
      v_raw := v_raw || substr(v_alpha, 1 + (get_byte(v_bytes, v_idx[i]) % 32), 1);
    end loop;
    v_code := 'EA-' || substr(v_raw, 1, 4) || '-' || substr(v_raw, 5, 4);
    exit when not exists (select 1 from public.transactions where code = v_code);
  end loop;

  insert into public.transactions (code, description, amount, creator_id, creator_email, creator_role, counterparty_email)
  values (v_code, trim(p_description), round(p_amount, 2), auth.uid(), v_me, p_role, v_cp);

  perform public._log_event(v_code, null, 'Waiting', false, 'Created');
  return v_code;
end $$;

-- ---------- accept ----------
create or replace function public.accept_transaction(p_code text)
returns public.transactions language plpgsql security definer set search_path = public as $$
declare t public.transactions;
begin
  if auth.uid() is null then raise exception 'Log in to accept a transaction.'; end if;
  select * into t from public.transactions where code = upper(trim(p_code)) for update;
  if not found then raise exception 'No transaction has that code. Check it with the person who sent it.'; end if;
  if t.creator_id = auth.uid() then raise exception 'You created this transaction. Share the code with the other party instead.'; end if;
  if t.counterparty_email <> public.current_email() then raise exception 'This transaction was sent to a different email address.'; end if;
  if t.status <> 'Waiting' then raise exception 'This transaction is already %.', lower(t.status::text); end if;

  update public.transactions
     set status = 'Pending', counterparty_id = auth.uid(), accepted_at = now(), updated_at = now()
   where code = t.code
  returning * into t;

  perform public._log_event(t.code, 'Waiting', 'Pending', false, 'Accepted by counterparty');
  return t;
end $$;

-- ---------- party actions: cancel / release / return ----------
create or replace function public.update_my_transaction(p_code text, p_action text)
returns public.transactions language plpgsql security definer set search_path = public as $$
declare
  t      public.transactions;
  v_role public.txn_role;
  v_to   public.txn_status;
  v_from public.txn_status;
begin
  if auth.uid() is null then raise exception 'Log in first.'; end if;
  select * into t from public.transactions where code = upper(trim(p_code)) for update;
  if not found then raise exception 'Transaction not found.'; end if;

  if t.creator_id = auth.uid() then
    v_role := t.creator_role;
  elsif t.counterparty_id = auth.uid()
     or (t.counterparty_id is null and t.counterparty_email = public.current_email()) then
    v_role := case when t.creator_role = 'Buyer' then 'Seller' else 'Buyer' end;
  else
    raise exception 'You are not a party to this transaction.';
  end if;

  v_from := t.status;
  if p_action = 'cancel' then
    if t.status not in ('Waiting','Pending') then raise exception 'Only waiting or pending transactions can be cancelled. This one is %.', lower(t.status::text); end if;
    v_to := 'Cancelled';
  elsif p_action = 'release' then
    if v_role <> 'Buyer' then raise exception 'Only the buyer can release payment.'; end if;
    if t.status <> 'Funded' then raise exception 'Payment can only be released once the transaction is funded.'; end if;
    v_to := 'Completed';
  elsif p_action = 'return' then
    if v_role <> 'Seller' then raise exception 'Only the seller can return payment.'; end if;
    if t.status <> 'Funded' then raise exception 'Payment can only be returned once the transaction is funded.'; end if;
    v_to := 'Refunded';
  else
    raise exception 'Unknown action.';
  end if;

  update public.transactions set status = v_to, updated_at = now() where code = t.code returning * into t;
  perform public._log_event(t.code, v_from, v_to, false, null);
  return t;
end $$;

-- ---------- administrator ----------
create or replace function public.admin_set_status(p_code text, p_status public.txn_status, p_note text default null)
returns public.transactions language plpgsql security definer set search_path = public as $$
declare t public.transactions; v_from public.txn_status;
begin
  if not public.is_admin() then raise exception 'Only administrators can change a transaction''s status directly.'; end if;
  select * into t from public.transactions where code = upper(trim(p_code)) for update;
  if not found then raise exception 'Transaction not found.'; end if;
  if t.status = p_status then return t; end if;
  v_from := t.status;
  update public.transactions set status = p_status, updated_at = now() where code = t.code returning * into t;
  perform public._log_event(t.code, v_from, p_status, true, p_note);
  return t;
end $$;

-- ---------- permissions ----------
revoke all on function public._log_event(text, public.txn_status, public.txn_status, boolean, text) from public, anon, authenticated;
revoke all on function public.create_transaction(public.txn_role, text, numeric, text) from public, anon;
revoke all on function public.accept_transaction(text) from public, anon;
revoke all on function public.update_my_transaction(text, text) from public, anon;
revoke all on function public.admin_set_status(text, public.txn_status, text) from public, anon;
grant execute on function public.create_transaction(public.txn_role, text, numeric, text) to authenticated;
grant execute on function public.accept_transaction(text) to authenticated;
grant execute on function public.update_my_transaction(text, text) to authenticated;
grant execute on function public.admin_set_status(text, public.txn_status, text) to authenticated;
grant execute on function public.is_admin() to authenticated;

-- ---------- per-user counts by status ----------
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

-- ---------- live updates ----------
do $$ begin
  alter publication supabase_realtime add table public.transactions;
exception when duplicate_object then null; end $$;

-- =====================================================================
-- Make yourself an administrator (run AFTER you've joined in the app):
--
--   insert into public.admins (user_id)
--   select id from auth.users where email = 'you@example.com';
-- =====================================================================
