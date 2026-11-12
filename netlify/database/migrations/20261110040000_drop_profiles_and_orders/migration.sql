-- Customer data now lives only in Supabase. This removes the tables created by
-- 20261110015931_create_profiles_and_orders so nothing is stored in Netlify Database.
DROP TABLE IF EXISTS "orders";
DROP TABLE IF EXISTS "customer_profiles";
