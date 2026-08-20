-- ============================================================
-- SHEKINAH — Migration 0024 — Porções e Sobremesas (sem estoque inicial)
--
-- Adiciona adicionais e sobremesas ao cardápio oficial (19/08/2026).
-- tracks_stock = false: aparecem em novo pedido sem abertura de estoque.
-- ============================================================

begin;

insert into public.products (name, unit_price, category, tracks_stock, active)
select v.name, v.unit_price, v.category, false, true
from (
  values
    ('Farofa', 15.00, 'Porções'),
    ('Calabresa — unidade', 15.00, 'Porções'),
    ('Linguiça — unidade', 5.00, 'Porções'),
    ('Arroz', 15.00, 'Porções'),
    ('Baião', 15.00, 'Porções'),
    ('Purê', 15.00, 'Porções'),
    ('Pirão', 15.00, 'Porções'),
    ('Pudim', 5.00, 'Sobremesas'),
    ('Trufas', 2.50, 'Sobremesas'),
    ('Dindin', 2.00, 'Sobremesas')
) as v(name, unit_price, category)
where not exists (
  select 1
  from public.products p
  where lower(trim(p.name)) = lower(trim(v.name))
);

commit;
