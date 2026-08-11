-- ============================================================
-- SHEKINAH — Sistema de gestão de restaurante (sítio/igarapé)
-- Migration 0001 — Enums e base do schema
--
-- Custo: plano free do Supabase (sem recursos pagos).
-- ============================================================

begin;

-- ------------------------------------------------------------
-- Enums
-- ------------------------------------------------------------
create type public.app_role as enum ('john', 'cozinha');
comment on type public.app_role is 'Papel do usuário no sistema. John = atendimento/caixa/gestão. Cozinha = preparo de pedidos.';

create type public.order_status as enum ('novo', 'em_preparo', 'pronto', 'entregue', 'cancelado');
comment on type public.order_status is 'Ciclo de vida do pedido na cozinha.';

create type public.payment_method as enum ('dinheiro', 'pix', 'cartao');
comment on type public.payment_method is 'Formas de pagamento aceitas (pagamento pode ser dividido).';

create type public.business_day_status as enum ('aberto', 'fechado');
comment on type public.business_day_status is 'Estado do dia de operação.';

commit;
