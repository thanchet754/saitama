-- ==============================================================
-- AI Pose Fitness - user fitness profile (height, weight, goal...)
-- Named saitama_profiles to avoid clashing with other apps in this project
-- ==============================================================

create table if not exists public.saitama_profiles (
    user_id     uuid primary key default auth.uid() references auth.users (id) on delete cascade,
    profile     jsonb not null default '{}'::jsonb,  -- sex, age, height_cm, weight_kg, goal, level, minutes, equipment, completed[]
    updated_at  timestamptz not null default now()
);

alter table public.saitama_profiles enable row level security;

drop policy if exists "select own profile" on public.saitama_profiles;
create policy "select own profile" on public.saitama_profiles
    for select to authenticated using (user_id = auth.uid());

drop policy if exists "insert own profile" on public.saitama_profiles;
create policy "insert own profile" on public.saitama_profiles
    for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "update own profile" on public.saitama_profiles;
create policy "update own profile" on public.saitama_profiles
    for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "delete own profile" on public.saitama_profiles;
create policy "delete own profile" on public.saitama_profiles
    for delete to authenticated using (user_id = auth.uid());
