-- ============================================================
-- SHEKINAH — Migration 0006 — RPCs de abertura/fechamento do dia
--              e relatório de conferência
-- ============================================================

begin;

-- ------------------------------------------------------------
-- Helper: aplicar um pagamento ao pedido (lógica compartilhada)
-- ------------------------------------------------------------
create or replace function public.apply_payment_internal(
  p_order_id uuid,
  p_method public.payment_method,
  p_amount numeric,
  p_change_given numeric default 0
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_total numeric;
  v_paid_sum numeric;
begin
  if p_amount <= 0 then
    raise exception 'PAGAMENTO_INVALIDO';
  end if;

  if p_change_given < 0 then
    raise exception 'TROCO_INVALIDO';
  end if;

  -- trava a linha do pedido: serializa pagamentos simultâneos do mesmo pedido
  select total into v_total
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'PEDIDO_NAO_ENCONTRADO';
  end if;

  if (select status from public.orders where id = p_order_id) = 'cancelado' then
    raise exception 'PEDIDO_CANCELADO';
  end if;

  select coalesce(sum(amount), 0) into v_paid_sum
  from public.payments
  where order_id = p_order_id;

  if v_paid_sum + p_amount > v_total then
    raise exception 'PAGAMENTO_EXCEDE_TOTAL';
  end if;

  insert into public.payments (order_id, method, amount, change_given, created_by)
  values (p_order_id, p_method, p_amount, p_change_given, auth.uid());

  if v_paid_sum + p_amount = v_total then
    update public.orders
    set paid = true, paid_at = now()
    where id = p_order_id;
  end if;
end;
$$;

-- ------------------------------------------------------------
-- RPC open_business_day
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

  -- 5) estoque inicial
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
      end if;
    end loop;
  end if;

  return v_day;
end;
$$;

-- ------------------------------------------------------------
-- RPC close_business_day
-- ------------------------------------------------------------
create or replace function public.close_business_day(
  p_day_id uuid,
  p_counted_cash numeric,
  p_stock_counted jsonb,
  p_notes text default null
)
returns public.business_days
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile public.profiles;
  v_day public.business_days;
  v_expected_cash numeric;
  v_diff numeric;
  v_stock_item jsonb;
  v_product_id bigint;
  v_counted int;
begin
  -- 1) autorização: somente john
  select * into v_profile from public.profiles where id = auth.uid();
  if not found or v_profile.role <> 'john' then
    raise exception 'PERMISSAO_NEGADA';
  end if;

  if p_counted_cash < 0 then
    raise exception 'DINHEIRO_CONTADO_INVALIDO';
  end if;

  -- 2) trava a linha do dia
  select * into v_day from public.business_days
  where id = p_day_id
  for update;

  if not found then
    raise exception 'DIA_NAO_ENCONTRADO';
  end if;

  if v_day.status = 'fechado' then
    raise exception 'DIA_JA_FECHADO';
  end if;

  -- 3) não permite fechar com pedidos não pagos e não cancelados
  if exists (
    select 1 from public.orders
    where business_day_id = p_day_id
      and paid = false
      and status <> 'cancelado'
  ) then
    raise exception 'HA_PEDIDOS_NAO_PAGOS';
  end if;

  -- 4) dinheiro esperado = caixa inicial + (pagamentos dinheiro - trocos)
  select coalesce(sum(amount - change_given), 0) into v_expected_cash
  from public.payments p
  join public.orders o on o.id = p.order_id
  where o.business_day_id = p_day_id
    and p.method = 'dinheiro';

  v_expected_cash := v_day.initial_cash + v_expected_cash;
  v_diff := round((v_expected_cash - p_counted_cash)::numeric, 2);

  -- 5) estoque final conferido por produto
  if p_stock_counted is not null and jsonb_typeof(p_stock_counted) = 'array' then
    for v_stock_item in select * from jsonb_array_elements(p_stock_counted)
    loop
      v_product_id := (v_stock_item->>'product_id')::bigint;
      v_counted := (v_stock_item->>'counted_qty')::int;

      if v_counted is null or v_counted < 0 then
        raise exception 'ESTOQUE_CONTADO_INVALIDO';
      end if;

      update public.daily_stock
      set final_counted_qty = v_counted
      where business_day_id = p_day_id and product_id = v_product_id;
    end loop;
  end if;

  -- 6) finaliza
  update public.business_days
  set status = 'fechado',
      closed_at = now(),
      closed_by = auth.uid(),
      counted_cash = p_counted_cash,
      cash_difference = v_diff,
      notes = p_notes
  where id = p_day_id
  returning * into v_day;

  return v_day;
