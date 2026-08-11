-- ============================================================
-- SHEKINAH — Seed (dados iniciais de exemplo)
--
-- ATENÇÃO:
--   * Produtos/categorias abaixo são EXEMPLO (baseado no contexto do
--     estabelecimento). John deve ajustar via tela "Configurações > Produtos".
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

-- Categorias e produtos de exemplo
insert into public.products (name, unit_price, category, tracks_stock) values
  ('Banda de Tambaqui', 120.00, 'Pratos', true),
  ('Pirarucu', 90.00, 'Pratos', true),
  ('Frango', 45.00, 'Pratos', true),
  ('Coca-Cola 350ml', 8.00, 'Bebidas', true),
  ('Guaraná 350ml', 8.00, 'Bebidas', true),
  ('Água 500ml', 5.00, 'Bebidas', true)
on conflict do nothing;
