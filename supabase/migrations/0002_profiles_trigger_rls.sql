-- ============================================================
-- SHEKINAH — Migration 0002 — profiles + trigger + RLS base
-- ============================================================

begin;

-- ------------------------------------------------------------
-- profiles (espelho de auth.users)
-- ------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  role public.app_role not null default 'cozinha',
  created_at timestamptz not null default now()
);

-- Trigger: ao criar usuário em auth.users, cria o perfil.
-- Papel definido pelo prefixo do e-mail: john@* => john, demais => cozinha.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, role)
  values (
    new.id,
    new.email,
    case
      when new.email like 'john@%' then 'john'::public.app_role
      else 'cozinha'::public.app_role
    end
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------------
-- Helpers de autorização (usados em políticas RLS e RPCs)
-- Definidos aqui (antes das políticas que os usam) e mantidos
-- em 0005 via create or replace (idempotente).
-- SECURITY DEFINER com search_path='' e referências qualificadas:
-- evita recursão RLS (is_john lê profiles, que aplica política que chama is_john)
-- sem escalar privilégio indevidamente (consulta apenas o próprio papel).
-- ------------------------------------------------------------
create or replace function public.is_john()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'john'
  );
$$;

create or replace function public.is_cozinha()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'cozinha'
  );
$$;

-- RLS — profiles
alter table public.profiles enable row level security;

-- SELECT: usuário vê o próprio perfil; john vê todos (para gestão de usuários).
create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = auth.uid());

create policy profiles_select_all_for_john on public.profiles
  for select to authenticated
  using (public.is_john());

-- UPDATE: john pode alterar perfil (ex.: trocar papel).
create policy profiles_update_john on public.profiles
  for update to authenticated
  using (public.is_john());

commit;
