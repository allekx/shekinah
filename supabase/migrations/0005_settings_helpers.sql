-- ============================================================
-- SHEKINAH — Migration 0005 — settings + helpers de autorização
-- ============================================================

begin;

-- ------------------------------------------------------------
-- settings (configuração chave/valor JSON)
-- ------------------------------------------------------------
create table public.settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);

-- RLS — settings
alter table public.settings enable row level security;

-- SELECT: qualquer autenticado precisa ler configurações de exibição/impressão.
create policy settings_select_authenticated on public.settings
  for select to authenticated
  using (true);

-- INSERT/UPDATE/DELETE: somente john.
create policy settings_insert_john on public.settings
  for insert to authenticated
  with check (public.is_john());

create policy settings_update_john on public.settings
  for update to authenticated
  using (public.is_john());

create policy settings_delete_john on public.settings
  for delete to authenticated
  using (public.is_john());

-- ------------------------------------------------------------
-- Helpers de autorização (usados em políticas RLS e RPCs)
-- Redefinidos (create or replace) de forma idempotente; já criados
-- na migration 0002 com SECURITY DEFINER + search_path='' para evitar
-- recursão RLS (is_john lê profiles, que aplica política que chama is_john).
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

commit;
