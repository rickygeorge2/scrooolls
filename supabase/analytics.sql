-- Scrooolls analytics (run after schema.sql on a fresh project; already applied on the live project)

create table if not exists public.activity (
  user_id uuid not null references public.profiles on delete cascade,
  day date not null,
  opens int not null default 0,
  seconds int not null default 0,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  primary key (user_id, day)
);
create index if not exists activity_day_idx on public.activity (day);
alter table public.activity enable row level security;
create policy "admin reads activity" on public.activity for select using (is_admin());
grant select on public.activity to authenticated, service_role;

alter table public.reads add column if not exists opened_link boolean not null default false;

create or replace function public.track_activity(p_seconds int default 0, p_open boolean default false)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_day date;
begin
  if v_uid is null then return; end if;
  select (now() at time zone coalesce(nullif(timezone, ''), 'Asia/Kolkata'))::date into v_day from profiles where id = v_uid;
  if v_day is null then return; end if;
  insert into activity (user_id, day, opens, seconds)
  values (v_uid, v_day, case when p_open then 1 else 0 end, least(greatest(coalesce(p_seconds, 0), 0), 60))
  on conflict (user_id, day) do update
    set opens = activity.opens + excluded.opens,
        seconds = activity.seconds + excluded.seconds,
        last_seen = now();
end;
$$;
revoke all on function public.track_activity(int, boolean) from public, anon;
grant execute on function public.track_activity(int, boolean) to authenticated;

create or replace function public.admin_stats(p_days int default 30, p_tz text default 'Asia/Kolkata')
returns json language plpgsql stable security definer set search_path = public as $$
declare
  v_today date := (now() at time zone p_tz)::date;
  v_from date := v_today - (greatest(p_days, 1) - 1);
  v_from_ts timestamptz := (v_from::timestamp at time zone p_tz);
  result json;
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  select json_build_object(
    'range', json_build_object('from', v_from, 'to', v_today, 'days', p_days),
    'totals', json_build_object(
      'people', (select count(*) from profiles),
      'readers', (select count(*) from profiles where role = 'reader'),
      'contributors', (select count(*) from profiles where role = 'contributor'),
      'notifications_on', (select count(distinct user_id) from push_subscriptions),
      'new_people', (select count(*) from profiles where created_at >= v_from_ts),
      'active_today', (select count(*) from activity where day = v_today),
      'active_7', (select count(distinct user_id) from activity where day > v_today - 7),
      'active_period', (select count(distinct user_id) from activity where day >= v_from),
      'opens', (select coalesce(sum(opens), 0) from activity where day >= v_from),
      'minutes', (select coalesce(sum(seconds), 0) / 60 from activity where day >= v_from),
      'reads', (select count(*) from reads where read_at >= v_from_ts),
      'link_opens', (select count(*) from reads where read_at >= v_from_ts and opened_link),
      'published', (select count(*) from stories where status = 'published' and published_at >= v_from_ts)
    ),
    'daily', (
      select coalesce(json_agg(d order by d.day), '[]'::json) from (
        select g.day::date as day,
          (select count(*) from activity a where a.day = g.day::date) as active,
          (select coalesce(sum(seconds), 0) / 60 from activity a where a.day = g.day::date) as minutes,
          (select count(*) from reads r where (r.read_at at time zone p_tz)::date = g.day::date) as reads,
          (select count(*) from profiles p where (p.created_at at time zone p_tz)::date = g.day::date) as signups
        from generate_series(v_from, v_today, interval '1 day') g(day)
      ) d
    ),
    'top_stories', (
      select coalesce(json_agg(t), '[]'::json) from (
        select s.id, s.title, s.author_name, s.published_at,
          count(r.*) as reads, count(r.*) filter (where r.opened_link) as link_opens
        from stories s left join reads r on r.story_id = s.id
        where s.status = 'published' and s.published_at >= v_from_ts
        group by s.id order by count(r.*) desc, s.published_at desc limit 10
      ) t
    ),
    'themes', (
      select coalesce(json_agg(t order by t.reads desc, t.interested desc), '[]'::json) from (
        select th.name, th.color,
          (select count(*) from user_themes ut where ut.theme_id = th.id) as interested,
          (select count(*) from reads r join stories s on s.id = r.story_id where s.theme_id = th.id and r.read_at >= v_from_ts) as reads
        from themes th
      ) t
    ),
    'people', (
      select coalesce(json_agg(p), '[]'::json) from (
        select pr.name, pr.email, pr.role, pr.created_at,
          (select max(last_seen) from activity a where a.user_id = pr.id) as last_seen,
          (select count(*) from activity a where a.user_id = pr.id and a.day >= v_from) as days_active,
          (select coalesce(sum(seconds), 0) / 60 from activity a where a.user_id = pr.id and a.day >= v_from) as minutes,
          (select count(*) from reads r where r.user_id = pr.id and r.read_at >= v_from_ts) as reads,
          exists (select 1 from push_subscriptions ps where ps.user_id = pr.id) as notifications
        from profiles pr
        order by (select max(last_seen) from activity a where a.user_id = pr.id) desc nulls last, pr.created_at desc
        limit 300
      ) p
    )
  ) into result;
  return result;
end;
$$;
revoke all on function public.admin_stats(int, text) from public, anon;
grant execute on function public.admin_stats(int, text) to authenticated;

-- Bible verse attached to a story (added 26 Nov 2026)
alter table public.stories
  add column if not exists verse_ref text,
  add column if not exists verse_text text,
  add column if not exists verse_translation text;
