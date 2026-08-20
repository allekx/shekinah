-- ============================================================
-- SHEKINAH — Migration 0022 — Catálogo oficial de Pratos
--
-- Substitui os pratos de TESTE (Banda de Tambaqui, Pirarucu, Frango)
-- pelo cardápio oficial informado pelo estabelecimento (19/08/2026).
-- Pratos antigos são desativados (soft delete) — histórico preservado.
-- ============================================================

begin;

-- Desativa pratos de exemplo/teste
update public.products
set active = false
where category = 'Pratos'
  and name in (
    'Banda de Tambaqui',
    'Pirarucu',
    'Frango'
  );

-- Insere pratos oficiais (idempotente por nome)
insert into public.products (name, unit_price, category, tracks_stock, active)
select v.name, v.unit_price, 'Pratos', true, true
from (
  values
    ('Banda de tambaqui assado', 130.00),
    ('Galinha caipira', 150.00),
    ('Curumim frito', 30.00),
    ('Caldeirada de tambaqui', 120.00),
    ('Bisteca', 35.00),
    ('Alcatra', 40.00),
    ('Picanha', 45.00),
    ('Churrasco misto', 35.00),
    ('Pato guisado', 150.00)
) as v(name, unit_price)
where not exists (
  select 1
  from public.products p
  where lower(trim(p.name)) = lower(trim(v.name))
);

commit;
