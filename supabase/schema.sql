-- =====================================================================
-- Scrooolls database setup
-- Paste this whole file into Supabase → SQL Editor → New query → Run.
-- Safe to run once on a fresh project.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- People ----------
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  name text,
  email text,
  phone text,
  role text not null default 'reader' check (role in ('reader', 'contributor', 'admin')),
  bio text,
  first_hour int not null default 7 check (first_hour between 0 and 23),
  timezone text not null default 'Asia/Kolkata',
  onboarded boolean not null default false,
  last_morning_push date,
  created_at timestamptz not null default now()
);

-- ---------- Themes & genres ----------
create table public.themes (
  id serial primary key,
  name text not null unique,
  color text not null default '#FFD666',
  sort int not null default 0
);

create table public.genres (
  id serial primary key,
  name text not null unique,
  description text,
  sort int not null default 0
);

-- ---------- Stories ----------
create table public.stories (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  summary text not null,
  image_url text,
  link text,
  theme_id int references public.themes on delete set null,
  genre_id int references public.genres on delete set null,
  author_id uuid references public.profiles on delete set null,
  author_name text,
  status text not null default 'pending' check (status in ('pending', 'scheduled', 'published', 'rejected')),
  scheduled_for timestamptz,
  published_at timestamptz,
  notified_at timestamptz,
  created_at timestamptz not null default now()
);
create index stories_published_idx on public.stories (status, published_at desc);

-- ---------- Reader activity ----------
create table public.reads (
  user_id uuid not null references public.profiles on delete cascade,
  story_id uuid not null references public.stories on delete cascade,
  read_at timestamptz not null default now(),
  primary key (user_id, story_id)
);

create table public.user_themes (
  user_id uuid not null references public.profiles on delete cascade,
  theme_id int not null references public.themes on delete cascade,
  primary key (user_id, theme_id)
);

create table public.follows (
  user_id uuid not null references public.profiles on delete cascade,
  contributor_id uuid not null references public.profiles on delete cascade,
  primary key (user_id, contributor_id)
);

-- ---------- Contributor applications ----------
create table public.applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  topic text not null,
  about text,
  sample_link text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

-- ---------- Push notifications ----------
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create table public.push_log (
  id uuid primary key default gen_random_uuid(),
  kind text not null,            -- 'story' | 'manual' | 'morning'
  title text,
  body text,
  story_id uuid references public.stories on delete set null,
  sent_count int not null default 0,
  sent_at timestamptz not null default now()
);

-- =====================================================================
-- Helper functions
-- =====================================================================
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'contributor'));
$$;

-- New sign-up → profile row
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, email, name, phone)
  values (new.id, new.email, new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'phone');
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Only admins can change someone's role (the SQL editor can too)
create or replace function public.protect_role() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role and current_user = 'authenticated' and not is_admin() then
    raise exception 'Only an admin can change roles';
  end if;
  return new;
end;
$$;
create trigger profiles_protect_role before update on public.profiles
  for each row execute function public.protect_role();

-- Fill in author name and publish time automatically
create or replace function public.story_defaults() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    select coalesce(name, email) into new.author_name from profiles where id = new.author_id;
  end if;
  if new.status = 'published' and new.published_at is null then
    new.published_at := now();
  end if;
  return new;
end;
$$;
create trigger stories_defaults before insert or update on public.stories
  for each row execute function public.story_defaults();

-- When someone changes their name, update it on their stories too
create or replace function public.sync_author_name() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.name is distinct from old.name then
    update stories set author_name = coalesce(new.name, new.email) where author_id = new.id;
  end if;
  return new;
end;
$$;
create trigger profiles_sync_author_name after update on public.profiles
  for each row execute function public.sync_author_name();

-- Public list of contributors (name + bio only, never email/phone)
create or replace view public.contributors as
  select id, name, bio from public.profiles where role = 'contributor';
grant select on public.contributors to anon, authenticated;

-- =====================================================================
-- Security rules (Row Level Security)
-- =====================================================================
alter table public.profiles enable row level security;
alter table public.themes enable row level security;
alter table public.genres enable row level security;
alter table public.stories enable row level security;
alter table public.reads enable row level security;
alter table public.user_themes enable row level security;
alter table public.follows enable row level security;
alter table public.applications enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.push_log enable row level security;

-- profiles
create policy "read own or admin" on public.profiles for select using (id = auth.uid() or is_admin());
create policy "update own or admin" on public.profiles for update using (id = auth.uid() or is_admin());

-- themes & genres
create policy "anyone reads themes" on public.themes for select using (true);
create policy "admin writes themes" on public.themes for all using (is_admin()) with check (is_admin());
create policy "anyone reads genres" on public.genres for select using (true);
create policy "admin writes genres" on public.genres for all using (is_admin()) with check (is_admin());

-- stories
create policy "read published, own or admin" on public.stories for select
  using (status = 'published' or author_id = auth.uid() or is_admin());
create policy "staff create stories" on public.stories for insert
  with check (author_id = auth.uid() and (is_admin() or (is_staff() and status = 'pending')));
create policy "admin updates stories" on public.stories for update using (is_admin()) with check (is_admin());
create policy "admin deletes stories" on public.stories for delete using (is_admin());

-- reader activity (own rows only; admin can count)
create policy "own reads" on public.reads for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "admin sees reads" on public.reads for select using (is_admin());
create policy "own themes" on public.user_themes for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "admin sees themes picks" on public.user_themes for select using (is_admin());
create policy "own follows" on public.follows for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- applications
create policy "apply for self" on public.applications for insert with check (user_id = auth.uid());
create policy "see own or admin" on public.applications for select using (user_id = auth.uid() or is_admin());
create policy "admin decides" on public.applications for update using (is_admin()) with check (is_admin());

-- push
create policy "own subscriptions" on public.push_subscriptions for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "admin reads push log" on public.push_log for select using (is_admin());

-- =====================================================================
-- Table permissions (newer Supabase projects don't grant these automatically;
-- the security rules above still decide which rows each person can see)
-- =====================================================================
grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated, service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;
grant select on public.themes, public.genres, public.contributors to anon;
grant execute on function public.is_admin(), public.is_staff() to anon, authenticated, service_role;

-- =====================================================================
-- Image storage
-- =====================================================================
insert into storage.buckets (id, name, public) values ('story-images', 'story-images', true)
  on conflict (id) do nothing;
create policy "staff upload story images" on storage.objects for insert to authenticated
  with check (bucket_id = 'story-images' and public.is_staff());

-- =====================================================================
-- Starter themes & genres (edit any time in the dashboard)
-- =====================================================================
insert into public.themes (name, color, sort) values
  ('Hope', '#FFD666', 1), ('Love', '#F4A7BB', 2), ('Peace', '#9CC8EE', 3), ('Joy', '#FFAD7A', 4),
  ('Bible in a Year', '#A8D5B0', 5), ('Prayer', '#E9D8A6', 6), ('Identity', '#B8D8D8', 7), ('Wisdom', '#D8C3A5', 8);

insert into public.genres (name, description, sort) values
  ('Devotional', 'A verse and a thought for today', 1),
  ('Did You Know?', 'Surprising facts about the Bible', 2),
  ('Light-hearted', 'Funny and joyful moments in Scripture', 3),
  ('Deep Dive', 'Serious study on one passage', 4),
  ('Reading Plan', 'Bible in a Year, day by day', 5),
  ('Challenge', 'One thing to try today', 6);
