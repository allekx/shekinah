-- ============================================================
-- SHEKINAH — Migration 0011 — Complementos de pedidos
--
-- John pode adicionar novos itens a um pedido JÁ enviado à cozinha
-- (status novo/em_preparo/pronto) enquanto o dia estiver aberto e o
-- pedido NÃO estiver pago, cancelado ou entregue.
--
-- Modelo (decisão aprovada):
--   * order_complements            — agrupamento por adição posterior
--   * order_items.complement_id    — nullable FK; itens originais = NULL
--
-- Migração 100% ADITIVA: não altera colunas/tabelas existentes.
-- Pode ser aplicada via `supabase db push` sem tocar nas migrations
-- 0001–0010 já aplicadas no remoto.
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1. order_complements
-- ------------------------------------------------------------
create table public.order_complements (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

-- consulta por pedido (cozinha lista complementos de um pedido)
create index order_complements_order_idx
  on public.order_complements (order_id, created_at);

-- necessário para a FK composta de order_items (order_id, id)
create unique index order_complements_order_id_id_idx
  on public.order_complements (order_id, id);

comment on table public.order_complements is
  'Complemento de pedido: itens adicionados após a criação do pedido. Auditoria: quem/quando.';
comment on column public.order_complements.created_by is
  'John que adicionou o complemento (auth.uid()).';
comment on column public.order_complements.created_at is
  'Data/hora da adição — usada na comanda complementar e no Realtime.';

-- ------------------------------------------------------------
-- 2. order_items.complement_id
-- ------------------------------------------------------------
alter table public.order_items
  add column complement_id uuid;

-- FK composta: complemento referenciado pertence ao MESMO pedido.
-- NULL (itens originais) não é validado. ON DELETE CASCADE: excluir o
-- complemento remove os itens dele (complementos não são excluídos nos
-- fluxos atuais — proteção referencial apenas).
alter table public.order_items
  add constraint order_items_complement_same_order_fk
    foreign key (order_id, complement_id)
    references public.order_complements (order_id, id)
    on delete cascade;

comment on column public.order_items.complement_id is
  'NULL = item original do pedido; preenchido = item de um complemento (order_complements.id).';

create index order_items_complement_idx
  on public.order_items (order_id, complement_id);

-- created_at: ordem estável de exibição/impressão (order_items.id é uuid aleatório).
alter table public.order_items
  add column created_at timestamptz not null default now();

-- ------------------------------------------------------------
-- 3. RLS — order_complements
-- ------------------------------------------------------------
alter table public.order_complements enable row level security;

-- SELECT: qualquer autenticado. Cozinha PRECISA enxergar complementos
-- (identificar 🔔 COMPLEMENTO e os itens novos). order_complements não
-- guarda valores; e order_items (que já é legível por autenticados)
-- já expõe subtotais — portanto nenhuma informação financeira nova
-- vaza por aqui (consistente com o RLS existente de order_items).
create policy order_complements_select_authenticated
  on public.order_complements
  for select to authenticated
  using (true);

-- Gravações (INSERT) somente via RPC security definer:
-- NENHUMA policy de INSERT/UPDATE/DELETE (padrão do projeto:
-- "gravações de negócio só via RPC").

-- ------------------------------------------------------------
-- 4. RPC add_items_to_order — adiciona itens a um pedido existente
--
-- Regra de negócio (aprovada):
--   complemento permitido enquanto:
--     * autor = john
--     * dia do pedido está ABERTO
--     * pedido NÃO está pago (paid=false), NÃO cancelado, NÃO entregue
--   => pedido em novo/em_preparo/pronto permanece aberto a complementos,
--      mesmo depois de enviado à cozinha.
--
-- Mecânica (mesma do create_order):
--   * trava o pedido (FOR UPDATE)          — serializa pagamentos/status
--   * trava o dia (FOR UPDATE)             — consistência com close_business_day
--   * trava daily_stock por produto (FOR UPDATE) — anti-corrida de estoque
--
-- Auditoria:
--   * order_complements (created_by, created_at) + order_items.complement_id
--     = histórico completo (quem/quando/itens/quantidade/valor).
--   * orders.total é RECALCULADO pela soma de TODOS os order_items
--     (originais + complementos) — get_closeout e pagamentos continuam
--     corretos sem mudanças em nenhuma RPC.
--   * updated_at do pedido é atualizado pelo trigger orders_set_updated_at
--     → gera o evento Realtime UPDATE em orders (sinal p/ a cozinha refetchar).
-- ------------------------------------------------------------
create or replace function public.add_items_to_order(
  p_order_id uuid,
  p_items jsonb
)
returns public.orders
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile  public.profiles;
  v_order    public.orders;
  v_day      public.business_days;
  v_complement public.order_complements;
  v_item     jsonb;
  v_product_id bigint;
  v_qty      int;
  v_product  public.products;
  v_stock    public.daily_stock;
  v_available int;
  v_subtotal numeric;
  v_new_total numeric;
begin
  -- 1) autorização: somente john adiciona complementos
  select * into v_profile from public.profiles where id = auth.uid();
  if not found or v_profile.role <> 'john' then
    raise exception 'PERMISSAO_NEGADA';
  end if;

  -- 2) payload
  if p_items is null or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0 then
    raise exception 'COMPLEMENTO_SEM_ITENS';
  end if;

  -- 3) trava o pedido — serializa com add_payment/update_order_status/cancel_order
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'PEDIDO_NAO_ENCONTRADO';
  end if;

  -- 4) regra de negócio (sob o lock do pedido)
  if v_order.paid then
    raise exception 'PEDIDO_JA_PAGO';
  end if;
  if v_order.status = 'cancelado' then
    raise exception 'PEDIDO_CANCELADO';
  end if;
  if v_order.status = 'entregue' then
    raise exception 'PEDIDO_ENTREGUE';
  end if;

  -- 5) dia do pedido deve estar aberto (trava o dia)
  select * into v_day
  from public.business_days
  where id = v_order.business_day_id and status = 'aberto'
  for update;
  if not found then
    raise exception 'DIA_NAO_ABERTO';
  end if;

  -- 6) cria o complemento (auditoria: quem, quando)
  insert into public.order_complements (order_id, created_by)
  values (p_order_id, auth.uid())
  returning * into v_complement;

  -- 7) valida itens + baixa estoque (com locks por produto)
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_product_id := (v_item->>'product_id')::bigint;
    v_qty        := (v_item->>'quantity')::int;

    if v_qty is null or v_qty <= 0 then
      raise exception 'QUANTIDADE_INVALIDA';
    end if;

    select * into v_product from public.products where id = v_product_id;
    if not found or not v_product.active then
      raise exception 'PRODUTO_INATIVO';
    end if;

    if v_product.tracks_stock then
      select * into v_stock
      from public.daily_stock
      where business_day_id = v_day.id and product_id = v_product_id
      for update;

      if not found then
        raise exception 'PRODUTO_SEM_ESTOQUE_INICIAL';
      end if;

      v_available := v_stock.initial_qty - v_stock.sold_qty;
      if v_available < v_qty then
        raise exception 'ESTOQUE_INSUFICIENTE';
      end if;

      update public.daily_stock
      set sold_qty = sold_qty + v_qty
      where id = v_stock.id;
    end if;

    -- preço do cliente deve bater com o catálogo (mesma regra do create_order)
    if v_item->>'unit_price' is not null then
      if abs((v_item->>'unit_price')::numeric - v_product.unit_price) > 0.001 then
        raise exception 'PRECO_INVALIDO';
      end if;
    end if;
  end loop;

  -- 8) insere os itens do complemento (snapshot + complement_id)
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    select * into v_product from public.products where id = (v_item->>'product_id')::bigint;
    v_qty := (v_item->>'quantity')::int;
    v_subtotal := round((v_qty * v_product.unit_price)::numeric, 2);

    insert into public.order_items
      (order_id, product_id, product_name, quantity, unit_price, subtotal, complement_id)
    values
      (p_order_id, v_product.id, v_product.name, v_qty, v_product.unit_price, v_subtotal, v_complement.id);
  end loop;

  -- 9) RECALCULA o total do pedido: soma de TODOS os itens (originais + complementos).
  --    Não soma apenas o complemento — assim orders.total permanece a fonte única
  --    de verdade para get_closeout e apply_payment_internal.
  select coalesce(sum(subtotal), 0) into v_new_total
  from public.order_items
  where order_id = p_order_id;

  update public.orders
  set total = round(v_new_total, 2)
  where id = p_order_id
  returning * into v_order;

  -- 10) Auditoria = order_complements + order_items.complement_id (ver seção 0/5).
  --     updated_at foi atualizado pelo trigger → Realtime UPDATE em orders.
  --     NÃO insere em order_status_history (sem transição de status).

  return v_order;
