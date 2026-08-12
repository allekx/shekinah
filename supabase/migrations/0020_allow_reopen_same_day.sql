-- ============================================================
-- SHEKINAH — Migration 0020 — Permitir reabrir o mesmo dia
--
-- PROBLEMA (documentado no cloud.md):
-- Ao encerrar um dia e tentar abrir um NOVO dia ainda na mesma
-- data (fuso America/Manaus), a RPC open_business_day insere
-- `business_days` com `day = (now() at time zone tz)::date`.
-- Como a tabela tem `day date not null unique`, e o dia da
-- data já existe (mesmo estando `fechado`), o INSERT viola a
-- constraint business_days_day_key e aborta a transação — o
-- front cai no fallback "Não foi possível iniciar o dia".
--
-- CORREÇÃO:
-- Remover o UNIQUE em `day`, passando a permitir que a mesma
-- data tenha múltiplos registros (ex.: fechado + novo aberto).
-- A regra de "no máximo UM dia aberto por vez" continua garantida
-- pelo índice parcial único business_days_one_open_idx
-- (UNIQUE(1) WHERE status='aberto'), que já existia.
--
-- SEGURANÇA/HISTÓRICO:
-- Um `business_days` fechado nunca é apagado; reabrir a mesma
-- data cria um NOVO registro com seu próprio id (histórico e
-- pedidos do dia anterior permanecem intactos).
-- ============================================================

begin;

-- remove a constraint UNIQUE(day) (gerada pelo `day date not null unique` na 0003)
alter table public.business_days
  drop constraint if exists business_days_day_key;

commit;
