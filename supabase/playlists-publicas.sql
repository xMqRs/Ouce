-- Playlists públicas e username.
-- Rode este arquivo uma vez no SQL Editor do Supabase. Ele pode ser repetido sem problema.

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
