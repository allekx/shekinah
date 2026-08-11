-- ============================================================
-- SHEKINAH — Migration 0017 — FIX: restore EXECUTE de helpers p/ authenticated
--
-- A 0016 revogou is_john()/is_cozinha() de authenticated, mas as
-- POLÍTICAS RLS executam esses helpers no contexto do papel que faz a
-- query (authenticated) — o que quebrou o RLS ("permission denied for
-- function is_john"). Restaura o EXECUTE para authenticated (necessário
-- ao funcionamento das políticas) e mantém revogado para anon/public.
-- ============================================================

begin;

grant execute on function public.is_john() to authenticated;
grant execute on function public.is_cozinha() to authenticated;

-- mantém revogado apenas o acesso anônimo (não autenticado)
revoke execute on function public.is_john() from anon, public;
revoke execute on function public.is_cozinha() from anon, public;

commit;