-- ============================================================
-- SHEKINAH — Migration 0025 — Fix: ajuste de estoque (+/-)
--
-- p_delta deve alterar o SALDO (initial - sold), não incrementar vendido.
-- Antes: sold_qty += p_delta (somar +5 virava "vendido 5" e saldo -5).
-- Agora: initial_qty += p_delta e registra movimentação 'ajuste'.
-- ============================================================

begin;

-- Repara linhas corrompidas pelo bug (vendido > inicial com inicial 0).
update public.daily_stock
set sold_qty = 0
where initial_qty = 0 and sold_qty > 0;

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
  v_new_initial int;
begin
  select * into v_profile from public.profiles where id = auth.uid();
  if not found or v_profile.role <> 'john' then
    raise exception 'PERMISSAO_NEGADA';
  end if;

  if p_delta = 0 then
    raise exception 'AJUSTE_ZERO';
  end if;

  select * into v_day from public.business_days
  where id = p_business_day_id and status = 'aberto'
  for update;
  if not found then
    raise exception 'DIA_NAO_ABERTO';
  end if;

  select * into v_stock from public.daily_stock
  where business_day_id = p_business_day_id and product_id = p_product_id
  for update;
  if not found then
    raise exception 'PRODUTO_SEM_ESTOQUE_INICIAL';
  end if;

  v_available := v_stock.initial_qty - v_stock.sold_qty;
  v_new_initial := v_stock.initial_qty + p_delta;

  if v_available + p_delta < 0 then
    raise exception 'ESTOQUE_INSUFICIENTE';
  end if;

  if v_new_initial < v_stock.sold_qty then
    raise exception 'ESTOQUE_INSUFICIENTE';
  end if;

  if v_new_initial < 0 then
    raise exception 'ESTOQUE_INSUFICIENTE';
  end if;

  update public.daily_stock
  set initial_qty = v_new_initial
  where id = v_stock.id
  returning * into v_stock;

  insert into public.stock_movements
    (business_day_id, product_id, type, quantity, created_by)
  values
    (p_business_day_id, p_product_id, 'ajuste'::public.stock_movement_type, p_delta, auth.uid());

  return v_stock;
end;
$$;

commit;
