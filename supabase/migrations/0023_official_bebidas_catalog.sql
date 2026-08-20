-- ============================================================
-- SHEKINAH — Migration 0023 — Catálogo oficial de Bebidas
--
-- Substitui as bebidas de TESTE (Coca-Cola 350ml, Guaraná 350ml, Água 500ml)
-- pelo cardápio oficial informado pelo estabelecimento (19/08/2026).
-- ============================================================

begin;

update public.products
set active = false
where category = 'Bebidas'
  and name in (
    'Coca-Cola 350ml',
    'Guaraná 350ml',
    'Água 500ml'
  );

insert into public.products (name, unit_price, category, tracks_stock, active)
select v.name, v.unit_price, 'Bebidas', true, true
from (
  values
    ('Coca-Cola 2L', 15.00),
    ('Coca-Cola 1,5L', 12.00),
    ('Suco natural', 20.00),
    ('Guaraná 2L', 9.00),
    ('Fanta 1,5L', 12.00),
    ('Água mineral 2L', 6.00)
) as v(name, unit_price)
where not exists (
  select 1
  from public.products p
  where lower(trim(p.name)) = lower(trim(v.name))
);

commit;
