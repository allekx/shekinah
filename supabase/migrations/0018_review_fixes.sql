-- ============================================================
-- SHEKINAH — Migration 0018 — Correções da revisão técnica
--
-- 1. Ao quitar o pagamento de um pedido PRONTO, marcar automaticamente
--    ENTREGUE (sai do fluxo ativo da cozinha). Sem isso o pedido pago
--    fica "preso" na coluna PRONTOS para sempre.
-- 2. RLS de products: john vê também produtos INATIVOS (para poder
--    reativar). Cozinha continua vendo só ativos.
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1. Payment quita + pedido pronto => ENTREGUE automático
--    (escreve em order_status_history com transição pronto->entregue)
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
  v_order public.orders;
  v_paid_sum numeric;
  v_was_paid boolean;
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

  if p_method <> 'dinheiro' and p_change_given > 0 then
    raise exception 'TROCO_SOMENTE_DINHEIRO';
  end if;

  -- trava a linha do pedido: serializa pagamentos simultâneos
  select * into v_order from public.orders where id = p_order_id for update;

  if not found then
    raise exception 'PEDIDO_NAO_ENCONTRADO';
  end if;

  if v_order.status = 'cancelado' then
    raise exception 'PEDIDO_CANCELADO';
  end if;

  v_was_paid := v_order.paid;

  select coalesce(sum(amount), 0) into v_paid_sum
  from public.payments
  where order_id = p_order_id;

  if v_paid_sum + p_amount > v_order.total then
    raise exception 'PAGAMENTO_EXCEDE_TOTAL';
  end if;

  insert into public.payments (order_id, method, amount, change_given, created_by)
  values (p_order_id, p_method, p_amount, p_change_given, auth.uid());

  if v_paid_sum + p_amount = v_order.total then
    update public.orders
    set paid = true, paid_at = now()
    where id = p_order_id;

    -- PEDIDO PRONTO + PAGO => ENTREGUE (remove da fila da cozinha)
    -- (não toca se estava em novo/em_preparo/cancelado)
    if v_order.status = 'pronto' then
      update public.orders
      set status = 'entregue'
      where id = p_order_id;

      insert into public.order_status_history (order_id, from_status, to_status, changed_by)
      values (p_order_id, 'pronto', 'entregue', auth.uid());
    end if;
  end if;
end;
$$;

revoke execute on function public.apply_payment_internal(uuid, public.payment_method, numeric, numeric) from public;
grant execute on function public.apply_payment_internal(uuid, public.payment_method, numeric, numeric) to authenticated;

-- ------------------------------------------------------------
-- 2. RLS products: john vê ativos E inativos (para reativar)
-- ------------------------------------------------------------
drop policy if exists products_select_active on public.products;

create policy products_select_active on public.products
  for select to authenticated
  using (active = true or is_john());

commit;