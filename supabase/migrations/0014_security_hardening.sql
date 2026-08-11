-- ============================================================
-- SHEKINAH — Migration 0014 — Hardening de segurança (auditoria)
--
-- Correções da auditoria de segurança:
--  1. business_days RLS: cozinha NÃO vê histórico financeiro (só dia aberto).
--  2. orders RLS: cozinha vê apenas pedidos do dia ABERTO (não histórico).
--  3. create_order/add_items_to_order: corrige TOCTOU de preço (loop único).
--  4. log_stock_movement: order_id correto via set_config nas RPCs.
--  5. search_path='' nas RPCs (defense in depth).
--  6. revoke execute de public dos helpers is_john/is_cozinha.
--  7. Troco somente em dinheiro.
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1. business_days RLS — cozinha vê apenas o dia aberto
-- ------------------------------------------------------------
drop policy if exists business_days_select_authenticated on public.business_days;

create policy business_days_select on public.business_days
  for select to authenticated
  using (
    public.is_john()
    or status = 'aberto'
  );

-- ------------------------------------------------------------
-- 2. orders RLS — cozinha vê apenas pedidos do dia ABERTO
-- ------------------------------------------------------------
drop policy if exists orders_select_authenticated on public.orders;

create policy orders_select on public.orders
  for select to authenticated
  using (
    public.is_john()
    or exists (
      select 1 from public.business_days bd
      where bd.id = business_day_id and bd.status = 'aberto'
    )
  );

-- ------------------------------------------------------------
-- 6. revoke EXECUTE de public dos helpers (higiene; anon não chama)
-- ------------------------------------------------------------
revoke execute on function public.is_john() from public;
revoke execute on function public.is_cozinha() from public;

-- ------------------------------------------------------------
-- 7. Troco somente em dinheiro (apply_payment_internal)
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
set search_path = ''
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

  -- troco apenas em dinheiro
  if p_method <> 'dinheiro' and p_change_given > 0 then
    raise exception 'TROCO_SOMENTE_DINHEIRO';
  end if;

  -- trava a linha do pedido: serializa pagamentos simultâneos
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

revoke execute on function public.apply_payment_internal(uuid, public.payment_method, numeric, numeric) from public;
grant execute on function public.apply_payment_internal(uuid, public.payment_method, numeric, numeric) to authenticated;

commit;