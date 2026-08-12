-- ============================================================
-- SHEKINAH — Migration 0021 — Auditoria de impressão da comanda
--
-- REQUISITO OFICIAL (seção 11 do cloud.md):
-- A comanda física é gerada ao criar o pedido. Para registrar que a
-- comanda foi impressa (e permitir reimpressão) sem bloquear o pedido,
-- adicionamos a auditoria de impressão na tabela `orders`:
--   * printed_at      — quando a comanda foi impressa com sucesso (1ª vez);
--   * print_attempts  — nº de tentativas de impressão (para saber se houve
--                       reimpressão e quantas).
--
-- A impressão é DESACOPLADA da criação do pedido: falha de impressão
-- NÃO impede o pedido de ser salvo/visível na cozinha. Estas colunas são
-- apenas de registro (auditoria), preenchidas pelo frontend após imprimir.
-- ============================================================

begin;

alter table public.orders
  add column if not exists printed_at timestamptz,
  add column if not exists print_attempts int not null default 0 check (print_attempts >= 0);

-- (RLS: orders continua somente-leitura via RPCs; colunas novas seguem a
--  mesma proteção. Nenhuma mudança de política necessária.)

commit;
