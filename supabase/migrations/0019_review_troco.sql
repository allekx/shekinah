-- ============================================================
-- SHEKINAH — Migration 0019 — Fix: troco em dinheiro (modelo do caixa)
--
-- Revisão técnica: o apply_payment_internal bloqueava pagamento em que
-- o valor recebido EXCEDE o total (ex.: cliente dá R$100 num total de
-- R$80). Isso impedia o uso correto de TROCO (o excedente vira troco).
--
-- Correção: a validação e a quitação passam a considerar o LÍQUIDO
-- (amount - change_given) — o troco é devolvido, não altera o montante
-- registrado:
--   * allowed_extra = change_given (só faz sentido se amount > total)
--   * soma paga (que conta) = sum(amount)
--   * valida liquid = (v_paid_sum + amount - change_given) <= total
--   * quita quando liquid == total
-- Mantém: TROCO_SOMENTE_DINHEIRO, bloqueio de excedente sem troco.
-- ============================================================

begin;

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
  v_liquid numeric;
  v_new_liquid numeric;
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

  -- troco não pode existir sem que o valor recebido cubra o total
  if p_change_given > 0 and p_amount <= v_order.total then
    raise exception 'TROCO_INVALIDO';
  end if;

  select coalesce(sum(amount), 0) into v_paid_sum
  from public.payments
  where order_id = p_order_id;

  -- líquido que conta para quitar: amount - change_given
  v_liquid := (p_amount - p_change_given)::numeric;
  v_new_liquid := v_paid_sum + v_liquid;

  if v_new_liquid > v_order.total then
    raise exception 'PAGAMENTO_EXCEDE_TOTAL';
  end if;

  insert into public.payments (order_id, method, amount, change_given, created_by)
  values (p_order_id, p_method, p_amount, p_change_given, auth.uid());

  -- quita quando o líquido total atinge o total do pedido
  if v_new_liquid = v_order.total then
    update public.orders
    set paid = true, paid_at = now()
    where id = p_order_id;

    -- PEDIDO PRONTO + PAGO => ENTREGUE (remove da fila da cozinha)
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

commit;