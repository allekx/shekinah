-- ============================================================
-- SHEKINAH — Migration 0012 — Movimentações de estoque + ajuste
--
-- Registra o histórico de movimentações de estoque (não apaga nada):
--   * inicial      -> estoque da abertura do dia
--   * venda        -> baixa ao criar pedido (create_order / add_items_to_order)
--   * cancelamento -> devolução ao cancelar pedido (cancel_order)
--   * ajuste       -> correção manual (+/-) via adjust_stock
--
-- Mecânica: trigger em daily_stock detecta variação de sold_qty e grava o delta.
--  * delta > 0 -> 'venda'
--  * delta < 0 -> 'cancelamento'
--  * se a transação marcou ajust_stock via set_config -> 'ajuste'
-- A abertura registra 'inicial'.
--
-- Migração ADITIVA: não altera tabelas/colunas existentes.
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1. Enum de tipo de movimentação
-- ------------------------------------------------------------
create type public.stock_movement_type as enum ('inicial', 'venda', 'cancelamento', 'ajuste');
comment on type public.stock_movement_type is
  'Tipo de movimentação de estoque: inicio do dia, venda, cancelamento ou ajuste manual.';

-- ------------------------------------------------------------
-- 2. Tabela stock_movements (histórico imutável)
-- ------------------------------------------------------------
create table public.stock_movements (
  id bigint generated always as identity primary key,
  business_day_id uuid not null references public.business_days(id),
  product_id bigint not null references public.products(id),
  type public.stock_movement_type not null,
  quantity int not null check (quantity <> 0),  -- delta (+ vende, - devolve)
  order_id uuid references public.orders(id) on delete set null, -- ref venda/cancelamento
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create index stock_movements_day_idx on public.stock_movements (business_day_id, product_id, created_at);
create index stock_movements_product_idx on public.stock_movements (product_id);

comment on table public.stock_movements is
  'Histórico de movimentações de estoque por dia. Nunca é apagado.';

-- RLS — stock_movements
alter table public.stock_movements enable row level security;

-- SELECT: somente john (cozinha não vê/alterar estoque administrativo).
create policy stock_movements_select_john on public.stock_movements
  for select to authenticated
  using (public.is_john());

-- Gravações somente via trigger/RPC security definer (sem policies de escrita).

-- ------------------------------------------------------------
-- 3. Trigger em daily_stock: registra variação de sold_qty
-- ------------------------------------------------------------
create or replace function public.log_stock_movement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_delta int;
  v_type public.stock_movement_type;
  v_order_id uuid;
  v_is_adjust text;
begin
  v_delta := new.sold_qty - old.sold_qty;
  if v_delta = 0 then
    return new;
  end if;

  -- Se adjust_stock marcou contexto, registra como 'ajuste'
  v_is_adjust := current_setting('shekinah.adjust_stock', true);
  if v_is_adjust = 'on' then
    v_type := 'ajuste'::public.stock_movement_type;
  elsif v_delta > 0 then
    v_type := 'venda'::public.stock_movement_type;
    -- associa ao pedido criado mais recente do dia
    select o.id into v_order_id
    from public.orders o
    where o.business_day_id = new.business_day_id
    order by o.created_at desc
    limit 1;
  else
    v_type := 'cancelamento'::public.stock_movement_type;
    -- associa ao pedido mais recente atualizado
    select o.id into v_order_id
    from public.orders o
    order by o.updated_at desc
    limit 1;
  end if;

  insert into public.stock_movements
    (business_day_id, product_id, type, quantity, order_id, created_by)
  values
    (new.business_day_id, new.product_id, v_type, v_delta, v_order_id, auth.uid());

  return new;
end;
$$;

create trigger daily_stock_log_movement
  after update of sold_qty on public.daily_stock
  for each row execute function public.log_stock_movement();

-- ------------------------------------------------------------
-- 4. RPC adjust_stock — ajuste manual de estoque (+/-)
-- ------------------------------------------------------------
create or replace function public.adjust_stock(
  p_business_day_id uuid,
  p_product_id bigint,
  p_delta int
)
returns public.daily_stock
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile public.profiles;
  v_day public.business_days;
  v_stock public.daily_stock;
  v_available int;
begin
  -- 1) autorização: somente john
  select * into v_profile from public.profiles where id = auth.uid();
  if not found or v_profile.role <> 'john' then
    raise exception 'PERMISSAO_NEGADA';
  end if;

  if p_delta = 0 then
    raise exception 'AJUSTE_ZERO';
  end if;

  -- 2) dia aberto (trava)
  select * into v_day from public.business_days
  where id = p_business_day_id and status = 'aberto'
  for update;
  if not found then
    raise exception 'DIA_NAO_ABERTO';
  end if;

  -- 3) estoque (trava)
  select * into v_stock from public.daily_stock
  where business_day_id = p_business_day_id and product_id = p_product_id
  for update;
  if not found then
    raise exception 'PRODUTO_SEM_ESTOQUE_INICIAL';
  end if;

  -- 4) nunca negativo
  v_available := v_stock.initial_qty - v_stock.sold_qty;
  if v_available + p_delta < 0 then
    raise exception 'ESTOQUE_INSUFICIENTE';
  end if;

  -- 5) marca o contexto para o trigger registrar como 'ajuste'
  perform set_config('shekinah.adjust_stock', 'on', true);

  update public.daily_stock
  set sold_qty = sold_qty + p_delta
  where id = v_stock.id
  returning * into v_stock;

  -- desmarca (por segurança)
  perform set_config('shekinah.adjust_stock', 'off', true);

  return v_stock;
