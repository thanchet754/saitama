-- ==============================================================
-- AI Pose Fitness - GPS activities (run / walk / ride / drive)
-- Chạy trong Supabase SQL Editor (hoặc qua Management API)
-- ==============================================================

create table if not exists public.activities (
    id                uuid primary key default gen_random_uuid(),
    user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
    client_id         bigint not null,                    -- id sinh ở trình duyệt (upsert, tránh trùng)
    activity_type     text not null check (activity_type ~ '^[A-Z_]{2,20}$'),
    started_at        timestamptz not null,
    moving_seconds    integer not null default 0 check (moving_seconds >= 0),
    elapsed_seconds   integer not null default 0 check (elapsed_seconds >= 0),
    distance_m        real not null default 0 check (distance_m >= 0),
    elevation_gain_m  real not null default 0,
    max_speed_mps     real,
    calories          integer,
    splits            jsonb not null default '[]'::jsonb, -- [{km, seconds}]
    route             jsonb not null default '[]'::jsonb, -- [[lat, lon, t_seconds, alt_m], ...]
    created_at        timestamptz not null default now(),
    unique (user_id, client_id)
);

create index if not exists activities_user_time_idx
    on public.activities (user_id, started_at desc);

alter table public.activities enable row level security;

drop policy if exists "select own activities" on public.activities;
create policy "select own activities" on public.activities
    for select to authenticated using (user_id = auth.uid());

drop policy if exists "insert own activities" on public.activities;
create policy "insert own activities" on public.activities
    for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "update own activities" on public.activities;
create policy "update own activities" on public.activities
    for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "delete own activities" on public.activities;
create policy "delete own activities" on public.activities
    for delete to authenticated using (user_id = auth.uid());
