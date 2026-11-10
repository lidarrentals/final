-- =====================================================================
-- Stripe payment tracking and row-level security (RLS) so customers can
-- only ever see their own data
-- Run this once in the Supabase SQL Editor for project iciycfidjapbixrmdugb.
-- Tables: public.profiles, public.orders, public.order_items, public.admin_users
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

-- 2. Customer profiles: existing table public.profiles (id = auth user id).
--    Adds the contact / delivery columns used by checkout and the dashboard,
--    and restricts every row to its owner (admins can read all).
-- ---------------------------------------------------------------------
alter table public.profiles
  add column if not exists email      text not null default '',
  add column if not exists full_name  text not null default '',
  add column if not exists company    text not null default '',
  add column if not exists phone      text not null default '',
  add column if not exists street1    text not null default '',
  add column if not exists city       text not null default '',
  add column if not exists state      text not null default '',
  add column if not exists zip        text not null default '',
  add column if not exists country    text not null default 'CA',
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.profiles enable row level security;

-- Replace whatever policies existed with owner-only access
do $$
declare r record;
begin
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'profiles' loop
    execute format('drop policy %I on public.profiles', r.policyname);
  end loop;
end $$;

create policy "profiles_select_own" on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_admin());
create policy "profiles_insert_own" on public.profiles
  for insert to authenticated with check (id = auth.uid());
create policy "profiles_update_own" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

revoke all on public.profiles from anon;
grant select, insert, update on public.profiles to authenticated;

-- Drop the unused table an earlier version of this file created, if present
drop table if exists public.customer_profiles;

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

-- ---------------------------------------------------------------------
-- 5. Service consultation requests (leads): visitors can submit the form,
--    but only admins can read submissions. The Calendly flow is unchanged.
-- ---------------------------------------------------------------------
do $$
declare r record;
begin
  if to_regclass('public.leads') is not null then
    alter table public.leads enable row level security;
    for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'leads' loop
      execute format('drop policy %I on public.leads', r.policyname);
    end loop;
    create policy "leads_insert_anyone" on public.leads for insert to anon, authenticated with check (true);
    create policy "leads_select_admin"  on public.leads for select to authenticated using (public.is_admin());
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 6. Catalog tables: everyone can read, nobody can edit from the browser.
--    (The old policies let any visitor change prices or delete equipment.
--    Edit the catalog from the Supabase dashboard, which is unaffected.)
-- ---------------------------------------------------------------------
drop policy if exists "anon_insert_equipment"  on public.equipment;
drop policy if exists "anon_update_equipment"  on public.equipment;
drop policy if exists "anon_delete_equipment"  on public.equipment;
drop policy if exists "anon_insert_categories" on public.categories;
drop policy if exists "anon_update_categories" on public.categories;
drop policy if exists "anon_delete_categories" on public.categories;
drop policy if exists "anon_insert_services"   on public.services;
drop policy if exists "anon_update_services"   on public.services;
drop policy if exists "anon_delete_services"   on public.services;
