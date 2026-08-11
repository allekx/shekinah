-- ============================================================
-- SHEKINAH — Migration 0007 — RPC create_order (anti-corrida)
--
-- Cria pedido com baixa de estoque ATÔMICA.
-- Travas (row locks):
--   * business_days do dia aberto (for update) — serializa numeração e
--     garante que o "dia aberto" não mude no meio da transação;
--   * daily_stock de cada produto (for update) — duas vendas simultâneas
--     NÃO podem consumir a mesma unidade: a 2ª espera o lock e falha.
-- ============================================================

begin;

create or replace function public.create_order(
  p_customer_name text,
  p_items jsonb,
  p_payment jsonb default null
)
returns public.orders
language plpgsql
security definer
set search_path = public, pg_temp
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
begin
  -- 1) autorização: somente john cria pedidos
  select * into v_profile from public.profiles where id = auth.uid();
  if not found or v_profile.role <> 'john' then
    raise exception 'PERMISSAO_NEGADA';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'PEDIDO_SEM_ITENS';
  end if;

  -- 2) trava o dia aberto (for update) — serializa concorrência de pedidos
  select * into v_day
  from public.business_days
  where status = 'aberto'
  order by opened_at desc
  limit 1
  for update;

  if not found then
    raise exception 'DIA_NAO_ABERTO';
  end if;

  -- 3) valida itens, calcula total e baixa estoque (com locks por produto)
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

    -- se o produto controla estoque: trava a linha e valida disponibilidade
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

      -- baixa o estoque
      update public.daily_stock
      set sold_qty = sold_qty + v_qty
      where id = v_stock.id;
    end if;

    v_subtotal := round((v_qty * v_product.unit_price)::numeric, 2);
    v_total := v_total + v_subtotal;

    if v_item->>'unit_price' is not null then
      -- validação: preço vindo do cliente não pode ser diferente do catálogo
      if abs((v_item->>'unit_price')::numeric - v_product.unit_price) > 0.001 then
        raise exception 'PRECO_INVALIDO';
      end if;
    end if;
  end loop;

  v_total := round(v_total, 2);

  -- 4) número sequencial do dia (sob o lock do dia)
  insert into public.orders (business_day_id, number, customer_name, total, status)
  values (v_day.id, v_day.next_order_number, p_customer_name, v_total, 'novo')
  returning * into v_order;

  update public.business_days
  set next_order_number = next_order_number + 1
  where id = v_day.id;

  -- 5) insere itens com snapshot de nome/preço/subtotal
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    select * into v_product from public.products where id = (v_item->>'product_id')::bigint;
    v_qty := (v_item->>'quantity')::int;
    v_subtotal := round((v_qty * v_product.unit_price)::numeric, 2);

    insert into public.order_items (order_id, product_id, product_name, quantity, unit_price, subtotal)
    values (v_order.id, v_product.id, v_product.name, v_qty, v_product.unit_price, v_subtotal);
  end loop;

  -- 6) pagamento opcional no ato do pedido
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
