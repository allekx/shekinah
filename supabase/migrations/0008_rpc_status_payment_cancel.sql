-- ============================================================
-- SHEKINAH — Migration 0008 — RPCs de status, pagamento e cancelamento
-- ============================================================

begin;

-- ------------------------------------------------------------
-- RPC update_order_status — transições controladas
--   novo → em_preparo   (cozinha | john)
--   em_preparo → pronto (cozinha | john)
--   pronto → entregue   (john)
--   novo / em_preparo → cancelado  (via cancel_order, restaura estoque)
-- ------------------------------------------------------------
create or replace function public.update_order_status(
  p_order_id uuid,
  p_to_status public.order_status
)
returns public.orders
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders;
  v_profile public.profiles;
  v_role public.app_role;
  v_from public.order_status;
begin
  select * into v_profile from public.profiles where id = auth.uid();
  if not found then
    raise exception 'PERMISSAO_NEGADA';
  end if;
  v_role := v_profile.role;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'PEDIDO_NAO_ENCONTRADO';
  end if;

  v_from := v_order.status;

  -- regras de transição
  if p_to_status = 'cancelado' then
    raise exception 'USE_CANCEL_ORDER'; -- cancelamento tem RPC própria (restaura estoque)
  end if;

  if p_to_status = 'em_preparo' then
    if v_from <> 'novo' then
      raise exception 'TRANSICAO_INVALIDA';
    end if;
    if v_role not in ('cozinha', 'john') then
      raise exception 'PERMISSAO_NEGADA';
    end if;
  elsif p_to_status = 'pronto' then
    if v_from <> 'em_preparo' then
      raise exception 'TRANSICAO_INVALIDA';
    end if;
    if v_role not in ('cozinha', 'john') then
      raise exception 'PERMISSAO_NEGADA';
    end if;
  elsif p_to_status = 'entregue' then
    if v_from <> 'pronto' then
      raise exception 'TRANSICAO_INVALIDA';
    end if;
    if v_role <> 'john' then
      raise exception 'PERMISSAO_NEGADA';
    end if;
  else
    raise exception 'STATUS_INVALIDO';
  end if;

  update public.orders
  set status = p_to_status
  where id = p_order_id
  returning * into v_order;

  insert into public.order_status_history (order_id, from_status, to_status, changed_by)
  values (p_order_id, v_from, p_to_status, auth.uid());

  return v_order;
end;
$$;

-- ------------------------------------------------------------
-- RPC add_payment — pagamento adicional (dividido) em pedido já criado
-- ------------------------------------------------------------
create or replace function public.add_payment(
  p_order_id uuid,
  p_method public.payment_method,
  p_amount numeric,
  p_change_given numeric default 0
)
returns public.orders
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders;
begin
  perform public.apply_payment_internal(p_order_id, p_method, p_amount, p_change_given);

  select * into v_order from public.orders where id = p_order_id;
  return v_order;
end;
$$;

-- ------------------------------------------------------------
-- RPC cancel_order — cancela pedido NÃO PAGO e restaura estoque
-- ------------------------------------------------------------
create or replace function public.cancel_order(p_order_id uuid)
returns public.orders
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile public.profiles;
  v_order public.orders;
  v_item record;
  v_from public.order_status;
begin
  select * into v_profile from public.profiles where id = auth.uid();
  if not found or v_profile.role <> 'john' then
    raise exception 'PERMISSAO_NEGADA';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'PEDIDO_NAO_ENCONTRADO';
  end if;

  if v_order.paid then
    raise exception 'PEDIDO_JA_PAGO'; -- estorno/reembolso fora do escopo atual
  end if;

  if v_order.status = 'cancelado' then
    raise exception 'PEDIDO_JA_CANCELADO';
  end if;

  v_from := v_order.status;

  -- restaura estoque dos itens (se o produto controla estoque)
  for v_item in
    select oi.product_id, oi.quantity
    from public.order_items oi
    where oi.order_id = p_order_id
  loop
    update public.daily_stock
    set sold_qty = greatest(sold_qty - v_item.quantity, 0)
    where business_day_id = v_order.business_day_id
      and product_id = v_item.product_id;
  end loop;

  update public.orders
  set status = 'cancelado'
  where id = p_order_id
  returning * into v_order;

  insert into public.order_status_history (order_id, from_status, to_status, changed_by)
  values (p_order_id, v_from, 'cancelado', auth.uid());

  return v_order;
end;
$$;

-- Revoga público e libera para autenticados
revoke execute on function public.update_order_status(uuid, public.order_status) from public;
grant execute on function public.update_order_status(uuid, public.order_status) to authenticated;

revoke execute on function public.add_payment(uuid, public.payment_method, numeric, numeric) from public;
grant execute on function public.add_payment(uuid, public.payment_method, numeric, numeric) to authenticated;

revoke execute on function public.cancel_order(uuid) from public;
grant execute on function public.cancel_order(uuid) to authenticated;

commit;
