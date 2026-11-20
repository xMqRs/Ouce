create extension if not exists pgcrypto;

create table if not exists public.history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null,
  artist text,
  settings jsonb not null default '{}'::jsonb,
  storage_path text not null,
  published boolean not null default false,
  cover_path text,
  cover_thumb text,
  created_at timestamptz not null default now()
);

create index if not exists history_user_idx on public.history (user_id, created_at desc);
create index if not exists history_published_idx on public.history (created_at desc) where published;

create table if not exists public.playlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  track_ids uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.site_stats (
  key text primary key,
  value bigint not null default 0
);

insert into public.site_stats (key, value)
values ('plays', 0), ('visits', 0)
on conflict (key) do nothing;

alter table public.history enable row level security;
alter table public.playlists enable row level security;
alter table public.site_stats enable row level security;

drop policy if exists "history: dono le" on public.history;
drop policy if exists "history: publicadas sao abertas" on public.history;
drop policy if exists "history: dono insere" on public.history;
drop policy if exists "history: dono edita" on public.history;
drop policy if exists "history: dono apaga" on public.history;

create policy "history: dono le" on public.history
  for select to authenticated using (auth.uid() = user_id);
create policy "history: publicadas sao abertas" on public.history
  for select to anon, authenticated using (published);
create policy "history: dono insere" on public.history
  for insert to authenticated with check (auth.uid() = user_id);
create policy "history: dono edita" on public.history
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "history: dono apaga" on public.history
  for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "playlists: dono" on public.playlists;
create policy "playlists: dono" on public.playlists
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.bump_stat(stat text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.site_stats set value = value + 1
  where key = stat and stat in ('plays', 'visits');
$$;

create or replace function public.get_site_stats()
returns json
language sql
security definer
set search_path = public
as $$
  select json_build_object(
    'users', (select count(*) from auth.users),
    'plays', coalesce((select value from public.site_stats where key = 'plays'), 0),
    'visits', coalesce((select value from public.site_stats where key = 'visits'), 0)
  );
$$;

grant execute on function public.bump_stat(text) to anon, authenticated;
grant execute on function public.get_site_stats() to anon, authenticated;

insert into storage.buckets (id, name, public)
values ('audio', 'audio', false)
on conflict (id) do nothing;

drop policy if exists "audio: dono le" on storage.objects;
drop policy if exists "audio: dono envia" on storage.objects;
drop policy if exists "audio: dono troca" on storage.objects;
drop policy if exists "audio: dono apaga" on storage.objects;
drop policy if exists "audio: publicadas sao abertas" on storage.objects;

create policy "audio: dono le" on storage.objects
  for select to authenticated
  using (bucket_id = 'audio' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "audio: dono envia" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'audio' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "audio: dono troca" on storage.objects
  for update to authenticated
  using (bucket_id = 'audio' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "audio: dono apaga" on storage.objects
  for delete to authenticated
  using (bucket_id = 'audio' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "audio: publicadas sao abertas" on storage.objects
  for select to anon, authenticated
  using (
    bucket_id = 'audio'
    and exists (
      select 1 from public.history h
      where h.published
        and (h.storage_path = storage.objects.name or h.cover_path = storage.objects.name)
    )
  );
