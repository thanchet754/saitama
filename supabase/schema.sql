-- ==============================================================
-- AI Pose Fitness - Supabase schema
-- Chạy file này trong Supabase Dashboard -> SQL Editor -> Run
-- ==============================================================

create table if not exists public.workout_sessions (
    id               uuid primary key default gen_random_uuid(),
    user_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
    client_id        bigint not null,                 -- id buổi tập sinh ở trình duyệt (để upsert, tránh trùng)
    exercise         text not null check (exercise in ('SQUAT', 'CURL')),
    reps             integer not null check (reps >= 0 and reps <= 10000),
    duration_seconds integer not null default 0 check (duration_seconds >= 0),
    form_score       smallint check (form_score between 0 and 100),
    performed_at     timestamptz not null default now(),
    created_at       timestamptz not null default now(),
    unique (user_id, client_id)
);

create index if not exists workout_sessions_user_time_idx
    on public.workout_sessions (user_id, performed_at desc);

-- Row Level Security: mỗi người chỉ đọc/ghi dữ liệu của chính mình
alter table public.workout_sessions enable row level security;

drop policy if exists "select own sessions" on public.workout_sessions;
create policy "select own sessions" on public.workout_sessions
    for select to authenticated using (user_id = auth.uid());

drop policy if exists "insert own sessions" on public.workout_sessions;
create policy "insert own sessions" on public.workout_sessions
    for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "update own sessions" on public.workout_sessions;
create policy "update own sessions" on public.workout_sessions
    for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "delete own sessions" on public.workout_sessions;
create policy "delete own sessions" on public.workout_sessions
    for delete to authenticated using (user_id = auth.uid());
