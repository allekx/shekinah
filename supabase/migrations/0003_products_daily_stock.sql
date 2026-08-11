-- ============================================================
-- SHEKINAH — Migration 0003 — products + daily_stock
-- ============================================================

begin;

-- ------------------------------------------------------------
-- products (catálogo — soft delete preserva histórico)
-- ------------------------------------------------------------
create table public.products (
  id bigint generated always as identity primary key,
  name text not null,
  unit_price numeric(10,2) not null check (unit_price >= 0),
  category text,
  tracks_stock boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index products_active_idx on public.products (active) where active;

-- RLS — products
alter table public.products enable row level security;

-- SELECT: qualquer autenticado (john e cozinha) vê o catálogo ativo.
create policy products_select_active on public.products
  for select to authenticated
  using (active = true);

-- INSERT/UPDATE/DELETE: somente john.
create policy products_insert_john on public.products
  for insert to authenticated
  with check (public.is_john());

create policy products_update_john on public.products
  for update to authenticated
  using (public.is_john());

create policy products_delete_john on public.products
  for delete to authenticated
  using (public.is_john());

-- ------------------------------------------------------------
-- business_days (ciclo do dia de operação)
-- Criada aqui antes de daily_stock (que a referencia via FK).
-- ------------------------------------------------------------
create table public.business_days (
  id uuid primary key default gen_random_uuid(),
  day date not null unique,
  status public.business_day_status not null default 'aberto',
  opened_at timestamptz not null default now(),
  opened_by uuid not null references public.profiles(id),
  initial_cash numeric(10,2) not null default 0 check (initial_cash >= 0),
  next_order_number int not null default 1 check (next_order_number > 0),
  closed_at timestamptz,
  closed_by uuid references public.profiles(id),
  counted_cash numeric(10,2) check (counted_cash >= 0),
  cash_difference numeric(10,2),
  notes text
);

-- Garante no máximo UM dia aberto simultaneamente (rede de segurança;
-- a RPC open_business_day também trava a linha sob lock).
create unique index business_days_one_open_idx
  on public.business_days ((1))
  where status = 'aberto';

-- RLS — business_days
alter table public.business_days enable row level security;

-- SELECT: qualquer autenticado (john e cozinha precisam saber o dia atual).
create policy business_days_select_authenticated on public.business_days
  for select to authenticated
  using (true);

-- Gravações somente via RPCs security definer.

-- ------------------------------------------------------------
-- daily_stock (estoque por dia de operação)
-- ------------------------------------------------------------
create table public.daily_stock (
  id uuid primary key default gen_random_uuid(),
  business_day_id uuid not null references public.business_days(id) on delete cascade,
  product_id bigint not null references public.products(id),
  initial_qty int not null default 0 check (initial_qty >= 0),
  sold_qty int not null default 0 check (sold_qty >= 0),
  final_counted_qty int check (final_counted_qty >= 0),  -- conferido no fechamento
  unique (business_day_id, product_id)
);

create index daily_stock_day_idx on public.daily_stock (business_day_id);

-- Saldo disponível = initial_qty - sold_qty (nunca negativo: RPC valida antes de baixar).

-- RLS — daily_stock
alter table public.daily_stock enable row level security;

-- SELECT: somente john (cozinha não vê estoque).
create policy daily_stock_select_john on public.daily_stock
  for select to authenticated
  using (public.is_john());

-- Gravações em daily_stock somente via RPCs security definer.

commit;
