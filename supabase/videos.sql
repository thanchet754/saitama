-- Saitama: workout videos (private Storage bucket + metadata table)
-- Videos are stored as byte-range parts (<= 8 MB each, the project caps files at 50 MB):
--   saitama-videos/<user id>/<client id>/part-000, part-001, ...
-- Concatenating the parts in order gives back the original .mp4/.webm file.

insert into storage.buckets (id, name, public, file_size_limit)
values ('saitama-videos', 'saitama-videos', false, 10485760)
on conflict (id) do nothing;

drop policy if exists "saitama_videos_select_own" on storage.objects;
drop policy if exists "saitama_videos_insert_own" on storage.objects;
drop policy if exists "saitama_videos_update_own" on storage.objects;
drop policy if exists "saitama_videos_delete_own" on storage.objects;

create policy "saitama_videos_select_own" on storage.objects for select to authenticated
    using (bucket_id = 'saitama-videos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "saitama_videos_insert_own" on storage.objects for insert to authenticated
    with check (bucket_id = 'saitama-videos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "saitama_videos_update_own" on storage.objects for update to authenticated
    using (bucket_id = 'saitama-videos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "saitama_videos_delete_own" on storage.objects for delete to authenticated
    using (bucket_id = 'saitama-videos' and (storage.foldername(name))[1] = auth.uid()::text);

create table if not exists public.saitama_videos (
    id          uuid primary key default gen_random_uuid(),
    user_id     uuid not null references auth.users (id) on delete cascade default auth.uid(),
    client_id   bigint not null,
    file_name   text not null,
    exercise    text,
    mime        text not null,
    size_bytes  bigint not null,
    parts       int not null,
    duration_s  int,
    recorded_at timestamptz not null,
    created_at  timestamptz not null default now(),
    unique (user_id, client_id)
);

alter table public.saitama_videos enable row level security;

drop policy if exists "saitama_videos_rw_own" on public.saitama_videos;
create policy "saitama_videos_rw_own" on public.saitama_videos for all to authenticated
    using (user_id = auth.uid()) with check (user_id = auth.uid());

create index if not exists saitama_videos_user_time on public.saitama_videos (user_id, recorded_at desc);
