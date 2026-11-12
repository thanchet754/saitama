-- Saitama: forward workout videos to the user's Telegram (bot @saitama_ngoc_workout_bot)
-- Edge functions: saitama-telegram-send (app -> Telegram), saitama-telegram-hook (bot webhook, links a chat to a user)

-- one row per uploaded video segment (a session is split into ~2.5 min playable parts, Telegram bots accept <= 50 MB)
alter table public.saitama_videos
    add column if not exists session_id bigint,
    add column if not exists segment int not null default 1,
    add column if not exists is_last boolean not null default true,
    add column if not exists caption text,
    add column if not exists telegram_status text not null default 'pending',  -- pending | sent | no_link | too_large | error
    add column if not exists telegram_message_id bigint,
    add column if not exists telegram_error text,
    add column if not exists storage_deleted boolean not null default false;

-- which Telegram chat receives a user's videos
create table if not exists public.saitama_telegram_links (
    user_id   uuid primary key references auth.users (id) on delete cascade,
    chat_id   bigint not null,
    tg_name   text,
    linked_at timestamptz not null default now()
);
alter table public.saitama_telegram_links enable row level security;
drop policy if exists "saitama_tg_links_read_own" on public.saitama_telegram_links;
create policy "saitama_tg_links_read_own" on public.saitama_telegram_links for select to authenticated using (user_id = auth.uid());
drop policy if exists "saitama_tg_links_delete_own" on public.saitama_telegram_links;
create policy "saitama_tg_links_delete_own" on public.saitama_telegram_links for delete to authenticated using (user_id = auth.uid());

-- one-time codes: the app creates one, the user opens t.me/<bot>?start=<code>, the webhook links the chat
create table if not exists public.saitama_telegram_codes (
    code       text primary key,
    user_id    uuid not null references auth.users (id) on delete cascade default auth.uid(),
    created_at timestamptz not null default now()
);
alter table public.saitama_telegram_codes enable row level security;
drop policy if exists "saitama_tg_codes_insert_own" on public.saitama_telegram_codes;
create policy "saitama_tg_codes_insert_own" on public.saitama_telegram_codes for insert to authenticated with check (user_id = auth.uid());
