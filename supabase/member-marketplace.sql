-- Arambh member marketplace. Safe to rerun: policies/triggers are replaced idempotently.
-- Run in the Supabase SQL Editor for project afqvejojxysdxvjcacyu.

create table if not exists public.member_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  profile_for text not null default 'self'
    check (profile_for in ('self', 'son_daughter', 'family_member')),
  display_name text not null check (char_length(btrim(display_name)) between 2 and 100),
  gender text not null check (gender in ('Woman', 'Man', 'Non-binary', 'Prefer not to say')),
  date_of_birth date not null,
  height_cm smallint not null check (height_cm between 120 and 230),
  marital_status text not null
    check (marital_status in ('Never married', 'Divorced', 'Widowed', 'Separated')),
  mother_tongue text check (mother_tongue is null or char_length(mother_tongue) <= 80),
  religion text check (religion is null or char_length(religion) <= 80),
  community text check (community is null or char_length(community) <= 100),
  show_religion boolean not null default false,
  show_community boolean not null default false,
  city text not null check (char_length(btrim(city)) between 1 and 100),
  country text not null check (char_length(btrim(country)) between 1 and 80),
  education text check (education is null or char_length(education) <= 160),
  occupation text check (occupation is null or char_length(occupation) <= 160),
  phone_number text check (phone_number is null or char_length(phone_number) <= 40),
  about_me text check (about_me is null or char_length(about_me) <= 1200),
  personality text[] not null default '{}',
  family_background text check (family_background is null or char_length(family_background) <= 800),
  partner_expectations text check (partner_expectations is null or char_length(partner_expectations) <= 1000),
  photo_path text,
  publish_consent boolean not null default false,
  is_published boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint published_profile_has_consent check (not is_published or publish_consent = true)
);

create table if not exists public.member_preferences (
  member_id uuid primary key references public.member_profiles(id) on delete cascade,
  preferred_gender text check (preferred_gender is null or preferred_gender in ('Woman', 'Man', 'Non-binary')),
  min_age smallint not null default 18 check (min_age between 18 and 100),
  max_age smallint check (max_age is null or max_age between 18 and 100),
  min_height_cm smallint check (min_height_cm is null or min_height_cm between 120 and 230),
  max_height_cm smallint check (max_height_cm is null or max_height_cm between 120 and 230),
  preferred_religions text[] not null default '{}',
  preferred_communities text[] not null default '{}',
  preferred_locations text[] not null default '{}',
  preferred_education text[] not null default '{}',
  updated_at timestamptz not null default now(),
  constraint valid_preferred_age_range check (max_age is null or min_age <= max_age),
  constraint valid_preferred_height_range check (
    min_height_cm is null or max_height_cm is null or min_height_cm <= max_height_cm
  )
);

create or replace function public.enforce_adult_member_profile()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.date_of_birth > (current_date - interval '18 years')::date then
    raise exception 'Arambh member profiles are for adults aged 18 and over.';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_adult_member_profile on public.member_profiles;
create trigger enforce_adult_member_profile
before insert or update of date_of_birth on public.member_profiles
for each row execute function public.enforce_adult_member_profile();

create or replace function public.touch_member_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists touch_member_profiles_updated_at on public.member_profiles;
create trigger touch_member_profiles_updated_at
before update on public.member_profiles
for each row execute function public.touch_member_updated_at();

drop trigger if exists touch_member_preferences_updated_at on public.member_preferences;
create trigger touch_member_preferences_updated_at
before update on public.member_preferences
for each row execute function public.touch_member_updated_at();

alter table public.member_profiles enable row level security;
alter table public.member_preferences enable row level security;
revoke all on public.member_profiles from anon, authenticated;
revoke all on public.member_preferences from anon, authenticated;
grant select, insert, update, delete on public.member_profiles to authenticated;
grant select, insert, update, delete on public.member_preferences to authenticated;

drop policy if exists "Members read their own profile" on public.member_profiles;
create policy "Members read their own profile"
  on public.member_profiles for select to authenticated
  using (id = (select auth.uid()));

drop policy if exists "Members create their own profile" on public.member_profiles;
create policy "Members create their own profile"
  on public.member_profiles for insert to authenticated
  with check (id = (select auth.uid()));

drop policy if exists "Members update their own profile" on public.member_profiles;
create policy "Members update their own profile"
  on public.member_profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

drop policy if exists "Members delete their own profile" on public.member_profiles;
create policy "Members delete their own profile"
  on public.member_profiles for delete to authenticated
  using (id = (select auth.uid()));

drop policy if exists "Members read their own preferences" on public.member_preferences;
create policy "Members read their own preferences"
  on public.member_preferences for select to authenticated
  using (member_id = (select auth.uid()));

