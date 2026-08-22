-- ============================================================
-- SHEKINAH — Migration 0026 — Complemento reabre cozinha (só itens novos)
--
-- Pedido PRONTO + complemento → status volta a NOVO (cozinha prepara de novo).
-- Itens originais (complement_id NULL) não reentram na fila; só itens do
-- complemento com kitchen_status pendente/em_preparo.
-- ============================================================

begin;

-- Status de preparo por complemento (independente do status global do pedido)
alter table public.order_complements
  add column if not exists kitchen_status text not null default 'pendente'
  check (kitchen_status in ('pendente', 'em_preparo', 'pronto'));

-- Complementos já existentes foram preparados no fluxo antigo
update public.order_complements
set kitchen_status = 'pronto'
where kitchen_status = 'pendente';

comment on column public.order_complements.kitchen_status is
  'Preparo na cozinha só dos itens deste complemento. Original do pedido = NULL em order_items.';

-- ------------------------------------------------------------
-- add_items_to_order — reabre cozinha se pedido estava pronto
-- ------------------------------------------------------------
create or replace function public.add_items_to_order(
  p_order_id uuid,
  p_items jsonb
)
returns public.orders
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile    public.profiles;
  v_order      public.orders;
  v_day        public.business_days;
  v_complement public.order_complements;
  v_item       jsonb;
  v_product_id bigint;
  v_qty        int;
  v_product    public.products;
  v_stock      public.daily_stock;
  v_available  int;
  v_subtotal   numeric;
  v_new_total  numeric;
  v_from_status public.order_status;
begin
  select * into v_profile from public.profiles where id = auth.uid();
  if not found or v_profile.role <> 'john' then
    raise exception 'PERMISSAO_NEGADA';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0 then
    raise exception 'COMPLEMENTO_SEM_ITENS';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'PEDIDO_NAO_ENCONTRADO';
  end if;

  if v_order.paid then
    raise exception 'PEDIDO_JA_PAGO';
  end if;
  if v_order.status = 'cancelado' then
    raise exception 'PEDIDO_CANCELADO';
  end if;
  if v_order.status = 'entregue' then
    raise exception 'PEDIDO_ENTREGUE';
  end if;

  select * into v_day
  from public.business_days
  where id = v_order.business_day_id and status = 'aberto'
  for update;
  if not found then
    raise exception 'DIA_NAO_ABERTO';
  end if;

  v_from_status := v_order.status;

  insert into public.order_complements (order_id, created_by, kitchen_status)
  values (p_order_id, auth.uid(), 'pendente')
  returning * into v_complement;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_product_id := (v_item->>'product_id')::bigint;
    v_qty        := (v_item->>'quantity')::int;

    if v_qty is null or v_qty <= 0 then
      raise exception 'QUANTIDADE_INVALIDA';
    end if;

    select * into v_product from public.products where id = v_product_id;
    if not found or not v_product.active then
      raise exception 'PRODUTO_INATIVO';
    end if;

    if v_product.tracks_stock then
      select * into v_stock
      from public.daily_stock
      where business_day_id = v_day.id and product_id = v_product_id
      for update;

      if not found then
        raise exception 'PRODUTO_SEM_ESTOQUE_INICIAL';
      end if;

      v_available := v_stock.initial_qty - v_stock.sold_qty;
      if v_available < v_qty then
        raise exception 'ESTOQUE_INSUFICIENTE';
      end if;

      update public.daily_stock
      set sold_qty = sold_qty + v_qty
      where id = v_stock.id;
    end if;

    if v_item->>'unit_price' is not null then
      if abs((v_item->>'unit_price')::numeric - v_product.unit_price) > 0.001 then
        raise exception 'PRECO_INVALIDO';
      end if;
    end if;
  end loop;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    select * into v_product from public.products where id = (v_item->>'product_id')::bigint;
    v_qty := (v_item->>'quantity')::int;
    v_subtotal := round((v_qty * v_product.unit_price)::numeric, 2);

    insert into public.order_items
      (order_id, product_id, product_name, quantity, unit_price, subtotal, complement_id)
    values
      (p_order_id, v_product.id, v_product.name, v_qty, v_product.unit_price, v_subtotal, v_complement.id);
  end loop;

  select coalesce(sum(subtotal), 0) into v_new_total
  from public.order_items
  where order_id = p_order_id;

  update public.orders
  set total = round(v_new_total, 2),
      status = case when v_from_status = 'pronto' then 'novo'::public.order_status else status end
  where id = p_order_id
  returning * into v_order;

  if v_from_status = 'pronto' then
    insert into public.order_status_history (order_id, from_status, to_status, changed_by)
    values (p_order_id, 'pronto', 'novo', auth.uid());
  end if;

  return v_order;
end;
$$;

-- ------------------------------------------------------------
-- update_order_status — sincroniza kitchen_status dos complementos
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

  if p_to_status = 'cancelado' then
    raise exception 'USE_CANCEL_ORDER';
  end if;

  if p_to_status = 'em_preparo' then
    if v_from <> 'novo' then
      raise exception 'TRANSICAO_INVALIDA';
    end if;
    if v_role not in ('cozinha', 'john') then
      raise exception 'PERMISSAO_NEGADA';
    end if;

    update public.order_complements
    set kitchen_status = 'em_preparo'
    where order_id = p_order_id and kitchen_status = 'pendente';

  elsif p_to_status = 'pronto' then
    if v_from <> 'em_preparo' then
      raise exception 'TRANSICAO_INVALIDA';
    end if;
    if v_role not in ('cozinha', 'john') then
      raise exception 'PERMISSAO_NEGADA';
    end if;

    update public.order_complements
    set kitchen_status = 'pronto'
    where order_id = p_order_id and kitchen_status = 'em_preparo';

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

revoke execute on function public.add_items_to_order(uuid, jsonb) from public;
grant execute on function public.add_items_to_order(uuid, jsonb) to authenticated;

revoke execute on function public.update_order_status(uuid, public.order_status) from public;
grant execute on function public.update_order_status(uuid, public.order_status) to authenticated;

commit;
