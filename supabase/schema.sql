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

-- Playlists públicas e username (também em playlists-publicas.sql, para bancos que já existem)
-- 1) Perfis: o @username de cada conta (visível para todos; não guarda e-mail)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text,
  created_at timestamptz not null default now(),
  constraint profiles_username_fmt check (username is null or username ~ '^[a-z0-9_.]{3,20}$')
);

create unique index if not exists profiles_username_key
  on public.profiles (lower(username)) where username is not null;

alter table public.profiles enable row level security;

drop policy if exists "profiles: todos leem" on public.profiles;
drop policy if exists "profiles: dono insere" on public.profiles;
drop policy if exists "profiles: dono edita" on public.profiles;

create policy "profiles: todos leem" on public.profiles
  for select to anon, authenticated using (true);
create policy "profiles: dono insere" on public.profiles
  for insert to authenticated with check (auth.uid() = id);
create policy "profiles: dono edita" on public.profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- 1b) Limite de troca: 2 trocas de username a cada 30 dias (a primeira escolha não conta)
alter table public.profiles add column if not exists username_changes timestamptz[] not null default '{}';

create or replace function public.profiles_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recent timestamptz[];
begin
  if new.username is not null then
    new.username := lower(new.username);
  end if;

  if new.username is distinct from old.username then
    if old.username is not null then
      select coalesce(array_agg(t), '{}') into recent
      from unnest(old.username_changes) as t
      where t > now() - interval '30 days';

      if coalesce(array_length(recent, 1), 0) >= 2 then
        raise exception 'username_limit';
      end if;
      new.username_changes := recent || now();
    else
      new.username_changes := old.username_changes;
    end if;
  else
    new.username_changes := old.username_changes;
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_guard_trg on public.profiles;
create trigger profiles_guard_trg
  before update on public.profiles
  for each row execute function public.profiles_guard();

-- cria o perfil quando a conta nasce (usa o username enviado no cadastro, se for válido e livre)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  wanted text := lower(coalesce(new.raw_user_meta_data ->> 'username', ''));
begin
  begin
    insert into public.profiles (id, username) values (new.id, nullif(wanted, ''));
  exception when others then
    insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  end;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- contas que já existiam ganham um perfil vazio (escolhem o username no próximo login)
insert into public.profiles (id)
select id from auth.users
on conflict (id) do nothing;

-- 2) Playlists: capa e publicação
alter table public.playlists add column if not exists published boolean not null default false;
alter table public.playlists add column if not exists cover_path text;
alter table public.playlists add column if not exists cover_thumb text;

create index if not exists playlists_published_idx on public.playlists (created_at desc) where published;

drop policy if exists "playlists: publicas sao abertas" on public.playlists;
create policy "playlists: publicas sao abertas" on public.playlists
  for select to anon, authenticated using (published);

-- 3) Capas de playlists públicas ficam legíveis para todos (junto com as faixas públicas)
drop policy if exists "audio: publicadas sao abertas" on storage.objects;
create policy "audio: publicadas sao abertas" on storage.objects
  for select to anon, authenticated
  using (
    bucket_id = 'audio'
    and (
      exists (
        select 1 from public.history h
        where h.published
          and (h.storage_path = storage.objects.name or h.cover_path = storage.objects.name)
      )
      or exists (
        select 1 from public.playlists p
        where p.published and p.cover_path = storage.objects.name
      )
    )
  );
