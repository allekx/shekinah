-- ============================================================
-- SHEKINAH — Seed (dados iniciais de exemplo)
--
-- ATENÇÃO:
--   * Produtos abaixo: cardápio oficial de Pratos + Bebidas para estoque inicial.
--   * Usuários de autenticação NÃO são criados aqui (exigem painel/CLI Supabase,
--     com senha). Criar no painel Auth: john@... (role john) e cozinha@... (role cozinha).
--     O trigger handle_new_user define o papel pelo prefixo do e-mail.
-- ============================================================

-- Configurações padrão
insert into public.settings (key, value) values
  ('tz', jsonb_build_object('tz', 'America/Manaus')),
  ('establishment', jsonb_build_object('name', 'SHEKINAH', 'address', 'Sítio — Igarapé')),
  ('printer', jsonb_build_object(
    'transport', 'preview',
    'width', 42,
    'networkUrl', null,
    'bluetoothService', null
  ))
on conflict (key) do nothing;

-- Catálogo oficial — Pratos Principais + Bebidas (estoque na abertura do dia)
insert into public.products (name, unit_price, category, tracks_stock) values
  ('Banda de tambaqui assado', 130.00, 'Pratos', true),
  ('Galinha caipira', 150.00, 'Pratos', true),
  ('Curumim frito', 30.00, 'Pratos', true),
  ('Caldeirada de tambaqui', 120.00, 'Pratos', true),
  ('Bisteca', 35.00, 'Pratos', true),
  ('Alcatra', 40.00, 'Pratos', true),
  ('Picanha', 45.00, 'Pratos', true),
  ('Churrasco misto', 35.00, 'Pratos', true),
  ('Pato guisado', 150.00, 'Pratos', true),
  ('Coca-Cola 2L', 15.00, 'Bebidas', true),
  ('Coca-Cola 1,5L', 12.00, 'Bebidas', true),
  ('Suco natural', 20.00, 'Bebidas', true),
  ('Guaraná 2L', 9.00, 'Bebidas', true),
  ('Fanta 1,5L', 12.00, 'Bebidas', true),
  ('Água mineral 2L', 6.00, 'Bebidas', true),
  ('Farofa', 15.00, 'Porções', false),
  ('Calabresa — unidade', 15.00, 'Porções', false),
  ('Linguiça — unidade', 5.00, 'Porções', false),
  ('Arroz', 15.00, 'Porções', false),
  ('Baião', 15.00, 'Porções', false),
  ('Purê', 15.00, 'Porções', false),
  ('Pirão', 15.00, 'Porções', false),
  ('Pudim', 5.00, 'Sobremesas', false),
  ('Trufas', 2.50, 'Sobremesas', false),
  ('Dindin', 2.00, 'Sobremesas', false)
on conflict do nothing;
