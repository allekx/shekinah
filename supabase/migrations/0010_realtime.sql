-- ============================================================
-- SHEKINAH — Migration 0010 — Realtime (Supabase)
--
-- Publica APENAS a tabela orders no canal Realtime (postgres_changes).
-- O Realtime respeita RLS: cozinha recebe INSERT/UPDATE de orders,
-- mas NÃO recebe eventos de payments (sem SELECT). Volume minúsculo.
-- ============================================================

begin;

alter publication supabase_realtime add table public.orders;

commit;