end;
$$;

revoke execute on function public.adjust_stock(uuid, bigint, int) from public;
grant execute on function public.adjust_stock(uuid, bigint, int) to authenticated;

-- ------------------------------------------------------------
-- 5. open_business_day: registra movimentação 'inicial' por produto
--    (create or replace para incluir o histórico sem quebrar a já aplicada)
-- ------------------------------------------------------------
create or replace function public.open_business_day(
  p_initial_cash numeric,
  p_stock jsonb
)
returns public.business_days
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile public.profiles;
  v_day public.business_days;
  v_tz text;
  v_stock_item jsonb;
  v_product public.products;
  v_product_id bigint;
  v_qty int;
begin
  -- 1) autorização: somente john
  select * into v_profile from public.profiles where id = auth.uid();
  if not found or v_profile.role <> 'john' then
    raise exception 'PERMISSAO_NEGADA';
  end if;

  if p_initial_cash < 0 then
    raise exception 'CAIXA_INICIAL_INVALIDA';
  end if;

  -- 2) garante que não há dia aberto (a unique index é a rede de segurança final)
  if exists (select 1 from public.business_days where status = 'aberto') then
    raise exception 'DIA_JA_ABERTO';
  end if;

  -- 3) fuso horário do estabelecimento (default America/Manaus)
  select coalesce(value->>'tz', 'America/Manaus') into v_tz
  from public.settings where key = 'tz';

  -- 4) cria o dia
  insert into public.business_days (day, opened_by, initial_cash, status)
  values ((now() at time zone v_tz)::date, auth.uid(), p_initial_cash, 'aberto')
  returning * into v_day;

  -- 5) estoque inicial + movimentação 'inicial'
  if p_stock is not null and jsonb_typeof(p_stock) = 'array' then
    for v_stock_item in select * from jsonb_array_elements(p_stock)
    loop
      v_product_id := (v_stock_item->>'product_id')::bigint;
      v_qty := (v_stock_item->>'quantity')::int;

      if v_qty is null or v_qty < 0 then
        raise exception 'ESTOQUE_INICIAL_INVALIDO';
      end if;

      select * into v_product from public.products where id = v_product_id;
      if not found then
        raise exception 'PRODUTO_NAO_ENCONTRADO';
      end if;

      -- só cria linha de estoque para produtos que controlam estoque
      if v_product.tracks_stock then
        insert into public.daily_stock (business_day_id, product_id, initial_qty)
        values (v_day.id, v_product_id, v_qty)
        on conflict (business_day_id, product_id)
        do update set initial_qty = excluded.initial_qty;

        -- movimentação 'inicial'
        if v_qty > 0 then
          insert into public.stock_movements (business_day_id, product_id, type, quantity, created_by)
          values (v_day.id, v_product_id, 'inicial'::public.stock_movement_type, v_qty, auth.uid());
        end if;
      end if;
    end loop;
  end if;

  return v_day;
end;
$$;

revoke execute on function public.open_business_day(numeric, jsonb) from public;
grant execute on function public.open_business_day(numeric, jsonb) to authenticated;

commit;