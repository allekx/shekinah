-- ============================================================
-- SHEKINAH — Testes de integridade, RLS e RPCs
--
-- ESTADO: executados em 11/08/2026 contra o projeto Supabase real
-- (projeto jztxzmjdxzniatlgmxtk). Resultados: TODOS PASSARAM,
-- exceto o teste de anti-corrida concorrente (ver seção 5).
--
-- Como executar: no SQL Editor do Supabase ou via:
--   supabase db query --linked --file tests.sql
-- Ajuste os IDs (dias, pedidos, usuários) conforme o seu ambiente.
-- ============================================================

-- ------------------------------------------------------------
-- 0. Simular usuário autenticado (define request.jwt.claims)
--    Substitua pelos ids reais de john@ e cozinha@ do seu projeto.
-- ------------------------------------------------------------
-- John:
select set_config('request.jwt.claims', '{"sub":"<JOHN_UUID>","role":"authenticated"}', true);
-- Cozinha:
-- select set_config('request.jwt.claims', '{"sub":"<COZINHA_UUID>","role":"authenticated"}', true);

-- ------------------------------------------------------------
-- 1. Criação de produtos e abertura de dia  [OK]
-- ------------------------------------------------------------
select public.open_business_day(200, '[{"product_id":1,"quantity":20},{"product_id":4,"quantity":50}]'::jsonb);

-- ------------------------------------------------------------
-- 2. Pedido com baixa de estoque  [OK]
-- ------------------------------------------------------------
select public.create_order('João', '[{"product_id":1,"quantity":2,"unit_price":120}]'::jsonb);
-- Expectativa: cria pedido #1, baixa estoque de 20 → 18.

-- ------------------------------------------------------------
-- 3. Bloqueio de venda acima do estoque  [OK]
-- ------------------------------------------------------------
select public.create_order('Maria', '[{"product_id":1,"quantity":999}]'::jsonb);
-- Expectativa: erro 'ESTOQUE_INSUFICIENTE', nada gravado (transação).

-- ------------------------------------------------------------
-- 4. Anti-corrida (duas vendas simultâneas da última unidade)  [NÃO TESTADO]
-- ------------------------------------------------------------
-- Em duas abas/conexões ao mesmo tempo:
--   select public.create_order('A', '[{"product_id":1,"quantity":18}]'::jsonb);
--   select public.create_order('B', '[{"product_id":1,"quantity":1}]'::jsonb);
-- Expectativa: exatamente UMA falha ('ESTOQUE_INSUFICIENTE') e UMA passa,
-- porque o FOR UPDATE serializa o acesso à linha de daily_stock.
-- NOTA: não foi possível executar o teste concorrente real neste ambiente
-- (classificador de segurança indisponível); a mecânica (locks FOR UPDATE)
-- está implementada e o bloqueio de estoque insuficiente foi validado.

-- ------------------------------------------------------------
-- 5. Cozinha: transições de status  [OK]
-- ------------------------------------------------------------
select public.update_order_status(<pedido_id>, 'em_preparo'); -- cozinha OK
select public.update_order_status(<pedido_id>, 'pronto');     -- cozinha OK
select public.update_order_status(<pedido_id>, 'entregue');   -- cozinha => PERMISSAO_NEGADA (só john)
select public.update_order_status(<pedido_id>, 'em_preparo'); -- se já 'pronto' => TRANSICAO_INVALIDA

-- ------------------------------------------------------------
-- 6. Pagamento dividido  [OK]
-- ------------------------------------------------------------
select public.add_payment(<pedido_id>, 'dinheiro', 50);
select public.add_payment(<pedido_id>, 'pix', 70);
select public.add_payment(<pedido_id>, 'cartao', 100);
select public.add_payment(<pedido_id>, 'cartao', 1);  -- PAGAMENTO_EXCEDE_TOTAL
-- Expectativa: total 220 → paid=true após a 3ª forma.

-- ------------------------------------------------------------
-- 7. Cancelamento  [OK]
-- ------------------------------------------------------------
select public.cancel_order(<pedido_id_nao_pago>);   -- restaura estoque
select public.cancel_order(<pedido_id_pago>);       -- PEDIDO_JA_PAGO
-- Expectativa: cancelar pedido PAGO é bloqueado; não pago restaura sold_qty.

-- ------------------------------------------------------------
-- 8. Fechamento do dia  [OK]
-- ------------------------------------------------------------
select public.get_closeout(<dia_id>);
select public.close_business_day(<dia_id>, 200, '[]'::jsonb);
select public.create_order('X', '[{"product_id":1,"quantity":1}]'::jsonb);
-- Expectativa: após fechar, create_order => 'DIA_NAO_ABERTO'.

-- ------------------------------------------------------------
-- 9. Dois dias abertos (integridade)  [OK]
-- ------------------------------------------------------------
select public.open_business_day(0, '[]'::jsonb);
select public.open_business_day(0, '[]'::jsonb);
-- Expectativa: segunda chamada => 'DIA_JA_ABERTO' (unique index).

-- ------------------------------------------------------------
-- 10. RLS (cozinha não vê valores)  [OK]
-- ------------------------------------------------------------
-- Como cozinha (SET ROLE authenticated + request.jwt.claims cozinha):
-- SELECT * FROM public.payments;       => 0 linhas (sem SELECT)
-- SELECT * FROM public.orders;         => vê pedidos do dia
-- SELECT * FROM public.daily_stock;    => 0 linhas

-- ------------------------------------------------------------
-- 11. COMPLEMENTOS — pedido não bloqueado após envio à cozinha  [OK]
-- ------------------------------------------------------------
-- a) Envia pedido à cozinha (novo -> em_preparo):
--    select public.update_order_status(<pedido_id>, 'em_preparo');  -- como cozinha
-- b) John adiciona COMPLEMENTO (pedido ainda em_preparo):
--    select public.add_items_to_order(<pedido_id>,
--      '[{"product_id":3,"quantity":1},{"product_id":5,"quantity":1}]'::jsonb);
--    => total do pedido recalculado (soma todos itens); estoque baixado; order_complements criado.
-- c) Comanda complementar:
--    select public.get_complement_details(<complement_id>);
--    => order_number, customer_name, items[], complement_total.
-- d) Pagamento parcial + complemento (permitido enquanto paid=false):
--    select public.add_payment(<pedido_id>, 'dinheiro', 100);
--    select public.add_items_to_order(<pedido_id>, '[{"product_id":4,"quantity":1}]'::jsonb); -- total sobe
-- e) Bloqueios:
--    select public.add_items_to_order(<pedido_pago_id>, '[...]');    -- PEDIDO_JA_PAGO
--    select public.add_items_to_order(<pedido_entregue_id>, '[...]');-- PEDIDO_ENTREGUE
--    select public.add_items_to_order(<pedido_cancelado_id>, '[...]');-- PEDIDO_CANCELADO
-- f) Atomicidade (estoque insuficiente): nada gravado (sem complemento órfão).
--    select public.add_items_to_order(<pedido_id>, '[{"product_id":1,"quantity":999}]'::jsonb);
--    => ESTOQUE_INSUFICIENTE; order_complements e order_items intactos.
-- g) RLS: como cozinha, SELECT * FROM public.order_complements => vê linhas (🔔 complemento).
