-- ============================================================
-- SHEKINAH — Migration 0013 — Validação de papel nas RPCs financeiras
--
-- Correção de segurança: as RPCs de acesso a dados financeiros/caixa
-- eram SECURITY DEFINER sem checar o papel, então a COZINHA podia chamar
-- get_closeout/add_payment e obter relatório financeiro. Agora exigem john.
-- ============================================================

begin;

-- ------------------------------------------------------------
-- get_closeout: somente john (relatório financeiro)
-- ------------------------------------------------------------
create or replace function public.get_closeout(p_day_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile public.profiles;
  v_day public.business_days;
  v_expected_cash numeric;
  v_result jsonb;
begin
  -- autorização: somente john
  select * into v_profile from public.profiles where id = auth.uid();
  if not found or v_profile.role <> 'john' then
    raise exception 'PERMISSAO_NEGADA';
  end if;

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
-- apply_payment_internal: valida john (helper, mas protege chamada direta)
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
  v_profile public.profiles;
  v_total numeric;
  v_paid_sum numeric;
begin
  -- autorização: somente john
  select * into v_profile from public.profiles where id = auth.uid();
  if not found or v_profile.role <> 'john' then
    raise exception 'PERMISSAO_NEGADA';
  end if;

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

-- add_payment já chama apply_payment_internal (que agora valida john).
-- Nenhuma outra mudança necessária (add_payment delega).

commit;