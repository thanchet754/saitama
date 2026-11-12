-- Saitama: send every workout video to one shared Telegram group.
-- Set from inside the group with /setgroup (only by a Telegram account already linked to the app);
-- the first person to set it becomes the owner who can change or remove it (/unsetgroup).
create table if not exists public.saitama_telegram_config (
    id            int primary key default 1 check (id = 1),
    group_chat_id bigint,
    group_title   text,
    owner_tg_id   bigint,
    set_at        timestamptz not null default now()
);
alter table public.saitama_telegram_config enable row level security;
drop policy if exists "saitama_tg_config_read" on public.saitama_telegram_config;
create policy "saitama_tg_config_read" on public.saitama_telegram_config for select to authenticated using (true);
