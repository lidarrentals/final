-- Run once in Supabase → SQL Editor.

-- 1) Private bucket for the knowledge base (never public).
insert into storage.buckets (id, name, public)
values ('kb', 'kb', false)
on conflict (id) do update set public = false;

-- 2) OPTION A (default): any signed-in user can read the bucket.
--    Combine with Auth → "Allow new users to sign up" = OFF and invite only the people you want.
drop policy if exists "kb read for signed-in users" on storage.objects;
create policy "kb read for signed-in users"
on storage.objects for select to authenticated
using (bucket_id = 'kb');

-- 2) OPTION B (stricter): only users on an allowlist can read. To use it, delete the policy above, then run:
--
-- create table if not exists public.kb_access (user_id uuid primary key references auth.users(id) on delete cascade);
-- alter table public.kb_access enable row level security;
-- create policy "users see own row" on public.kb_access for select to authenticated using (user_id = auth.uid());
-- create policy "kb read for allowlisted users" on storage.objects for select to authenticated
--   using (bucket_id = 'kb' and exists (select 1 from public.kb_access a where a.user_id = auth.uid()));
-- -- then grant access per customer:
-- -- insert into public.kb_access (user_id) select id from auth.users where email = 'customer@example.com';

-- No insert/update/delete policies are created, so only the service_role key (used by scripts/upload.mjs) can write.