end;
$$;

-- ------------------------------------------------------------
-- 5. RPC get_complement_details — detalhes da comanda complementar
-- ------------------------------------------------------------
create or replace function public.get_complement_details(p_complement_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_comp  public.order_complements;
  v_order public.orders;
  v_res   jsonb;
begin
  select * into v_comp from public.order_complements where id = p_complement_id;
  if not found then
    raise exception 'COMPLEMENTO_NAO_ENCONTRADO';
  end if;

  select * into v_order from public.orders where id = v_comp.order_id;

  select jsonb_build_object(
    'complement_id',   v_comp.id,
    'order_id',        v_comp.order_id,
    'order_number',    v_order.number,
    'customer_name',   v_order.customer_name,
    'created_by',      v_comp.created_by,
    'created_at',      v_comp.created_at,
    'items', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'product_id',   oi.product_id,
        'product_name', oi.product_name,
        'quantity',     oi.quantity,
        'unit_price',   oi.unit_price,
        'subtotal',     oi.subtotal
      )), '[]'::jsonb)
      from public.order_items oi
      where oi.complement_id = p_complement_id
    ),
    'complement_total', (
      select coalesce(sum(subtotal), 0)
      from public.order_items
      where complement_id = p_complement_id
    )
  ) into v_res;

  return v_res;
end;
$$;

-- ------------------------------------------------------------
-- Revoga acesso público e libera para autenticados
-- ------------------------------------------------------------
revoke execute on function public.add_items_to_order(uuid, jsonb) from public;
grant execute on function public.add_items_to_order(uuid, jsonb) to authenticated;

revoke execute on function public.get_complement_details(uuid) from public;
grant execute on function public.get_complement_details(uuid) to authenticated;

commit;
