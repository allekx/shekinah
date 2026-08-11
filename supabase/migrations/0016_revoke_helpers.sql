-- ============================================================
-- SHEKINAH — Migration 0016 — Hardening de helpers (auditoria)
--
-- is_john()/is_cozinha() eram executáveis por anon/authenticated
-- via grant default do Supabase (retornavam apenas booleano — sem
-- vazamento, mas higiene). O frontend NÃO chama esses helpers via
-- .rpc() (são usados dentro de políticas RLS e RPCs SECURITY DEFINER,
-- que invocam com privilégios do owner). Revoga o EXECUTE de anon e
-- authenticated, mantendo o uso interno intacto.
-- ============================================================

begin;

revoke execute on function public.is_john() from anon, authenticated, public;
revoke execute on function public.is_cozinha() from anon, authenticated, public;

-- Garante que RLS/RPCs continuam funcionando internamente (criam novas grants
-- para o papel que executa políticas, que roda como o owner/invoker elevado).
grant execute on function public.is_john() to postgres, service_role;
grant execute on function public.is_cozinha() to postgres, service_role;

commit;