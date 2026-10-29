-- Aarambh early-access table. Run once in Supabase SQL Editor.
create table if not exists public.launch_interest (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 100),
  email text not null check (char_length(trim(email)) between 5 and 254),
  location text not null check (char_length(trim(location)) between 2 and 120),
  profile_for text not null check (
    profile_for in ('Myself', 'My son or daughter', 'A family member')
  ),
  consent boolean not null default false check (consent = true),
  created_at timestamptz not null default now()
);

alter table public.launch_interest enable row level security;
grant usage on schema public to anon;
revoke all on table public.launch_interest from anon, authenticated;
grant insert on table public.launch_interest to anon;

drop policy if exists "Visitor may submit launch interest" on public.launch_interest;

create policy "Visitor may submit launch interest"
  on public.launch_interest
  for insert
  to anon
  with check (consent = true);
