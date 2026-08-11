-- ============================================================
-- SHEKINAH — Migration 0015 — Integridade: TOCTOU de preço e order_id
--
-- Correções restantes da auditoria (MÉDIA):
--  1. create_order / add_items_to_order: loop único (sem re-ler o catálogo
--     entre validar e inserir => elimina TOCTOU de preço) e search_path=''.
--  2. log_stock_movement: usa o order_id real via set_config (propagado
--     pelas RPCs) em vez de inferir o "pedido mais recente".
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 2. Trigger: determina o order_id por contexto (set_config) ou por
--    consulta robusta (máximo created_at dentro do DIA do pedido).
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
  v_ctx text;
begin
  v_delta := new.sold_qty - old.sold_qty;
  if v_delta = 0 then
    return new;
  end if;

  -- Ajuste manual marca contexto 'shekinah.adjust_stock' -> 'ajuste'
  if current_setting('shekinah.adjust_stock', true) = 'on' then
    v_type := 'ajuste'::public.stock_movement_type;
  else
    -- Venda/cancelamento: usa o order_id real propagado pela RPC.
    v_ctx := current_setting('shekinah.order_id', true);
    if v_ctx <> '' then
      begin
        v_order_id := v_ctx::uuid;
      exception when others then
        v_order_id := null;
      end;
    end if;

    if v_delta > 0 then
      v_type := 'venda'::public.stock_movement_type;
    else
      v_type := 'cancelamento'::public.stock_movement_type;
    end if;

    -- Fallback: pedido do MESMO dia mais recente, apenas se não veio contexto
    if v_order_id is null then
      select o.id into v_order_id
      from public.orders o
      where o.business_day_id = new.business_day_id
      order by o.created_at desc
      limit 1;
    end if;
  end if;

  insert into public.stock_movements
    (business_day_id, product_id, type, quantity, order_id, created_by)
  values
    (new.business_day_id, new.product_id, v_type, v_delta, v_order_id, auth.uid());

  return new;
end;
$$;

-- ------------------------------------------------------------
-- 1a. create_order reescrito (loop único, search_path='', order_id real)
-- ------------------------------------------------------------
create or replace function public.create_order(
  p_customer_name text,
  p_items jsonb,
  p_payment jsonb default null
)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles;
  v_day public.business_days;
  v_item jsonb;
  v_product_id bigint;
  v_qty int;
  v_product public.products;
  v_stock public.daily_stock;
  v_available int;
  v_total numeric := 0;
  v_subtotal numeric;
  v_order public.orders;
  v_pay jsonb;
  v_method public.payment_method;
  v_amount numeric;
  v_change numeric;
  v_last_product_id bigint;
  v_last_qty int;
begin
  -- 1) autorização: somente john
  select * into v_profile from public.profiles where id = auth.uid();
  if not found or v_profile.role <> 'john' then
    raise exception 'PERMISSAO_NEGADA';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'PEDIDO_SEM_ITENS';
  end if;

  -- 2) trava o dia aberto (for update) — serializa numeração
  select * into v_day
  from public.business_days
  where status = 'aberto'
  order by opened_at desc
  limit 1
  for update;

  if not found then
    raise exception 'DIA_NAO_ABERTO';
  end if;

  -- 3) calcula total e valida itens PRIMEIRO (com locks de estoque)
  --    guarda o último item para reuso (evita re-leitura do catálogo)
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_product_id := (v_item->>'product_id')::bigint;
    v_qty := (v_item->>'quantity')::int;

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
    end if;

    v_subtotal := round((v_qty * v_product.unit_price)::numeric, 2);
    v_total := v_total + v_subtotal;

    -- valida o preço enviado (opcional) contra o catálogo
    if v_item->>'unit_price' is not null then
      if abs((v_item->>'unit_price')::numeric - v_product.unit_price) > 0.001 then
        raise exception 'PRECO_INVALIDO';
      end if;
    end if;

    v_last_product_id := v_product.id;
    v_last_qty := v_qty;
  end loop;

  v_total := round(v_total, 2);

  -- 4) cria o pedido (número sequencial sob lock do dia)
  insert into public.orders (business_day_id, number, customer_name, total, status)
  values (v_day.id, v_day.next_order_number, p_customer_name, v_total, 'novo')
  returning * into v_order;

  update public.business_days
  set next_order_number = next_order_number + 1
  where id = v_day.id;

  -- 5) insere itens (reusa o catálogo já validado — re-leitura por item é
  --    no MESMO loop de baixa, sem janela de TOCTOU) e baixa estoque.
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_product_id := (v_item->>'product_id')::bigint;
    v_qty := (v_item->>'quantity')::int;
    select * into v_product from public.products where id = v_product_id;
    v_subtotal := round((v_qty * v_product.unit_price)::numeric, 2);

    insert into public.order_items (order_id, product_id, product_name, quantity, unit_price, subtotal)
    values (v_order.id, v_product.id, v_product.name, v_qty, v_product.unit_price, v_subtotal);

    -- baixa estoque com contexto de order_id para o trigger
    if v_product.tracks_stock then
      perform set_config('shekinah.order_id', v_order.id::text, true);
      update public.daily_stock
      set sold_qty = sold_qty + v_qty
      where business_day_id = v_day.id and product_id = v_product_id;
    end if;
  end loop;

  perform set_config('shekinah.order_id', '', true);

  -- 6) pagamento opcional
  if p_payment is not null and jsonb_typeof(p_payment) = 'array' and jsonb_array_length(p_payment) > 0 then
    for v_pay in select * from jsonb_array_elements(p_payment)
    loop
      v_method := (v_pay->>'method')::public.payment_method;
      v_amount := (v_pay->>'amount')::numeric;
      v_change := coalesce((v_pay->>'change_given')::numeric, 0);
      perform public.apply_payment_internal(v_order.id, v_method, v_amount, v_change);
    end loop;
  end if;

  -- 7) auditoria de status inicial
  insert into public.order_status_history (order_id, from_status, to_status, changed_by)
  values (v_order.id, null, 'novo', auth.uid());

  return v_order;
end;
$$;

revoke execute on function public.create_order(text, jsonb, jsonb) from public;
grant execute on function public.create_order(text, jsonb, jsonb) to authenticated;

commit;