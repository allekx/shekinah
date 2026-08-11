-- ============================================================
-- SHEKINAH — Migration 0004 — orders + order_items
--                      + payments + order_status_history
-- (business_days foi criada na migration 0003)
-- ============================================================

begin;

-- ------------------------------------------------------------
-- orders
-- ------------------------------------------------------------
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  business_day_id uuid not null references public.business_days(id),
  number int not null,
  customer_name text,
  status public.order_status not null default 'novo',
  total numeric(10,2) not null default 0 check (total >= 0),
  paid boolean not null default false,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_day_id, number)
);

create index orders_day_status_idx on public.orders (business_day_id, status);
create index orders_day_created_idx on public.orders (business_day_id, created_at);

-- Trigger de updated_at
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger orders_set_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

-- RLS — orders
alter table public.orders enable row level security;

-- SELECT: qualquer autenticado (john e cozinha). Cozinha enxerga pedidos do dia.
create policy orders_select_authenticated on public.orders
  for select to authenticated
  using (true);

-- Gravações somente via RPCs security definer.

-- ------------------------------------------------------------
-- order_items (snapshot de produto/quantidade/preço)
-- ------------------------------------------------------------
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id bigint references public.products(id),
  product_name text not null,
  quantity int not null check (quantity > 0),
  unit_price numeric(10,2) not null check (unit_price >= 0),
  subtotal numeric(10,2) not null check (subtotal >= 0)
);

create index order_items_order_idx on public.order_items (order_id);

-- RLS — order_items
alter table public.order_items enable row level security;

create policy order_items_select_authenticated on public.order_items
  for select to authenticated
  using (true);

-- Gravações somente via RPCs security definer.

-- ------------------------------------------------------------
-- payments (pagamento dividido + troco)
-- ------------------------------------------------------------
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  method public.payment_method not null,
  amount numeric(10,2) not null check (amount > 0),
  change_given numeric(10,2) not null default 0 check (change_given >= 0), -- somente dinheiro
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(id)
);

create index payments_order_idx on public.payments (order_id);

-- RLS — payments
alter table public.payments enable row level security;

-- SELECT: somente john (cozinha não vê valores/caixa).
create policy payments_select_john on public.payments
  for select to authenticated
  using (public.is_john());

-- Gravações somente via RPCs security definer.

-- ------------------------------------------------------------
-- order_status_history (auditoria do fluxo do pedido)
-- ------------------------------------------------------------
create table public.order_status_history (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders(id) on delete cascade,
  from_status public.order_status,
  to_status public.order_status not null,
  changed_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create index order_status_history_order_idx on public.order_status_history (order_id, created_at);

-- RLS — order_status_history
alter table public.order_status_history enable row level security;

-- SELECT: somente john.
create policy order_status_history_select_john on public.order_status_history
  for select to authenticated
  using (public.is_john());

-- Gravações somente via RPCs security definer.

commit;