drop policy if exists "Members manage their own preferences" on public.member_preferences;
create policy "Members manage their own preferences"
  on public.member_preferences for all to authenticated
  using (member_id = (select auth.uid()))
  with check (member_id = (select auth.uid()));

create or replace function public.search_members(
  p_gender text default null,
  p_min_age integer default null,
  p_max_age integer default null,
  p_min_height integer default null,
  p_max_height integer default null,
  p_religions text[] default null,
  p_communities text[] default null,
  p_locations text[] default null,
  p_education text[] default null,
  p_limit integer default 24,
  p_offset integer default 0
)
returns table (
  id uuid,
  display_name text,
  gender text,
  age integer,
  height_cm smallint,
  marital_status text,
  city text,
  country text,
  education text,
  occupation text,
  about_me text,
  personality text[],
  partner_expectations text,
  photo_path text,
  religion text,
  community text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception using errcode = '42501', message = 'Sign in to browse member profiles.';
  end if;

  return query
  select
    p.id,
    p.display_name,
    p.gender,
    pg_catalog.date_part('year', pg_catalog.age(current_date, p.date_of_birth))::integer,
    p.height_cm,
    p.marital_status,
    p.city,
    p.country,
    p.education,
    p.occupation,
    p.about_me,
    p.personality,
    p.partner_expectations,
    p.photo_path,
    case when p.show_religion then p.religion else null end,
    case when p.show_community then p.community else null end
  from public.member_profiles as p
  where p.is_published = true
    and p.publish_consent = true
    and p.id <> (select auth.uid())
    and (p_gender is null or p.gender = p_gender)
    and (p_min_age is null or pg_catalog.date_part('year', pg_catalog.age(current_date, p.date_of_birth))::integer >= greatest(p_min_age, 18))
    and (p_max_age is null or pg_catalog.date_part('year', pg_catalog.age(current_date, p.date_of_birth))::integer <= p_max_age)
    and (p_min_height is null or p.height_cm >= p_min_height)
    and (p_max_height is null or p.height_cm <= p_max_height)
    and (
      coalesce(pg_catalog.cardinality(p_religions), 0) = 0
      or exists (select 1 from pg_catalog.unnest(p_religions) as wanted(value)
                 where pg_catalog.lower(pg_catalog.btrim(wanted.value)) = pg_catalog.lower(coalesce(p.religion, '')))
    )
    and (
      coalesce(pg_catalog.cardinality(p_communities), 0) = 0
      or exists (select 1 from pg_catalog.unnest(p_communities) as wanted(value)
                 where pg_catalog.lower(pg_catalog.btrim(wanted.value)) = pg_catalog.lower(coalesce(p.community, '')))
    )
    and (
      coalesce(pg_catalog.cardinality(p_locations), 0) = 0
      or exists (select 1 from pg_catalog.unnest(p_locations) as wanted(value)
                 where (p.city || ' ' || p.country) ilike '%' || pg_catalog.btrim(wanted.value) || '%')
    )
    and (
      coalesce(pg_catalog.cardinality(p_education), 0) = 0
      or exists (select 1 from pg_catalog.unnest(p_education) as wanted(value)
                 where pg_catalog.lower(coalesce(p.education, '')) like '%' || pg_catalog.lower(pg_catalog.btrim(wanted.value)) || '%')
    )
  order by p.published_at desc nulls last, p.display_name
  limit least(greatest(coalesce(p_limit, 24), 1), 40)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

revoke all on function public.search_members(text, integer, integer, integer, integer, text[], text[], text[], text[], integer, integer) from public, anon;
grant execute on function public.search_members(text, integer, integer, integer, integer, text[], text[], text[], text[], integer, integer) to authenticated;

create or replace function public.can_view_member_photo(profile_folder text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and (
      (select auth.uid())::text = profile_folder
      or exists (
        select 1 from public.member_profiles as p
        where p.id::text = profile_folder
          and p.is_published = true
          and p.publish_consent = true
      )
    );
$$;

revoke all on function public.can_view_member_photo(text) from public, anon;
grant execute on function public.can_view_member_photo(text) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('member-photos', 'member-photos', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
set public = false, file_size_limit = 5242880, allowed_mime_types = array['image/jpeg','image/png','image/webp'];

drop policy if exists "Members upload their own photos" on storage.objects;
create policy "Members upload their own photos"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'member-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Members update their own photos" on storage.objects;
create policy "Members update their own photos"
  on storage.objects for update to authenticated
  using (bucket_id = 'member-photos' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'member-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Members delete their own photos" on storage.objects;
create policy "Members delete their own photos"
  on storage.objects for delete to authenticated
  using (bucket_id = 'member-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Members read published profile photos" on storage.objects;
create policy "Members read published profile photos"
  on storage.objects for select to authenticated
  using (bucket_id = 'member-photos' and public.can_view_member_photo((storage.foldername(name))[1]));
