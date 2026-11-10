-- =====================================================================
-- BEFORE YOU CLICK RUN: scroll to the bottom and replace
-- YOUR-LOGIN-EMAIL@example.com with the email you use to log in to
-- the lidar.rentals website. That makes you the admin.
-- =====================================================================
-- Lidar.Rentals: customer profiles, Stripe-verified orders, and lockdown
-- Run this once in the Supabase SQL Editor for project iciycfidjapbixrmdugb.
-- Safe to re-run.
--
-- Access model:
--   * Customers never read or write these tables directly. The browser has
--     NO access to profiles, orders, order_items or admin_users.
--   * The website's server functions (using the service-role key) read and
--     write them, and only ever return the signed-in customer's own rows.
--   * Payment fields are only written after a Stripe webhook signature has
--     been verified.
-- =====================================================================

-- Helper: remove every existing policy on a table
create or replace function pg_temp.drop_all_policies(tbl text)
returns void language plpgsql as $$
declare r record;
begin
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = tbl loop
    execute format('drop policy %I on public.%I', r.policyname, tbl);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 1. Admin accounts (who can manage all orders on the website's /admin page)
--    Your own login is added at the very bottom of this file.
-- ---------------------------------------------------------------------
create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Remove the browser helper from earlier versions of this file
drop function if exists public.is_admin() cascade;

-- ---------------------------------------------------------------------
-- 2. Customer profiles: existing table public.profiles (id = auth user id)
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

drop table if exists public.customer_profiles;

-- ---------------------------------------------------------------------
-- 3. Orders: link to customer + Stripe payment confirmation
--    "status" = fulfilment (pending / confirmed / shipped / returned)
--    "payment_status" = set only by the verified Stripe webhook
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
-- 4. Lock down customer data: RLS on, no policies, no grants for the
--    browser roles. Only the server (service role) can reach these rows.
-- ---------------------------------------------------------------------
select pg_temp.drop_all_policies('profiles');
select pg_temp.drop_all_policies('orders');
select pg_temp.drop_all_policies('order_items');
select pg_temp.drop_all_policies('admin_users');

alter table public.profiles    enable row level security;
alter table public.orders      enable row level security;
alter table public.order_items enable row level security;
alter table public.admin_users enable row level security;

alter table public.profiles    force row level security;
alter table public.orders      force row level security;
alter table public.order_items force row level security;
alter table public.admin_users force row level security;

revoke all on public.profiles    from anon, authenticated;
revoke all on public.orders      from anon, authenticated;
revoke all on public.order_items from anon, authenticated;
revoke all on public.admin_users from anon, authenticated;

-- ---------------------------------------------------------------------
-- 5. Service consultation requests (leads): visitors can submit the form
--    (Calendly flow unchanged) but nobody can read submissions from the
--    browser. View them in the Supabase dashboard.
-- ---------------------------------------------------------------------
do $$
begin
  if to_regclass('public.leads') is not null then
    perform pg_temp.drop_all_policies('leads');
    alter table public.leads enable row level security;
    revoke all on public.leads from anon, authenticated;
    grant insert on public.leads to anon, authenticated;
    create policy "leads_insert_anyone" on public.leads for insert to anon, authenticated with check (true);
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 6. Catalog tables: everyone can read, nobody can edit from the browser.
--    Edit the catalog from the Supabase dashboard, which is unaffected.
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

-- ---------------------------------------------------------------------
-- 7. Make yourself an admin.  EDIT THE EMAIL BELOW, THEN CLICK RUN.
--    (Use the email you log in to the lidar.rentals website with.)
-- ---------------------------------------------------------------------
insert into public.admin_users (user_id)
select id from auth.users where lower(email) = lower('YOUR-LOGIN-EMAIL@example.com')
on conflict do nothing;
