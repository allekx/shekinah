-- ============================================================
-- SHEKINAH — Migration 0027 — Corrige complementos presos em PRONTO
--
-- Pedidos que receberam complemento antes da 0026 ficaram com status
-- pronto e complementos marcados pronto pelo backfill. Reabre na cozinha.
-- ============================================================

begin;

-- Complementos em pedido ainda PRONTO = trabalho pendente na cozinha
update public.order_complements oc
set kitchen_status = 'pendente'
from public.orders o
where oc.order_id = o.id
  and o.status = 'pronto'
  and o.paid = false
  and o.status <> 'cancelado'
  and oc.kitchen_status = 'pronto';

-- Reabre pedidos que têm complemento pendente
update public.orders o
set status = 'novo'
where o.status = 'pronto'
  and o.paid = false
  and exists (
    select 1
    from public.order_complements oc
    where oc.order_id = o.id
      and oc.kitchen_status = 'pendente'
  );

-- Histórico (auditoria da reabertura retroativa)
insert into public.order_status_history (order_id, from_status, to_status, changed_by)
select o.id, 'pronto', 'novo', oc.created_by
from public.orders o
join lateral (
  select created_by
  from public.order_complements
  where order_id = o.id and kitchen_status = 'pendente'
  order by created_at desc
  limit 1
) oc on true
where o.status = 'novo'
  and not exists (
    select 1
    from public.order_status_history h
    where h.order_id = o.id
      and h.from_status = 'pronto'
      and h.to_status = 'novo'
      and h.created_at > now() - interval '1 minute'
  );

commit;