end;
$$;

-- ------------------------------------------------------------
-- RPC get_closeout — relatório de conferência/fechamento
-- ------------------------------------------------------------
create or replace function public.get_closeout(p_day_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_day public.business_days;
  v_expected_cash numeric;
  v_result jsonb;
begin
  select * into v_day from public.business_days where id = p_day_id;
  if not found then
    raise exception 'DIA_NAO_ENCONTRADO';
  end if;

  select coalesce(sum(amount - change_given), 0) into v_expected_cash
  from public.payments p
  join public.orders o on o.id = p.order_id
  where o.business_day_id = p_day_id
    and p.method = 'dinheiro';

  v_expected_cash := coalesce(v_day.initial_cash, 0) + coalesce(v_expected_cash, 0);

  select jsonb_build_object(
    'day', to_char(v_day.day, 'YYYY-MM-DD'),
    'opened_at', v_day.opened_at,
    'closed_at', v_day.closed_at,
    'opened_by', v_day.opened_by,
    'initial_cash', v_day.initial_cash,
    'counted_cash', v_day.counted_cash,
    'expected_cash', v_expected_cash,
    'cash_difference', v_day.cash_difference,
    'notes', v_day.notes,
    'status', v_day.status,
    'orders_total', (
      select count(*) from public.orders where business_day_id = p_day_id
    ),
    'orders_by_status', (
      select jsonb_object_agg(status, cnt) from (
        select status::text as status, count(*) as cnt
        from public.orders
        where business_day_id = p_day_id
        group by status
      ) t
    ),
    'total_sales', (
      select coalesce(sum(total), 0) from public.orders
      where business_day_id = p_day_id and status <> 'cancelado'
    ),
    'payments_by_method', (
      select jsonb_object_agg(method, amount) from (
        select p.method::text as method, sum(p.amount) as amount
        from public.payments p
        join public.orders o on o.id = p.order_id
        where o.business_day_id = p_day_id
        group by p.method
      ) t
    ),
    'stock', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'product_id', ds.product_id,
        'product_name', pr.name,
        'initial_qty', ds.initial_qty,
        'sold_qty', ds.sold_qty,
        'expected_remaining', ds.initial_qty - ds.sold_qty,
        'final_counted_qty', ds.final_counted_qty
      )), '[]'::jsonb)
      from public.daily_stock ds
      join public.products pr on pr.id = ds.product_id
      where ds.business_day_id = p_day_id
    )
  ) into v_result;

  return v_result;
end;
$$;

-- ------------------------------------------------------------
-- Revoga acesso público e libera para autenticados
-- ------------------------------------------------------------
revoke execute on function public.apply_payment_internal(uuid, public.payment_method, numeric, numeric) from public;
grant execute on function public.apply_payment_internal(uuid, public.payment_method, numeric, numeric) to authenticated;

revoke execute on function public.open_business_day(numeric, jsonb) from public;
grant execute on function public.open_business_day(numeric, jsonb) to authenticated;

revoke execute on function public.close_business_day(uuid, numeric, jsonb, text) from public;
grant execute on function public.close_business_day(uuid, numeric, jsonb, text) to authenticated;

revoke execute on function public.get_closeout(uuid) from public;
grant execute on function public.get_closeout(uuid) to authenticated;

commit;
