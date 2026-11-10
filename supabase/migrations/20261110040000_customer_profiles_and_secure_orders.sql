-- =====================================================================
-- Customer profiles, Stripe payment tracking, and locked-down orders
-- Run this once in the Supabase SQL Editor for project iciycfidjapbixrmdugb.
-- Safe to re-run.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Admin accounts
--    Add your own login to this table so the /admin page keeps working:
--    insert into public.admin_users (user_id)
--      select id from auth.users where email = 'you@lidar.rentals';
-- ---------------------------------------------------------------------
create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admin_users enable row level security;

drop policy if exists "admin_users_read_own" on public.admin_users;
create policy "admin_users_read_own" on public.admin_users
  for select to authenticated using (user_id = auth.uid());

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.admin_users where user_id = auth.uid()) $$;

grant execute on function public.is_admin() to anon, authenticated;

-- ---------------------------------------------------------------------
-- 2. Customer profiles (one per login)
-- ---------------------------------------------------------------------
create table if not exists public.customer_profiles (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  email      text not null default '',
  full_name  text not null default '',
  company    text not null default '',
  phone      text not null default '',
  street1    text not null default '',
  city       text not null default '',
  state      text not null default '',
  zip        text not null default '',
  country    text not null default 'CA',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.customer_profiles enable row level security;

drop policy if exists "profiles_select_own" on public.customer_profiles;
create policy "profiles_select_own" on public.customer_profiles
  for select to authenticated using (user_id = auth.uid() or public.is_admin());

drop policy if exists "profiles_insert_own" on public.customer_profiles;
create policy "profiles_insert_own" on public.customer_profiles
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "profiles_update_own" on public.customer_profiles;
create policy "profiles_update_own" on public.customer_profiles
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- 3. Orders: link to customer + Stripe payment confirmation
--    "status" stays the fulfilment status used by the admin page
--    (pending / confirmed / shipped / returned).
--    "payment_status" is set ONLY by the server after a Stripe
--    webhook signature has been verified.
-- ---------------------------------------------------------------------
alter table public.orders
  add column if not exists reference                text,
  add column if not exists user_id                  uuid references auth.users(id) on delete set null,
  add column if not exists subtotal                 numeric(10,2) not null default 0,
  add column if not exists shipping_cost            numeric(10,2) not null default 0,
  add column if not exists currency                 text not null default 'usd',
  add column if not exists rental_start             date,
  add column if not exists rental_end               date,
  add column if not exists payment_status           text not null default 'unpaid',
  add column if not exists stripe_session_id        text,
  add column if not exists stripe_payment_intent_id text,
  add column if not exists stripe_receipt_url       text,
  add column if not exists stripe_event_id          text,
  add column if not exists amount_paid              numeric(10,2),
  add column if not exists paid_at                  timestamptz,
  add column if not exists tracking_number          text,
  add column if not exists tracking_carrier         text,
  add column if not exists invoice_url              text,
  add column if not exists coi_url                  text;

create unique index if not exists orders_reference_key      on public.orders (reference);
create unique index if not exists orders_stripe_session_key on public.orders (stripe_session_id);
create index        if not exists orders_user_id_idx         on public.orders (user_id);
create index        if not exists order_items_order_id_idx   on public.order_items (order_id);

-- ---------------------------------------------------------------------
-- 4. Close the old "anyone can read/edit/delete" policies
-- ---------------------------------------------------------------------
drop policy if exists "anon_select_orders"      on public.orders;
drop policy if exists "anon_insert_orders"      on public.orders;
drop policy if exists "anon_update_orders"      on public.orders;
drop policy if exists "anon_delete_orders"      on public.orders;
drop policy if exists "anon_select_order_items" on public.order_items;
drop policy if exists "anon_insert_order_items" on public.order_items;
drop policy if exists "anon_update_order_items" on public.order_items;
drop policy if exists "anon_delete_order_items" on public.order_items;

alter table public.orders      enable row level security;
alter table public.order_items enable row level security;

-- Customers read their own orders; admins read all.
-- No insert policy: orders are only created by the server (service role).
drop policy if exists "orders_select_own_or_admin" on public.orders;
create policy "orders_select_own_or_admin" on public.orders
  for select to authenticated using (user_id = auth.uid() or public.is_admin());

drop policy if exists "orders_admin_update" on public.orders;
create policy "orders_admin_update" on public.orders
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "orders_admin_delete" on public.orders;
create policy "orders_admin_delete" on public.orders
  for delete to authenticated using (public.is_admin());

drop policy if exists "order_items_select_own_or_admin" on public.order_items;
create policy "order_items_select_own_or_admin" on public.order_items
  for select to authenticated using (
    public.is_admin()
    or exists (select 1 from public.orders o where o.id = order_items.order_id and o.user_id = auth.uid())
  );

-- Even admins can only change fulfilment fields from the browser.
-- Payment fields can only be written by the server's verified Stripe webhook.
revoke insert, update, delete on public.orders      from anon, authenticated;
revoke insert, update, delete on public.order_items from anon, authenticated;
grant update (status, tracking_number, tracking_carrier, invoice_url, coi_url) on public.orders to authenticated;
grant delete on public.orders to authenticated;
