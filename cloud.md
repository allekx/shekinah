# SISTEMA SHEKINAH

> Documento Central de Memória e Continuidade do projeto.
> **Regra:** ao iniciar uma nova sessão, leia este arquivo ANTES de qualquer outra ação, analise o estado atual do código e continue exatamente de onde o projeto parou. Não reinicie o projeto sem necessidade e não refaça o que já está implementado.
> **Regra de atualização:** sempre que uma etapa importante for concluída, atualize este documento.

---

## 1. Visão geral do projeto

O Sistema Shekinah é um sistema de gestão para um estabelecimento de alimentação (restaurante/cozinha) localizado em um sítio. Ele gerencia o ciclo completo de um dia de operação: abertura do dia, estoque inicial, caixa inicial, atendimento, pedidos, cozinha, pagamento, caixa, conferência, fechamento e relatório.

O problema que resolve: centralizar e digitalizar o fluxo de pedidos e controle de caixa/estoque do estabelecimento, substituindo processos manuais (papel/anotações) por um sistema acessível via celular. Reduz perdas e erros em dias de grande movimento.

## 2. Objetivo

O objetivo principal do sistema é permitir que o estabelecimento controle todo o fluxo operacional do dia — da abertura ao encerramento — de forma simples, mobile-first e online, garantindo registro confiável de pedidos, estoque e caixa, com custo mensal de R$ 0,00 (somente recursos gratuitos).

## 3. Stack tecnológica

- **Frontend:** Next.js (App Router, TypeScript, Tailwind CSS) — PWA mobile-first, hospedado no Vercel (plano Hobby free).
- **Backend:** Lógica de negócio no PostgreSQL via RPCs (`SECURITY DEFINER`) do Supabase. Sem camada de API própria (o frontend chama RPCs/selects direto).
- **Banco de dados:** PostgreSQL gerenciado pelo Supabase (plano free).
- **Autenticação:** Supabase Auth (email + senha), sessão por cookies httpOnly via `@supabase/ssr`.
- **Tempo real:** Supabase Realtime (publicação da tabela `orders`).
- **Hospedagem:** Vercel (plano Hobby free). URL `*.vercel.app`.
- **Bibliotecas importantes:** `@supabase/supabase-js`, `@supabase/ssr`, `@tanstack/react-query`, `lucide-react`, `clsx`, `tailwind-merge`, `supabase` (CLI).
- **Tecnologias de impressão:** arquitetura modular (ReceiptBuilder + PrinterTransport plugáveis). Método/modelo ainda não definido — ver seção 11.

## 4. Arquitetura

- **Arquitetura web online**: o estabelecimento possui internet Wi-Fi e os usuários utilizarão celulares.
- **Mobile-first**: o sistema será desenhado prioritariamente para uso em celulares.
- **O cliente não terá acesso ao sistema**: o uso é interno, restrito aos perfis John e Cozinha.
- **Toda regra de negócio crítica no banco** (Postgres via RPCs transacionais): pedido, estoque, pagamento e fechamento. Evita duplicar regra no frontend e dispensa expor `service_role`.
- **Sem camada de API própria no Vercel**: menos código, menos funções serverless (limite free), menor superfície de ataque.
- **Gravações de negócio somente via RPCs `SECURITY DEFINER`**: tabelas de negócio não têm políticas de INSERT/UPDATE via RLS.
- **Segurança no banco**: RLS em todas as tabelas + validação explícita de papel dentro de cada RPC.
- **Preço é snapshot no item do pedido**: mudança futura de preço/catálogo não altera histórico.
- **Pedido NÃO fica bloqueado após envio à cozinha (COMPLEMENTOS)**: John pode adicionar itens a um pedido existente (`add_items_to_order`) enquanto o dia estiver aberto e o pedido não estiver pago/cancelado/entregue. Modelo: tabela `order_complements` + `order_items.complement_id`. O pedido não é imutável após ir à cozinha.

## 5. Estrutura do projeto

```
SHEKINAH/
├─ cloud.md                    # Documento Central de Memória e Continuidade
├─ app/                        # Frontend Next.js (App Router)
│  ├─ (auth)/login/page.tsx    # Login mobile-first — hero laranja + card flutuante (sem cadastro público)
│  ├─ (app)/layout.tsx         # Shell autenticado (header + sessão + logout)
│  ├─ (app)/session-header.tsx # Cabeçalho de sessão (marca + perfil + botão sair)
│  ├─ (app)/page.tsx           # Home: dashboard do dia (john) / INICIAR DIA
│  ├─ (app)/home-dashboard.tsx # Client: métricas ao vivo (Realtime orders) + grid Ações
│  ├─ (app)/usuarios/          # Gestão de usuários (john) — criar, e-mail, papel, senha
│  │  ├─ page.tsx              #   server: lista profiles
│  │  ├─ user-form.tsx         #   client: criar usuário (cozinha/atendimento)
│  │  └─ user-list.tsx         #   client: editar e-mail, papel, redefinir senha
│  ├─ (app)/abrir-dia/         # Abertura do dia
│  │  ├─ page.tsx              #   server: carrega produtos, redireciona se dia aberto
│  │  ├─ open-day-form.tsx     #   client: estoque [-] qty [+] + caixa + confirmar
│  │  └─ open-day-add-product.tsx  # client: cadastrar produto antes de abrir o dia
│  ├─ (app)/cozinha/           # Interface exclusiva da cozinha
│  │  ├─ page.tsx              #   server: pedidos do dia (sem preços)
│  │  └─ kitchen-board.tsx     #   client: 3 colunas + Realtime + botões
│  ├─ (app)/produtos/          # Gerenciamento de produtos (CRUD, john)
│  │  ├─ page.tsx              #   server: lista produtos + formulário
│  │  ├─ product-form.tsx      #   client: criar produto
│  │  └─ product-list.tsx      #   client: listar/editar/ativar-desativar
│  ├─ (app)/estoque/           # Estoque operacional do dia (john)
│  │  ├─ page.tsx              #   server: saldo + movimentações
│  │  └─ stock-panel.tsx       #   client: ajuste +/- e histórico
│  ├─ (app)/caixa/             # Módulo de caixa (john)
│  │  ├─ page.tsx              #   server: resumo via get_closeout + a receber
│  │  └─ cashier-panel.tsx     #   client: resumo, receber pagamento, conferência
│  ├─ (app)/fechamento/        # Fechamento do dia (john)
│  │  ├─ page.tsx              #   server: detalhes via get_closeout + estado encerrado
│  │  └─ closeout-panel.tsx    #   client: conferência + confirmar + DIA ENCERRADO
│  ├─ (app)/historico/         # Histórico de dias encerrados (john)
│  │  ├─ page.tsx              #   server: lista dias + pedidos/total
│  │  └─ history-list.tsx      #   client: cards de dias
│  ├─ (app)/relatorio/         # Relatório do dia (john, somente leitura)
│  │  ├─ page.tsx              #   redireciona ao último dia
│  │  └─ [dayId]/
│  │     ├─ page.tsx           #   server: get_closeout + responsável
│  │     └─ report-view.tsx    #   client: detalhes + imprimir relatório (preview)
│  ├─ (app)/pedidos/novo/      # Novo pedido (atendimento, john)
│  │  ├─ page.tsx              #   server: produtos + disponibilidade do dia
│  │  └─ new-order-form.tsx    #   client: cliente, itens, total, pagamento, finalizar
│  ├─ (app)/pedidos/           # Acompanhamento de pedidos (john, Realtime)
│  │  ├─ page.tsx              #   server: pedidos + itens do dia
│  │  └─ orders-board.tsx      #   client: grid status + Realtime
│  ├─ layout.tsx               # Layout raiz (metadata, pt-BR)
│  └─ globals.css
├─ lib/
│  ├─ auth/actions.ts          # Server actions: login, logout
│  ├─ auth/open-day.ts         # Server action: openDay (abertura do dia)
│  ├─ auth/products.ts         # Server actions: produtos (CRUD)
│  ├─ auth/stock.ts            # Server action: ajuste de estoque
│  ├─ auth/orders.ts           # Server action: createOrderAction (novo pedido)
│  ├─ auth/kitchen.ts          # Server action: updateStatusAction (cozinha)
│  ├─ auth/cashier.ts          # Server action: addPaymentAction (caixa)
│  ├─ auth/close-day.ts        # Server action: closeDay (fechamento)
│  ├─ auth/users.ts            # Server actions: gestão de usuários (Admin API server-side)
│  ├─ supabase/admin.ts        # Cliente service_role — SOMENTE servidor (criar/redefinir senha/e-mail)
│  ├─ greeting.ts                # Saudação dinâmica (Bom dia/tarde/noite, fuso America/Sao_Paulo)
│  └─ printing/                # Camada modular de impressão
│     ├─ types.ts              #   interfaces ReceiptBuilder/PrinterTransport
│     ├─ text-builder.ts       #   formatador de texto (largura em colunas)
│     ├─ escpos.ts             #   bytes ESC/POS (INIT, alinhamento, negrito)
│     ├─ receipts.ts           #   comanda, complemento, relatório de fechamento
│     └─ transports.ts         #   transportes plugáveis (preview default + stubs)
├─ components/
│  ├─ page-shell.tsx              # Cabeçalho padrão das páginas internas (BackButton + título)
│  ├─ brand-mark-icon.tsx         # Ícone da marca (sítio + cozinha + pedido)
│  ├─ brand-wordmark.tsx          # Marca Shekinah (ícone + logotipo tipográfico)
│  ├─ print/
│  │  └─ print-preview-modal.tsx  # Pré-visualização (modal monoespaçado)
│  ├─ sw-register.tsx             # Registro do service worker (PWA)
│  └─ connection-banner.tsx       # Banner de sem-conexão (aviso online/offline)
├─ public/                        # Assets PWA
│  ├─ manifest.webmanifest        #   manifest (standalone, icons, theme)
│  ├─ sw.js                       #   service worker (network-first, app-shell)
│  ├─ icon.svg + icon-192/512/maskable.png + apple-touch-icon.png
├─ scripts/generate-icons.mjs     # Gera os ícones PNG via sharp (node scripts/generate-icons.mjs)
├─ middleware.ts               # Sessão + proteção de rotas + guarda por perfil + assets públicos PWA
├─ .env.local                  # URL + anon key + SUPABASE_SERVICE_ROLE_KEY (secret, só servidor)
├─ .env.example                # Template (inclui placeholder da service_role / Secret key)
├─ scripts/test-auth.mjs       # Teste de autenticação (anon key + RLS)
└─ supabase/
│  ├─ config.toml              # Configuração do Supabase CLI (sem credenciais)
│  ├─ README.md                # Instruções de uso das migrations
│  ├─ migrations/              # SQL versionado do banco (0001..0010)
│  │  ├─ 0001_enums_and_base.sql              # Enums (app_role, order_status, payment_method, business_day_status)
│  │  ├─ 0002_profiles_trigger_rls.sql        # profiles + trigger handle_new_user + RLS
│  │  ├─ 0003_products_daily_stock.sql        # products + daily_stock + RLS
│  │  ├─ 0004_orders_items_payments_history.sql # business_days + orders + order_items + payments + order_status_history
│  │  ├─ 0005_settings_helpers.sql            # settings + helpers is_john/is_cozinha
│  │  ├─ 0006_rpc_open_close_day.sql          # RPCs: open/close_business_day, get_closeout, apply_payment_internal
│  │  ├─ 0007_rpc_create_order.sql            # RPC create_order (anti-corrida)
│  │  ├─ 0008_rpc_status_payment_cancel.sql   # RPCs: update_order_status, add_payment, cancel_order
│  │  ├─ 0010_realtime.sql                    # publicação Realtime (orders)
│  │  ├─ 0011_order_complements.sql           # COMPLEMENTOS: order_complements + complement_id + RPCs add_items_to_order/get_complement_details
│  │  ├─ 0012_stock_movements.sql             # MOVIMENTAÇÕES: stock_movements + trigger + RPC adjust_stock
│  │  ├─ 0013_rpc_role_checks.sql             # SEGURANÇA: validação de john em get_closeout/apply_payment_internal
│  │  ├─ 0014_security_hardening.sql          # AUDITORIA: RLS business_days/orders, troco só dinheiro, revoke helpers
│  │  ├─ 0015_security_integrity.sql          # AUDITORIA: create_order refeito (TOCTOU) + order_id real do trigger
│  │  ├─ 0016_revoke_helpers.sql              # AUDITORIA: revoke is_john/cozinha de anon/public
│  │  └─ 0017_fix_helper_grants.sql           # AUDITORIA: fix — restore EXECUTE authenticated (RLS)
│  ├─ seed.sql                 # settings padrão + produtos de exemplo
│  └─ tests.sql                # Roteiro de testes (integridade/RLS/RPC)
```

> Nota: a migration `0009` do plano não foi criada — `get_closeout` foi incorporada à `0006`. Numeração segue sem lacunas de execução.

## 6. Banco de dados

### Enums
- `public.app_role` — `john`, `cozinha`
- `public.order_status` — `novo`, `em_preparo`, `pronto`, `entregue`, `cancelado`
- `public.payment_method` — `dinheiro`, `pix`, `cartao`
- `public.business_day_status` — `aberto`, `fechado`

### Tabelas
- **`profiles`** — espelho de `auth.users` (id, email, display_name, role, created_at). Papel definido pelo prefixo do e-mail (`john@*` → john; demais → cozinha) via trigger `handle_new_user`.
- **`products`** — catálogo (id, name, unit_price, category, tracks_stock, active). Soft delete (`active=false`).
- **`business_days`** — dia de operação (id, day único, status, opened_at, opened_by, initial_cash, next_order_number, closed_at, closed_by, counted_cash, cash_difference, notes). **Index parcial único garante no máximo um dia aberto.**
- **`daily_stock`** — estoque diário por produto (business_day_id, product_id, initial_qty, sold_qty, final_counted_qty). Saldo = `initial_qty - sold_qty` (não armazenado).
- **`orders`** — pedidos (id, business_day_id, number, customer_name, status, total, paid, paid_at, timestamps). `unique(business_day_id, number)`. `total` é recalculado pela soma de TODOS os itens (originais + complementos).
- **`order_items`** — itens com snapshot de produto/nome/preço/subtotal (order_id, product_id, product_name, quantity, unit_price, subtotal, complement_id nullable, created_at). `complement_id = NULL` = item original; preenchido = item de complemento (FK composta `(order_id, complement_id) → order_complements(order_id, id)`).
- **`order_complements`** — agrupador de itens adicionados depois (id, order_id, created_by, created_at). Auditoria de complementos: quem/quando/itens.
- **`payments`** — pagamentos divididos (order_id, method, amount, change_given, created_by).
- **`order_status_history`** — auditoria de transições de status (order_id, from_status, to_status, changed_by, created_at).
- **`settings`** — configuração chave/valor JSON (tz, establishment, printer).

### Relacionamentos (FKs)
- `profiles.id → auth.users(id)` (on delete cascade)
- `business_days.opened_by/closed_by → profiles(id)`
- `daily_stock.business_day_id → business_days(id)` (on delete cascade); `product_id → products(id)`
- `orders.business_day_id → business_days(id)`; `orders` não deleta (histórico preservado)
- `order_items.order_id → orders(id)` (on delete cascade); `product_id → products(id)`
- `order_items.(order_id, complement_id) → order_complements(order_id, id)` (FK composta; garante complemento do mesmo pedido; NULL = original)
- `payments.order_id → orders(id)` (on delete cascade); `created_by → profiles(id)`
- `order_status_history.order_id → orders(id)` (on delete cascade)

### Regras importantes
- Um pedido pertence obrigatoriamente a um dia de operação.
- Pedido só pode ser criado com dia **aberto** (`create_order` → `DIA_NAO_ABERTO`).
- Dia **fechado** não recebe novos pedidos.
- No máximo **um dia aberto** por vez (index parcial único + RPC).
- **Estoque nunca negativo**: check constraints + validação dentro da RPC.
- Operações críticas são **transacionais** (RPCs `SECURITY DEFINER`).
- **Anti-corrida**: `SELECT ... FOR UPDATE` na linha do dia e de `daily_stock` por produto.
- Dados de dias encerrados são **preservados** (histórico, sem delete).
- **Complementos**: pedido pode receber novos itens (`add_items_to_order`) enquanto dia aberto e pedido não pago/cancelado/entregue. Revalida estoque, baixa novamente, recalcula total, registra auditoria (order_complements) e envia Realtime UPDATE em `orders`. Itens originais nunca são editados/apagados (sem edição destrutiva).

### Migrations
- 10 arquivos em `supabase/migrations/` (0001 a 0011), seed e tests.

### RPCs
| RPC | Função | Papel |
|---|---|---|
| `open_business_day` | Abre o dia, registra estoque inicial e caixa inicial | john |
| `close_business_day` | Fecha o dia com conferência (dinheiro contado, estoque conferido, diferença) | john |
| `get_closeout` | Relatório de conferência/fechamento | john |
| `create_order` | Cria pedido, baixa estoque atômico, numeração sequencial, pagamento opcional | john |
| `add_payment` | Pagamento adicional (dividido) | john |
| `update_order_status` | Transições de status com regras por papel | cozinha/john |
| `cancel_order` | Cancela pedido não pago e restaura estoque (inclui itens de complemento) | john |
| `add_items_to_order` | Adiciona COMPLEMENTO a pedido existente (valida/baixa estoque, recalcula total, auditoria) | john |
| `get_complement_details` | Detalhes da comanda complementar (para impressão/exibição na cozinha) | autenticado |
| `apply_payment_internal` | Helper de aplicação de pagamento (troco, excedente) | interno |

## 7. Usuários e permissões

- **John** (papel `john`) — atendimento, caixa, abertura/fechamento do dia, relatórios, configurações, gestão de produtos/usuários/impressora.
- **Cozinha** (papel `cozinha`) — somente cozinha: ver pedidos e mudar status (`novo → em_preparo → pronto`). Sem acesso a caixa, pagamentos, estoque, relatórios ou configurações.

- **Atendimento** (papel `john`) — o papel `john` representa o atendimento/gerência: iniciar/fechar dia, caixa, pedidos, relatórios, configurações. Usuário real: `atendimento@shekinah.com`.
- **Cozinha** (papel `cozinha`) — somente cozinha. Usuário real: `cozinha@shekinah.com`.

Criação de usuários:

- **Pelo app** (recomendado): tela `/usuarios` (somente john) — criar usuário cozinha ou atendimento, alterar e-mail, trocar papel, redefinir senha. Usa **Supabase Admin API** via `SUPABASE_SERVICE_ROLE_KEY` em Server Actions (`lib/auth/users.ts` + `lib/supabase/admin.ts`). A chave **nunca** vai ao frontend (sem prefixo `NEXT_PUBLIC_`).
- **Pelo painel Supabase** (alternativa): Auth → Users → Add user, ou Secret keys no dashboard.
- O trigger `handle_new_user` define papel por prefixo de e-mail (`john@*` → john; demais → cozinha). O app **sobrescreve** o papel após criar via Admin API (corrige e-mails como `atendimento@...`).

**Múltiplos atendentes simultâneos:** um único dia aberto compartilhado (estoque, pedidos, caixa). Locks no Postgres (`FOR UPDATE` em `create_order`, pagamentos) evitam corrida. Cozinha recebe pedidos de todos via Realtime. Relatório/fechamento consolida **todo o dia** (não separa por atendente; `payments.created_by` fica no banco para auditoria futura).

> NOTA IMPORTANTE: usuários criados **fora do painel/Admin API** (ex.: via INSERT direto em `auth.users`) não são reconhecidos pelo GoTrue no login ("Database error querying schema"). Usuários devem ser criados **sempre pelo painel ou Admin API** (gera identity/confirmed_at corretos).

## 8. Funcionalidades

- [x] Banco de dados (schema + migrations + RLS + RPCs) — migrations EXECUTADAS e validadas no projeto Supabase real
- [x] Autenticação (login/logout/sessão/proteção de rotas/perfil) — testada com usuários reais do painel
- [x] Abertura do dia (tela /abrir-dia + dashboard + RPC) — testada
- [x] Cadastro de produto na abertura do dia (/abrir-dia — antes de confirmar abertura; reutiliza `createProduct`)
- [x] Estoque inicial (grade com [-] qty [+], validação, persistência) — testada
- [x] Caixa inicial (informado na abertura, registrado) — testado
- [x] Produtos (CRUD: nome, categoria, preço, ativo/inativo; somente john) — testado
- [x] Estoque operacional (saldo do dia, ajuste +/-, ESGOTADO, histórico de movimentações) — testado
- [x] Pedidos (tela de atendimento /pedidos/novo + server action + RPC create_order) — código pronto, fluxo TESTADO ponta a ponta (15 cenários OK)
- [x] Acompanhamento de pedidos (tela /pedidos + Realtime) — grid NOVOS/PREPARO/PRONTOS/FINALIZADOS, atualização automática
- [x] Cozinha (interface exclusiva /cozinha + Realtime) — 3 colunas, transições de status, destaque + som; permissões protegidas
- [x] Caixa (módulo /caixa) — resumo (inicial/vendas por forma/esperado), receber pedidos (pagamento dividido/troco), conferência (contado vs esperado, diferença)
- [x] Fechamento do dia (tela /fechamento) — conferência (vendas/caixa/estoque), confirmar, bloqueia dia, DIA ENCERRADO + IMPRIMIR RELATÓRIO
- [x] Impressão (arquitetura modular) — camada lib/printing + preview; formatos comanda/complemento/relatório prontos; transportes plugáveis (método a definir)
- [x] Histórico e Relatórios — /historico (dias encerrados) e /relatorio/[dayId] (detalhes + imprimir relatório)
- [x] Dashboard principal do John (home /) — sem dia → INICIAR DIA; com dia → métricas ao vivo (Realtime) + saudação dinâmica + grid Ações (Pedidos, Caixa, Estoque, **Usuários**)
- [x] Gestão de usuários (/usuarios) — criar cozinha/atendimento, alterar e-mail, trocar papel, redefinir senha (john + Admin API server-side)
- [x] Identidade visual unificada (design system `sk-*` em globals.css) — mobile-first, padding lateral consistente, PageShell nas telas internas
- [x] PWA (Android) — manifest, ícones (192/512/maskable/apple), service worker manual, viewport, banner de conexão, anti-duplicação verificada

Legenda: `[x]` concluído · `[~]` parcialmente implementado · `[ ]` ainda não implementado

## 9. Fluxo do sistema

```
ABERTURA DO DIA
↓
ESTOQUE INICIAL
↓
CAIXA INICIAL
↓
ATENDIMENTO
↓
PEDIDO
↓
ESTOQUE
↓
COZINHA
↓
PEDIDO PRONTO
↓
PAGAMENTO
↓
CAIXA
↓
CONFERÊNCIA
↓
FECHAMENTO
↓
RELATÓRIO
↓
DIA ENCERRADO
```

## 10. Decisões técnicas

- Foi decidido utilizar arquitetura web online porque o estabelecimento possui internet Wi-Fi e os usuários utilizarão celulares.
- Foi decidido que o sistema será mobile-first.
- Foi decidido que o cliente não terá acesso ao sistema.
- Foi decidida a stack **Supabase + Next.js (Vercel)**, tudo no plano free (R$ 0,00/mês, sem cartão).
- Foi decidido que **toda regra de negócio crítica roda no banco** (RPCs transacionais), sem camada de API própria.
- Foi decidido que **gravações de negócio** (pedidos, estoque, pagamentos, dias) **só via RPC**; catálogo (products) e settings editáveis por John via RLS.
- Foi decidido que **pagamento pode ser dividido** em múltiplas formas (dinheiro/pix/cartão), com troco modelado (change_given).
- Foi decidido que **estoque é controlado por dia** (`initial_qty - sold_qty`), não armazenado como saldo global.
- Foi decidido que **dados de dias encerrados são preservados** no banco (histórico completo); fechamento só marca `status=fechado` e grava conferência — impressão do relatório não apaga nada.
- Foi decidido que **gestão de usuários no app** usa `service_role` apenas em Server Actions (variável `SUPABASE_SERVICE_ROLE_KEY`), nunca no bundle client.
- Foi decidido que **preço é snapshot** no item do pedido.
- Foi decidido que **cancelação só de pedido não pago** (estorno/reembolso fora do escopo atual).
- Foi decidido que **papel do usuário é definido pelo prefixo do e-mail** (john@ → john).
- Foi decidido que **impressão é modular** (builder + transport), método/modelo definidos posteriormente.
- Foi decidido que **um pedido NÃO fica bloqueado após envio à cozinha** — pode receber COMPLEMENTOS (`add_items_to_order`) enquanto o dia estiver aberto e o pedido não estiver pago/cancelado/entregue.
- Foi decidido que **complemento é agrupado** em tabela `order_complements` + `order_items.complement_id` (NULL = item original). Auditoria completa (quem/quando/itens/valor) sem poluir `order_status_history`.
- Foi decidido que **complemento é permitido com pagamento parcial** (bloqueado apenas após `paid=true`).
- Foi decidido que **não há edição destrutiva de itens já enviados**; remoção é operação separada com auditoria (fora do escopo atual).
- Foi decidido que **a cozinha identifica complemento** (🔔 COMPLEMENTO — PEDIDO #X) e que a **impressão do complemento é uma comanda complementar separada** (não reimprime o pedido inteiro).
- Foi decidido que **novos produtos podem ser cadastrados na tela /abrir-dia** antes de iniciar o dia (reutiliza `createProduct`; ordem da grade: Pratos → Bebidas → cadastrar produto → caixa).
- Foi decidida a **identidade visual da marca**: ícone customizado (casa rústica + fumaça de cozinha + prato) substituindo a letra "S"; logotipo **SHEKINAH** em uppercase com `tracking-[0.18em]` (componentes `brand-mark-icon` + `brand-wordmark`).
- Foi decidida a **paleta laranja da identidade visual** (restaurante no sítio): laranja forte `#FF8A4F` (`primary-500`) e pêssego `#FFC176` (`primary-300`). Escala completa em `app/globals.css` (`primary-50`…`primary-900`); substitui o azul anterior em todo o app (botões, gradientes, focus, PWA `theme_color`).

## 11. Impressão

> **REQUISITO OFICIAL (registrado em 12/08/2026, IMPLEMENTADO em 12/08/2026):**
> Quando o John atender e criar um pedido, ao confirmar o pedido o sistema:
> 1. salva o pedido normalmente;
> 2. envia o pedido à Tela da Cozinha em tempo real (Realtime);
> 3. **gera a COMANDA FÍSICA** para impressão em **impressora térmica NÃO fiscal**;
> 4. a comanda é levada manualmente pelo John até a cozinha;
> 5. a cozinha terá os DOIS meios (obrigatórios, não substituíveis): **tela digital** + **comanda física impressa**.
>
> **Formato oficial da comanda (implementado e validado):**
> ```
>                  SHEKINAH
> ──────────────────────────────────────────
>
>                Comanda #00125
> Cliente: João
> ──────────────────────────────────────────
>  1x Banda de Tambaqui             R$ 120,00
>  2x Coca-Cola 350ml                R$ 16,00
> ──────────────────────────────────────────
> TOTAL                            R$ 136,00
>
> Data: 11/08/2026
> Hora: 22:38
> ```
>
> **IMPLEMENTAÇÃO (12/08/2026):**
> - **`lib/printing/print.ts`** (novo): serviço `printOrderReceipt` — monta a comanda (`buildOrderReceipt`) e dispara o transporte. **Nunca lança** → devolve `{ ok, preview }`. **Desacoplado**: roda DEPOIS de o pedido ser salvo; falha de impressão NÃO perde o pedido.
> - **`lib/printing/receipts.ts`**: comanda reformatada para o requisito oficial (Comanda #0XXXX, itens com subtotal à direita, TOTAL, Data/Hora separados). Alinhamento em colunas de 42.
> - **`app/(app)/pedidos/novo/new-order-form.tsx`**: integrado ao fluxo — ao confirmar o pedido (RPC salva → Realtime na cozinha), monta a comanda e imprime; mostra modal "✅ Pedido salvo · comanda" com pré-visualização + **"♻ Reimprimir comanda"** + "Concluir e voltar ao início"; em falha: "⚠️ Pedido salvo, impressão falhou" (comanda exibida na tela, reimpressão disponível).
> - **`lib/auth/orders.ts`**: `createOrderAction` retorna os `items` (com `unit_price`) além de `orderId`/`orderNumber`, para montar a comanda.
> - **Migration `0021_order_print_log.sql` (aplicada no banco real)**: adiciona `printed_at` + `print_attempts` em `orders` (auditoria de impressão/reimpressão). Não bloqueia nada.
>
> **Status do transporte físico:** o método de conexão REAL (rede Wi-Fi / Web Bluetooth / USB-C) continua **por definir** (depende do modelo da impressora escolhida). O fluxo e o transporte plugável estão prontos; o default é `preview` (pré-visualização na tela). Ao escolher o modelo da impressora, implementar o transporte real em `transports.ts` (rede/web-bluetooth/usb).

> Modelo da impressora e método de conexão da impressão FÍSICA AINDA NÃO DEFINIDOS. O fluxo web está implementado (comanda + preview + reimpressão). Não inventar solução de transporte não validada — ao escolher a impressora (térmica não-fiscal ESC/POS, ideal com rede), definir o transporte em `transports.ts`.

**Arquitetura modular implementada** (`lib/printing/`):

| Arquivo | Responsabilidade |
|---|---|
| `types.ts` | Interfaces `ReceiptBuilder` + `PrinterTransport` (camada de montagem separada do transporte) |
| `text-builder.ts` | Formatador de texto por colunas (width configurável, default 42), centralização, divisores |
| `escpos.ts` | Geração de **bytes ESC/POS** (INIT, alinhamento, negrito, sublinhado, latin-1) |
| `receipts.ts` | Geradores: **comanda** (`buildOrderReceipt`), **complemento** (`buildComplementReceipt`), **relatório** (`buildCloseoutReceipt`) |
| `transports.ts` | Transportes plugáveis: **preview (default)**, bluetooth, webusb, network, console (brancos/stubs documentados) |
| **`print.ts`** | **Serviço de alto nível** `printOrderReceipt`: monta a comanda + dispara o transporte. Desacoplado (nunca bloqueia o pedido) e nunca lança (sempre `{ ok, preview }`). |

**Documentos preparados** (formato do requisito):
- **Comanda**: SHEKINAH / PEDIDO #XXX / CLIENTE / itens (2x ...) / TOTAL / DATA-HORA.
- **Complemento**: SHEKINAH / **COMPLEMENTO** / PEDIDO #XXX / CLIENTE / itens / VALOR DO COMPLEMENTO / DATA-HORA.
- **Relatório de fechamento**: SHEKINAH / FECHAMENTO DO DIA / Data-Horário / Pedidos / Total vendido / Dinheiro / Pix / Cartão / Caixa inicial / Esperado / Contado / Diferença / Resumo de estoque / Status.

**Componente de pré-visualização**: `components/print/print-preview-modal.tsx` (modal monoespaçado — "como seria impresso"), com botão `PrintPreviewButton`.

**Decisões e limitações (documentadas):**
- **Método de conexão NÃO definido** (pode ser Bluetooth, USB-C/OTG, Wi-Fi/rede). Não assumir modelo.
- **Web Bluetooth/WebUSB NÃO existem no Safari/iOS** — se os celulares forem iPhones, só rede ou preview servirão.
- Programa web em celular **não acessa impressora diretamente** em todos os casos — a solução final será validada após o modelo da impressora.
- **Não foi inventada solução de impressão não validada**: transportes bluetooth/webusb/network são stubs que lançam erro documentado; `preview` é o default funcional.
- Configuração (futura) fica em `settings.printer` (`transport`, `width`, `networkUrl`, `bluetoothService`).

## 12. Problemas conhecidos

1. **Recursão RLS em is_john/is_cozinha (resolvido)**: ao testar RLS com `SET ROLE authenticated`, as funções `is_john`/`is_cozinha` causavam `stack depth limit exceeded` (recursão infinita), pois liam `public.profiles`, que aplica política RLS que chama `is_john`.
   - Causa: helpers eram `SECURITY INVOKER` → recursão com a política de `profiles`.
   - Solução: tornar os helpers `SECURITY DEFINER` com `set search_path=''` e referências qualificadas (quebra a recursão, sem escalar privilégio — consultam apenas o próprio papel).
   - Status: **resolvido** — correção aplicada no banco e nas migrations 0002/0005; RLS revalidado.
2. **`business_days.day` é UNIQUE (RESOLVIDO)**: não era possível abrir um segundo dia na mesma data. Tornou-se o **problema de produção de 12/08/2026** (não se conseguia iniciar novo dia após o fechamento). **Correção aplicada (migration `0020`, 12/08/2026)**: removido `UNIQUE(day)`; `business_days_one_open_idx` garante no máximo 1 dia aberto. Verificado no banco real (índice removido, dados intactos).**
3. **Papel por prefixo de e-mail**: acoplamento simples; se John quiser papel manual, criar RPC de gestão de usuário.
4. **Teste de anti-corrida concorrente não executado**: o teste real de duas conexões simultâneas da última unidade não pôde ser rodado. A mecânica (locks `FOR UPDATE`) está implementada e o bloqueio de estoque insuficiente foi validado; o teste concorrente fica como pendência.
5. **Login falha para usuários criados via SQL direto**: usuários inseridos fora do painel (INSERT em `auth.users`) geram "Database error querying schema" no GoTrue. Causa: faltam identity/metadados no formato exato do GoTrue. Solução: criar usuários **sempre pelo painel/Admin API**. Os usuários de teste criados via SQL foram removidos.
6. **Origem dos usuários**: usuários reais `atendimento@shekinah.com` (papel `john`) e `cozinha@shekinah.com` (papel `cozinha`). Papel ajustado via SQL para o atendimento.

## 13. Testes

**Executados em 11/08/2026** contra o projeto Supabase real (projeto `jztxzmjdxzniatlgmxtk`), via `supabase db push` + `supabase db query --linked`:

| # | Cenário | Resultado |
|---|---|---|
| 1 | Abertura do dia (caixa inicial R$ 200 + estoque inicial 20/50) | ✅ OK |
| 2 | Segunda abertura no mesmo dia | ✅ Bloqueada (`DIA_JA_ABERTO`) |
| 3 | Pedido #1 (2x Tambaqui + 1x Coca = R$ 248) com baixa de estoque | ✅ OK (estoque 20→18, 50→49) |
| 4 | Venda acima do estoque (999) | ✅ Bloqueada (`ESTOQUE_INSUFICIENTE`), nada gravado |
| 5 | Pagamento dividido (dinheiro 100/troco 20 + pix 100 + cartão 48) | ✅ OK, `paid=true` |
| 6 | Pagamento excedente | ✅ Bloqueado (`PAGAMENTO_EXCEDE_TOTAL`) |
| 7 | Cozinha: novo→em_preparo→pronto | ✅ OK |
| 8 | Cozinha marca `entregue` | ✅ Bloqueado (`PERMISSAO_NEGADA`) |
| 9 | `get_closeout` (esperado R$ 280, totais/estoque corretos) | ✅ OK |
| 10 | Fechamento do dia (diferença R$ 0,00) | ✅ OK |
| 11 | Novo pedido após fechamento | ✅ Bloqueado (`DIA_NAO_ABERTO`) |
| 12 | Cancelar pedido pago | ✅ Bloqueado (`PEDIDO_JA_PAGO`) |
| 13 | RLS: cozinha vê `orders`, NÃO vê `payments`/`daily_stock`/histórico | ✅ OK |

Schema validado: 9 tabelas, 4 enums, 13 check constraints, 13 FKs, RLS em todas as tabelas, index parcial único de dia aberto. Usuários de teste john@/cozinha@ criados com trigger de perfil funcionando.

**Testes de AUTENTICAÇÃO** (Next.js + Supabase Auth), executados em 11/08/2026:

| # | Cenário | Resultado |
|---|---|---|
| 1 | Login `atendimento@shekinah.com` (papel john) | ✅ OK |
| 2 | Login `cozinha@shekinah.com` (papel cozinha) | ✅ OK |
| 3 | Logout (sessão encerrada) | ✅ OK |
| 4 | Proteção de rotas: sem sessão, `/` e `/cozinha` → `/login` | ✅ OK (307 + redirectedFrom) |
| 5 | Guarda por perfil (middleware): john → `/`, cozinha → `/cozinha` | ✅ OK |
| 6 | RLS: john vê `payments`/`daily_stock`; cozinha NÃO vê (0 rows), mas vê `orders` | ✅ OK |
| 7 | Build `next build` compila sem erros (rotas /, /cozinha, /login) | ✅ OK |
| 8 | Limpeza de dados/usuários de teste (só os 2 do painel permanecem) | ✅ OK |

**Testes de COMPLEMENTOS** (migration 0011), executados em 11/08/2026:

| # | Cenário | Resultado |
|---|---|---|
| 1 | Pedido em `em_preparo` recebe complemento (1 Frango + 1 Guaraná) | ✅ OK — total 256 → 309; estoque baixado; complemento registrado |
| 2 | Itens originais (`complement_id=NULL`) vs complemento (`complement_id` preenchido) | ✅ OK — distinção correta |
| 3 | Auditoria do complemento (created_by john, created_at) | ✅ OK |
| 4 | `get_complement_details` (comanda complementar: nº, cliente, itens, total) | ✅ OK — complement_total R$ 53,00 |
| 5 | Pagamento parcial (R$ 100) + complemento (+1 coca → 317) | ✅ OK — permitido (paid=false) |
| 6 | Complemento em pedido PAGO | ✅ Bloqueado (`PEDIDO_JA_PAGO`) |
| 7 | Atomicidade: complemento com estoque insuficiente (999 tambaquis) | ✅ Bloqueado (`ESTOQUE_INSUFICIENTE`), nada gravado (sem complemento órfão, sem baixa parcial) |
| 8 | RLS: cozinha vê `order_complements` (🔔) | ✅ OK (SELECT authenticated) |

O roteiro completo está em `supabase/tests.sql`. Pendência: teste de anti-corrida concorrente (ver Problemas).

**BATERIA COMPLETA DE TESTES** (12/08/2026) — 40 testes, todos ✅:

**Fluxo principal (Testes 1–20):** login John ✅ · iniciar dia ✅ · informar estoque (6 produtos) ✅ · informar caixa inicial (R$200) ✅ · criar pedido (#1, R$248) ✅ · estoque baixado (Tambaqui 10→8) ✅ · pedido aparece na cozinha ✅ · cozinha inicia preparo ✅ · cozinha marca pronto ✅ · John vê PRONTO ✅ · pagamento registrado (Pix, `paid=true`) ✅ · esgotado não pode ser vendido (`ESTOQUE_INSUFICIENTE`) ✅ · 2 vendas simultâneas da última unidade → só 1 passa ✅ · conferência de caixa (`get_closeout`) ✅ · diferença calculada (0) ✅ · confere estoque ✅ · encerra o dia ✅ · dia encerrado não recebe pedidos (`DIA_NAO_ABERTO`) ✅ · relatório gerado ✅ · histórico disponível ✅.

**Permissões (11 testes):** cozinha NÃO vê `payments`/`daily_stock`/`order_status_history`/`stock_movements` ✅ · NÃO chama `get_closeout`/`open_business_day`/`adjust_stock`/`create_order`/`add_payment` ✅ · VÊ `orders` (necessário) ✅ · John vê `payments` ✅.

**Robustez (5 testes):** sessão inválida não cria pedido ✅ · anon não acessa `get_closeout` ✅ · anon não vê orders (RLS) ✅ · falha não retorna orderId (nunca "pedido realizado") ✅ · retry com dia fechado não cria pedido (atômico) ✅.

**Mobile/responsividade:** páginas mobile-first (`max-w-md`), sem larguras fixas problemáticas, botões grandes, viewport cover, breakpoints `sm:`/`lg:` para listas (cozinha/pedidos). Build OK.

**Resultado: nenhum problema encontrado** — nenhuma correção necessária nos testes.

## 14. Histórico de desenvolvimento

### 11/08/2026
- Projeto iniciado.
- Diretório do projeto criado.
- `cloud.md` criado (Documento Central de Memória e Continuidade).
- Perfis de usuário definidos: John e Cozinha.
- Decisões de arquitetura registradas: web online, mobile-first, cliente sem acesso.
- **Arquitetura técnica detalhada definida** (agente Plan): stack Supabase + Next.js/Vercel, schema completo, RPCs, RLS, Realtime, impressão modular, telas, ordem de implementação.
- **Decisões com o usuário**: stack free (Supabase + Vercel), login email+senha, pagamento dividido em múltiplas formas.
- **Restrição financeira registrada**: custo mensal R$ 0,00; somente recursos free; qualquer recurso que possa gerar cobrança exige autorização explícita.
- **Camada de banco de dados implementada**: 9 migrations (enums, tabelas, RLS, triggers, RPCs, realtime), seed, config.toml, README e tests.sql.
- **Projeto Supabase criado pelo usuário** (`jztxzmjdxzniatlgmxtk`, plano free). Login e link via CLI concluídos.
- **Migrations EXECUTADAS** (`supabase db push`) no projeto real.
- **Correção de ordenação de migrations**: helpers `is_john`/`is_cozinha` movidos para antes das políticas RLS (0002); `business_days` movido para 0003 (antes de `daily_stock`); removida duplicação na 0004.
- **Bug de recursão RLS corrigido**: `is_john`/`is_cozinha` tornados `SECURITY DEFINER` com `search_path=''` (recursão com política de `profiles`).
- **Seed aplicado** (settings + produtos de exemplo).
- **Testes de integridade/RLS/RPCs executados** — 13 cenários OK (ver seção 13). Pendência: teste de anti-corrida concorrente.
- **NOVA REGRA (COMPLEMENTOS)**: pedido NÃO fica bloqueado após envio à cozinha. Decisão arquitetural registrada no `cloud.md` e no plano.
- **Migration 0011 aplicada e validada**: `order_complements` + `order_items.complement_id` (FK composta) + `created_at`; RPCs `add_items_to_order` e `get_complement_details`; RLS. Testes de complementos: 8 cenários OK (total recalculado, estoque, auditoria, comanda complementar, pagamento parcial, bloqueios, atomicidade, RLS).
- **AUTENTICAÇÃO implementada (Next.js + Supabase Auth)**: projeto Next.js criado na raiz (TS/Tailwind); clientes Supabase (browser/server/middleware); login mobile-first + logout; middleware de sessão com proteção de rotas e guarda por perfil; shell do app (home john + home cozinha). `.env.local` com URL + anon key (service_role nunca no frontend).
- **Usuários reais criados no painel**: `atendimento@shekinah.com` (papel `john`, ajustado via SQL) e `cozinha@shekinah.com` (papel `cozinha`). Usuários de teste via SQL (que falhavam login) e dados de teste (dias/pedidos/pagamentos) **removidos** — banco limpo para operação real.
- **Testes de autenticação executados** — 8 cenários OK (login john/cozinha, logout, proteção de rotas, guarda por perfil, RLS, build, limpeza). Bloqueio de login p/ usuários via SQL documentado.
- **ABERTURA DO DIA implementada**: tela `/abrir-dia` (estoque inicial com controles `[-] qty [+]` + caixa inicial + CONFIRMAR ABERTURA), server action `openDay` (chama RPC `open_business_day` transacional), dashboard do dia na home (caixa, estoque inicial, resumo) e regra "sem dia aberto → INICIAR DIA".
- **Testes de abertura executados** — 7 cenários OK: abrir dia (caixa R$200 + 6 produtos), 2ª abertura bloqueada (`DIA_JA_ABERTO`), persistência (dia + caixa + estoque), cozinha não abre (`PERMISSAO_NEGADA`), build OK. Dia ficou aberto no banco (estado real).
- **PRODUTOS E ESTOQUE implementados**: gerenciamento de produtos (CRUD com nome/categoria/preço/ativo-inativo, soft delete, somente john via RLS); estoque operacional com saldo do dia, estado ESGOTADO, ajuste delta (+/-) via RPC `adjust_stock` e histórico de movimentações.
- **Migration 0012 aplicada**: `stock_movements` (tabela de histórico com tipos inicial/venda/cancelamento/ajuste), trigger em `daily_stock` que registra variação de `sold_qty`, RPC `adjust_stock` (nunca negativo), e `open_business_day` atualizada (registra movimentação 'inicial').
- **Testes de produtos/estoque executados** — 10 cenários OK: ajuste +5, ajuste negativo bloqueado, zerar estoque (ESGOTADO), venda acima bloqueada, histórico (venda + ajuste), 'inicial' confirmado no código da RPC, criar produto (john), cozinha NÃO cria produto (RLS), cozinha NÃO ajusta (PERMISSAO_NEGADA), build OK.
- **ATENDIMENTO implementado (Novo Pedido)**: tela `/pedidos/novo` mobile-first — nome do cliente, produtos por categoria com "Disponível: N" e ESGOTADO, controles de quantidade, total em tempo real, resumo, forma de pagamento (dinheiro/pix/cartão com troco), botão FINALIZAR PEDIDO. Server action `createOrderAction` chama a RPC `create_order` (transacional: valida dia/estoque, baixa estoque, numera, cria itens, registra pagamento; se falhar nada é criado). Proteção contra duplicidade: botão desabilitado durante envio + erro limpo permite correção sem duplicar (RPC atômica).
- **Testes do atendimento (15 cenários OK, contra Supabase real)**: pedido #1 (2x Tambaqui + 1x Coca = R$248, Pix) → itens, pagamento, `paid=true`, baixa de estoque (10→8/20→19), numeração (next=2); pedido com estoque insuficiente bloqueado; **nada parcial criado** (transacional); pedido #2 pagamento dividido (R$50 dinheiro + R$70 cartão = R$120) → `paid=true`; proteção "sem dia aberto → DIA_NAO_ABERTO". Build OK. A tela redireciona para INICIAR DIA quando não há dia aberto.
- **ACOMPANHAMENTO DE PEDIDOS (John) implementado**: tela `/pedidos` mobile-first com grid por status 🔴 NOVOS / 🟡 EM PREPARO / 🟢 PRONTOS / ⚪ FINALIZADOS. Cada pedido mostra número, cliente, horário, itens com quantidades (🔔 nos complementos), total e status; pedidos prontos com destaque verde. Atualização **em tempo real via Supabase Realtime** (canal postgres_changes em `orders`, filtrado por dia).
- **Teste do Realtime executado**: canal SUBSCRIBED; criar pedido → evento `INSERT` recebido automaticamente; cozinha muda status (novo→em_preparo) → evento `UPDATE` recebido automaticamente. Confirmado: John recebe a atualização sem recarregar a página. Build OK.
- **COZINHA implementada (interface exclusiva)**: tela `/cozinha` simplificada — 3 colunas NOVOS / EM PREPARO / PRONTOS, cartões grandes (#N, CLIENTE, itens com quantidades, sem preço), botões **[COMEÇAR PREPARO]** / **[MARCAR COMO PRONTO]**, Realtime (pedido novo chega automaticamente com destaque vermelho + feedback sonoro discreto via AudioContext, sem depender de som), contador "a fazer" no header. Sem acesso a caixa/estoque/relatórios/preços.
- **CORREÇÃO DE SEGURANÇA (migration 0013)**: `get_closeout` e `apply_payment_internal` eram `SECURITY DEFINER` sem validar papel — a cozinha conseguia obter relatório financeiro. Adicionada checagem de john a ambas. Teste confirmado: cozinha agora é bloqueada (`PERMISSAO_NEGADA`).
- **Testes da cozinha executados**: pedido criado (novo), cozinha novo→em_preparo→pronto OK; cozinha NÃO entrega (PERMISSAO_NEGADA); RLS cozinha NÃO vê payments/daily_stock/history; `get_closeout` bloqueado após fix; cozinha vê orders. Build OK.
- **CAIXA implementado (módulo do John)**: tela `/caixa` — resumo financeiro (caixa inicial, vendas em dinheiro/pix/cartão, total vendido, **DINHEIRO ESPERADO = caixa inicial + vendas em dinheiro**); fila de pedidos a receber com pagamento (dinheiro/pix/cartão, dividido, troco) via RPC `add_payment`; **conferência** com campo "dinheiro contado" → diferença vs esperado → 🟢 CAIXA CONFERIDO (0) ou 🔴 DIFERENÇA. Sem integração com máquinas/Pix (só registra a forma).
- **Testes do caixa executados**: `get_closeout` (inicial=R$100, dinheiro=R$50, pix=R$248, cartão=R$70, vendido=R$744); dinheiro esperado=R$150 (100+50); pagamento dividido (R$60 dinheiro + R$60 pix = R$120 → paid=true); pagamento excedente bloqueado; conferência conceito (contado=esperado → dif. 0). Build OK.
- **FECHAMENTO DO DIA implementado**: tela `/fechamento` com conferência completa (vendas: nº pedidos/total/dinheiro/pix/cartão; caixa: inicial/vendas em dinheiro/esperado/contado/diferença 🟢/🔴; estoque: inicial/vendido/esperado/contado com diferença por produto e ajuste do físico); **resumo final** antes de confirmar. Ao confirmar, RPC `close_business_day` fecha/bloqueia/bloqueia novos pedidos/preserva histórico. Depois: **"DIA ENCERRADO"** + botão **"IMPRIMIR RELATÓRIO"**.
- **Testes do fechamento executados**: bloqueio com pedidos não pagos (`HA_PEDIDOS_NAO_PAGOS`); quitação dos pendentes; fechar dia (contado=esperado → diferença 0,00); status `fechado`; `closed_by`/`closed_at` gravados; **novos pedidos bloqueados** (`DIA_NAO_ABERTO`); **histórico de 5 pedidos preservado**. Dia 2026-08-11 ENCERRADO (inicial R$100, contado R$210, diferença R$0). Build OK.
- **IMPRESSÃO (arquitetura modular) implementada**: `lib/printing/` (types, text-builder, escpos, receipts, transports) + `components/print/print-preview-modal.tsx`. Montagem separada do transporte; transportes plugáveis (preview default; bluetooth/webusb/network como stubs documentados). Formatos: comanda, complemento e relatório de fechamento. **Método de conexão NÃO definido** — transportes reais aguardam o modelo da impressora (Web Bluetooth/WebUSB não existem no iOS).
- **Testes de impressão executados**: comanda (SHEKINAH/PEDIDO #125/CLIENTE/itens/TOTAL), complemento (COMPLEMENTO/PEDIDO/VALOR), relatório (FECHAMENTO/TOTAL VENDIDO/DIFERENÇA/STATUS) gerados corretamente; bytes ESC/POS produzidos (INIT/negrito); transportes resolvidos (preview default + bluetooth stub). Build OK.
- **HISTÓRICO E RELATÓRIOS implementados**: tela `/historico` (lista dias encerrados: data, nº pedidos, total vendido, status/caixa) e `/relatorio/[dayId]` (detalhes somente leitura: abertura, fechamento, responsável, vendas, formas de pagamento, caixa, estoque, diferenças; status). Botão **"IMPRIMIR RELATÓRIO"** usa a camada de impressão (pré-visualização térmica). Rota `/relatorio` (sem id) redireciona ao último dia.
- **Testes de histórico/relatório executados**: histórico lista o dia 2026-08-11 encerrado (5 pedidos · R$ 744); `get_closeout` detalhes (vendas R$744, esperado R$210, contado R$210, diferença R$0; pix 564, cartão 70, dinheiro 110); estoque e status no relatório. Build OK.
- **DASHBOARD PRINCIPAL DO JOHN implementado**: home `/` reescrita — **sem dia aberto** → card "🌅 INICIAR DIA"; **com dia aberto** → "🟢 DIA EM ANDAMENTO" com metric cards (Pedidos hoje, Vendas hoje, Em preparo, Prontos), **Estoque baixo** (saldo ≤ 3, com ESGOTADO), e ações (NOVO PEDIDO em destaque, Pedidos, Caixa, Estoque, Encerrar dia). Mobile-first, limpo e rápido.
- **Teste do dashboard executado**: sem dia aberto → INICIAR DIA (estado atual correto); lógica de métricas validada com dados reais (5 pedidos · R$744, em preparo 2, prontos 1, estoque baixo calculado). Build OK.
- **PWA / Android refinado**: `manifest.webmanifest` + ícones gerados via sharp (icon-192/512/maskable/apple-touch-icon) + `public/sw.js` (service worker manual, network-first, app-shell, reload on online) + registro via `components/sw-register.tsx` + **banner de conexão** (`connection-banner.tsx` — avisa sem internet, não inventa sucesso). Viewport ajustado (viewportFit cover), theme-color, apple-web-app. **Anti-duplicação verificada**: botão desabilita no envio; RPC atômica (falha não grava; retry não duplica); sucesso só após confirmação do servidor. NOTA: depende do Next 16+Turbopack, não se usou plugin Serwist (conflito); SW manual é compatível.
- **Teste PWA executado**: build OK; assets servidos publicamente (manifest 200, sw.js 200, ícones 200), middleware ajustado para expor assets PWA sem login.
- **AUDITORIA DE SEGURANÇA completa (12/08/2026)**: revisão de código + banco + testes de intrusão. Regras críticas validadas (estoque, dia, permissões, preço, duplicidade). Correções aplicadas (sem custo): migrations **0014** (RLS business_days/orders, troco só dinheiro, revoke helpers), **0015** (create_order refeito: loop único + search_path='' + order_id real), **0016/0017** (revoke de helpers com fix para manter RLS funcional). Achado principal a corrigir na configuração: **desativar signup público** no painel Supabase (recomendação documentada, ação de config).
- **BATERIA COMPLETA DE TESTES (12/08/2026)**: 40 testes todos ✅ (20 fluxo principal + 11 permissões + 5 robustez + mobile). Nenhum problema encontrado — sem correções necessárias. Ver seção 13.
- **REVISÃO TÉCNICA COMPLETA (12/08/2026)**: revisão como responsável técnico (código + fluxo + UX + mobile + impressão + banco). Fluxo do estabelecimento (abertura→...→encerrado) confirmado coberto pelas RPCs. Problemas encontrados e **corrigidos localmente (código)**:
  - **UI**: botão "Cancelar" de pedido não pago (orders-board) chamando `cancel_order` — antes não havia como cancelar e o fechamento podia travar; troco no novo pedido corrigido (valor recebido → troco calculado); botão REGISTRAR PAGAMENTO com `disabled`/pending no caixa; `method` reseta ao abrir pagamento; **destaque de pedido novo na cozinha** (NOVO! com pulso) — antes o highlight era código morto.
  - **Banco (migrations aplicadas)**: `0018` (pedido PRONTO + PAGO → ENTREGUE automático; RLS products: john vê inativos p/ reativar), `0019` (troco em dinheiro — valida pelo líquido `amount - change_given`, aceita excedente como troco).
  - **Impressão**: `DOUBLE_H_ON` corrigido para `GS ! n` (era comando errado `ESC d`).
- **VALIDAÇÃO DAS CORREÇÕES (banco real) CONCLUÍDA (12/08/2026)**: após autorização do usuário, o dia de teste foi removido e um dia novo aberto. **10/10 testes passaram**: dinheiro com TROCO (entrega R$200 → troco R$80, líquido = total, `paid=true`); **pronto + pago → ENTREGUE automático** + histórico `pronto→entregue`; `cancel_order` (status cancelado, estoque restaurado, cancelar pago bloqueado); RLS products **john vê inativos** (reativar). A revisão técnica está **concluída e validada**.
- **SIGNUP PÚBLICO DESATIVADO (12/08/2026)**: usuário desativou "Allow new users to sign up" no painel Supabase — brecha de segurança da auditoria fechada.
- **DEPLOY NO VERCEL REALIZADO (12/08/2026)**: usuário fez deploy via repositório GitHub. Sistema publicado em URL `*.vercel.app`. **Importante**: variáveis no Vercel — `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` e (desde 19/08/2026) `SUPABASE_SERVICE_ROLE_KEY` para gestão de usuários em `/usuarios`.

### 12/08/2026 (fim de tarde) — REQUISITO OFICIAL: IMPRESSÃO DA COMANDA FÍSICA

- **Requisito registrado (aguardando implementação)**: ao criar um pedido, além de salvar e enviar à cozinha (Realtime, já funciona), o sistema deve gerar a **comanda física** para impressora térmica **não fiscal**. A cozinha terá os **dois meios obrigatórios** (tela digital + comanda física). Ver seção 11.
- **Análise técnica concluída (12/08/2026)**: método mais adequado = **rede Wi-Fi (HTTP/TCP ESC/POS)**, 100% web e multiplataforma; alternativa Android-only = **Web Bluetooth**; USB-C/OTG via WebUSB é frágil (app nativo é mais robusto). Impressão **desacoplada** da criação do pedido (falha de impressão NÃO perde o pedido; opção de reimprimir). Modelo indicado: térmica não-fiscal 58/80mm compatível com ESC/POS, ideal com rede. **Aguardando autorização para implementar.**
- **IMPLEMENTAÇÃO CONCLUÍDA (12/08/2026)**: comanda integrada ao fluxo de novo pedido (seção 11). `lib/printing/print.ts` (serviço desacoplado), comanda reformatada ao requisito oficial, integração no `new-order-form` (modal de confirmação + reimpressão), `createOrderAction` retorna itens com preço, migration `0021` (printed_at/print_attempts) aplicada no banco real. **Transporte físico ainda por definir** (depende da impressora escolhida) — default `preview`. Build OK.
- **Mudanças de código relacionadas nesta data**: botões de voltar adicionados às telas secundárias (`components/back-button.tsx` + 10 telas), fix de UX no `mapOpenDayError` (abrir dia na mesma data), type-check e build OK. NÃO deployado — usuário fará deploy manual pelo terminal.

### 12/08/2026 (noite) — FUNCIONALIDADE: ADICIONAR ITENS A UM PEDIDO EXISTENTE + COMANDA COMPLEMENTAR

**Integrado à arquitetura existente (sem alteração de banco) — a lógica já existia na migration 0011 (RPC `add_items_to_order` + `order_complements`), faltava a integração de UI e impressão.**

- **Server action** `addItemsAction` (`lib/auth/orders.ts`): chama a RPC `add_items_to_order` (ADRIGA, não substitui; locks `FOR UPDATE` anti-corrida; recalcula `orders.total` somando todos os itens; baixa estoque; cria `order_complements` para auditoria quem/quando; NÃO cria pedido novo; mantém id/cliente/status). Bloqueia pago/cancelado/entregue/dia fechado no banco. Mapeia erros.
- **Impressão complementar** `printComplementReceipt` (`lib/printing/print.ts`): reutiliza `buildComplementReceipt` (comanda **COMPLEMENTO** com SOMENTE os novos itens) + refatoração de `sendToTransport` (mesmo mecanismo da comanda normal). Validado: gera `SHEKINAH / ** COMPLEMENTO ** / PEDIDO #N / CLIENTE / itens / VALOR / DATA-HORA`.
- **UI** (`app/\(app\)/pedidos/`): botão **"＋ Adicionar itens"** no card do pedido (estados adicionáveis — mesmo critério do banco) + modal `add-items-modal.tsx` (cliente, nº pedido, itens atuais + total, seleção de novos produtos por categoria com `-qty+`/disp/ESGOTADO, total adicional, **[Cancelar] [Adicionar ao pedido]**). Ao confirmar: chama a action → imprime a comanda complementar (não bloqueia) → atualiza o total no board (Realtime refresca itens).
- **`pedidos/page.tsx`**: passa `products` (ativos + disponibilidade do dia) ao board — mesmo padrão do novo pedido.
- **Validação**: build OK; RPC confirmada no banco real; chamada sem sessão → `PERMISSAO_NEGADA` (segurança OK). Preço validado no banco (`PRECO_INVALIDO`).
- **NÃO commitado/deployado ainda.**

### 12/08/2026 (fim de tarde) — LIMPEZA VISUAL (UI comercial)

- Removida exposição de rotas internas e detalhes técnicos ao usuário final (aparência de desenvolvimento): "Histórico e relatórios em /historico · SHEKINAH" → "Histórico e relatórios"; "Acesso restrito · SHEKINAH" → "Acesso restrito"; "Dia de operação · {id}" (UUID interno) removido; "Atualização automática · ..." no board de pedidos; "atômico no banco" no novo pedido; modal de impressão (removeu "depende do modelo... a definir"). Somente strings de apresentação — sem alteração de lógica/rotas/banco. Arquivos: `page.tsx`, `new-order-form.tsx`, `orders-board.tsx`, `print-preview-modal.tsx`.

### 12/08/2026 (tarde) — PROBLEMA DE PRODUÇÃO: NÃO CONSEGUE INICIAR UM NOVO DIA

**Investigação concluída — causa raiz identificada. Correção PREPARADA localmente, NÃO aplicada ainda.**

- **Problema**: após encerrar o dia e tentar iniciar um novo dia, o sistema exibe "Não foi possível iniciar o dia." mesmo preenchendo caixa inicial (0 ou >0) e estoque inicial.
- **Cenário que reproduziu** (produção `https://shekinah-five.vercel.app`): login `atendimento@checknap.com` (papel john) → fechamento normal do dia existente → tentativa de abrir novo dia → preenche estoque inicial → caixa inicial vazio/0/valor → sempre falha.
- **Onde acontece**:
  - Front: `app/(app)/abrir-dia/open-day-form.tsx` → server action `lib/auth/open-day.ts` (linha 60: `supabase.rpc("open_business_day", …)`; linhas 70-71 fallback `Não foi possível abrir o dia.`; linha 91 fallback genérico no `mapOpenDayError`).
  - Banco: RPC `public.open_business_day` (`supabase/migrations/0006_rpc_open_close_day.sql`, linhas 108-110) insere `business_days` com `day = (now() at time zone v_tz)::date`.
- **Causa raiz (dados reais)**:
  - Constraint **`business_days_day_key` = UNIQUE(day)** (criada em `0003` via `day date not null unique`).
  - No banco há **uma única linha**: `day=2026-08-11`, **status `fechado`** (fechado em `2026-08-12 00:56 UTC`).
  - A troca de dia no fuso do estabelecimento (`settings.tz = America/Manaus`, UTC−4) ocorre às **04:00 UTC**. Às `2026-08-12 01:31 UTC` ainda é **`2026-08-11` em Manaus**.
  - Logo, `open_business_day` abre com `day=2026-08-11`, que **já existe** (fechado). O INSERT viola o UNIQUE e aborta a transação. Como o erro de violação não é mapeado, cai no fallback genérico.
  - **Estoque/caixa NÃO são o problema**: o erro ocorre no INSERT do dia, antes de qualquer gravação de estoque. Caixa vazio→0 passou da validação do front (`initialCash=0`, não é NaN nem <0) e chega como `p_initial_cash=0` — inofensivo.
- **Erro real** (que a mensagem esconde):
  ```
  ERROR: duplicate key value violates unique constraint "business_days_day_key"
  DETAIL: Key (day)=(2026-08-11) already exists.
  ```
- **Tabelas/RPCs envolvidas**: `business_days` (constraint `business_days_day_key`, índice `business_days_one_open_idx`), RPC `open_business_day(numeric, jsonb)`, `settings.tz`.
- **Solução preparada (migration local `0020_allow_reopen_same_day.sql`)**: remover `business_days_day_key` (UNIQUE(day)). A regra de "no máximo 1 dia aberto por vez" continua garantida pelo índice parcial único `business_days_one_open_idx` (UNIQUE(1) WHERE status='aberto'). Dia fechado nunca é apagado; reabrir a mesma data cria novo registro com novo id (histórico/pedidos do anterior intactos).
- **STATUS: AGUARDANDO AUTORIZAÇÃO PARA APLICAR** (migration NÃO rodada no banco; NADA foi alterado em produção).

### 19/08/2026 — ABERTURA DO DIA: CADASTRO DE PRODUTO + REDESIGN VISUAL (LOGIN / HOME / MARCA)

**Cadastro de produto em /abrir-dia (funcional — sem alteração de banco):**
- **`open-day-add-product.tsx`**: formulário expansível "＋ Cadastrar novo produto" na tela de abrir dia — nome, categoria (seletor com categorias existentes ou nova), preço; `tracks_stock` sempre ativo.
- Reutiliza server action **`createProduct`** (`lib/auth/products.ts`); `revalidatePath("/abrir-dia")` após criar.
- **Ordem da tela**: Pratos → Bebidas → cadastrar produto → caixa inicial → confirmar.
- **Seletor de categoria**: dropdown customizado (substitui `datalist` — corrigia posicionamento errado no mobile); filtra ao digitar; opção "Nova categoria: …".
- Categorias padrão sempre disponíveis: **Pratos**, **Bebidas** (+ demais do catálogo).
- Build OK. **NÃO commitado/deployado ainda.**

**Redesign visual (100% visual — mesma autenticação e rotas):**
- **Login** (`app/(auth)/login/page.tsx`): layout moderno — hero com gradiente, card branco flutuante, campos com ícones, mostrar/ocultar senha, botão gradiente. Paleta **laranja** `#FF8A4F` (forte) + `#FFC176` (pêssego).
- **Marca compartilhada**: `components/brand-mark-icon.tsx` (sítio + cozinha + pedido) + `components/brand-wordmark.tsx` (ícone + SHEKINAH uppercase).
- **Header** (`session-header.tsx`): ícone e tipografia iguais ao login (variante escura).
- **Home sem dia aberto** (`page.tsx`): hero gradiente laranja + card flutuante + botão INICIAR DIA (padrão login); header já traz a marca.
- **Home com dia aberto**: card de status e botão NOVO PEDIDO com gradiente `primary-*`.
- **Layout app** (`layout.tsx`): fundo branco.

### 19/08/2026 (noite) — PALETA LARANJA COMO IDENTIDADE GLOBAL

- **`app/globals.css`**: tokens `primary-*` redefinidos — base `#FF8A4F` (500) e `#FFC176` (300); sombras/focus dos componentes `sk-*` atualizadas.
- **Login** passa a usar `primary-*` (sem hex hardcoded).
- **Telas com `blue-*` ou hex azul** migradas para `primary-*` (abrir-dia, caixa, estoque, fechamento, novo pedido, header, cozinha).
- **PWA**: `theme_color` / `themeColor` → `#FF8A4F`; `public/icon.svg` atualizado (PNG precisa regerar com `node scripts/generate-icons.mjs` se desejado).
- Build OK. **NÃO commitado/deployado ainda.**

### 19/08/2026 (noite, sessão 2) — DESIGN SYSTEM, USUÁRIOS, CORREÇÕES UX + REALTIME

**Identidade visual / layout (somente UI):**
- Design system `sk-*` em `globals.css` (`sk-app-shell`, `sk-app-main`, `sk-card`, `sk-btn-*`, `sk-input`, etc.) aplicado nas telas internas via `PageShell`.
- **Padding lateral** explícito em `sk-app-main` (corrigido: `composes` não funciona em CSS global Tailwind v4).
- Login: inputs com ícones (`sk-input-soft`), texto "Acesso restrito · usuários são criados pelo administrador" **removido**.
- Home: saudação dinâmica (`lib/greeting.ts`, fuso `America/Sao_Paulo`); `home-dashboard.tsx` com Realtime (métricas + estoque baixo).
- Grid **Ações** na home: Pedidos, Caixa, Estoque, **Usuários**.
- Rodapé fixo novo pedido: `sk-page-with-sticky-footer` (botão não cobre o total).
- Caixa: botões "Registrar pagamento" padronizados; encerrar dia com caixa esperado R$ 0 (só Pix) corrigido.

**Gestão de usuários (`/usuarios`):**
- `lib/supabase/admin.ts` + `lib/auth/users.ts` — criar usuário, alterar e-mail, trocar papel (cozinha/atendimento), redefinir senha.
- Requer `SUPABASE_SERVICE_ROLE_KEY` no `.env.local` (Secret key do Supabase, **sem** `NEXT_PUBLIC_`). Documentado em `.env.example`.
- Segurança: `"use server"`, `assertJohn()` antes de Admin API; signup público desativado no Supabase.

**Operação multi-atendente:** dia/estoque/caixa únicos compartilhados; locks anti-corrida no banco; cozinha e relatório consolidam todo o dia.

**Dados após fechamento:** tudo permanece no Postgres (histórico `/historico`, relatório `/relatorio/[dayId]`); impressão não apaga registros.

Build OK local. **NÃO commitado/deployado ainda.**

## 15. Estado atual

```
ESTADO ATUAL DO PROJETO:
Banco (PostgreSQL/Supabase) validado no projeto real (jztxzmjdxzniatlgmxtk): migrations 0001–0025+,
11+ tabelas, RLS, RPCs. AUDITORIA DE SEGURANÇA concluída. BATERIA COMPLETA DE TESTES (12/08/2026): 40 testes ✅.
Funcionalidades operacionais completas (abertura → fechamento). Impressão web (preview + comanda/complemento) OK;
transporte físico da impressora ainda por definir.

ALTERAÇÕES LOCAIS RECENTES (19/08/2026 sessão 2 — NÃO commitadas/deployadas):
- Design system `sk-*` + padding lateral + PageShell em todas as telas internas.
- Home com Realtime (`home-dashboard.tsx`), saudação dinâmica, grid Ações inclui Usuários.
- Gestão de usuários `/usuarios` (criar, e-mail, papel, senha) via Admin API server-side.
- `.env.example` atualizado com `SUPABASE_SERVICE_ROLE_KEY`.
- Correções UX: login, rodapé novo pedido, caixa (Pix-only), Realtime home/pedidos.
- Login: removido aviso "Acesso restrito · usuários criados pelo administrador".

ÚLTIMA ETAPA CONCLUÍDA:
Design system unificado + gestão de usuários no app + correções de UX/Realtime — build OK local.

PRÓXIMA ETAPA:
1) Configurar `SUPABASE_SERVICE_ROLE_KEY` no Vercel (Production) para gestão de usuários em produção.
2) Commit + deploy manual das alterações locais (usuário fará pelo terminal).
3) Regerar ícones PNG do PWA (`node scripts/generate-icons.mjs`) se quiser ícone laranja no celular.
4) Transporte físico REAL da impressora (rede/web-bluetooth/usb) — depende do modelo escolhido.
5) Operação real com múltiplos atendentes (validar fluxo completo).

PROBLEMAS PENDENTES:
- Alterações locais **NÃO commitadas/deployadas**.
- `SUPABASE_SERVICE_ROLE_KEY` obrigatória localmente e no Vercel para criar/redefinir usuários pelo app.
- Tela `/estoque` sem Realtime (recarregar para ver ajuste de outro atendente).
- Relatório não detalha vendas por atendente (dado `payments.created_by` existe no banco).
- Ícones PNG do PWA podem estar na cor azul antiga — regerar via `scripts/generate-icons.mjs`.
- Modelo/método da impressora INDEFINIDO (fluxo web OK; transporte real por definir — seção 11).
- PERFORMANCE: bundle client, loading/skeleton e índices pendentes.
- Erros TypeScript pré-existentes em alguns arquivos (`printer-config-form`, `transports.ts`) — não bloqueiam dev.
```

---

## 16. Auditoria de segurança (12/08/2026)

Auditoria completa realizada (revisão de código + banco + testes de intrusão contra o projeto real). Todas as regras críticas validadas no backend/banco.

### Regras críticas — VALIDADAS (testes de intrusão)

| Regra | Como foi garantida | Teste |
|---|---|---|
| Não vender acima do estoque / estoque negativo | `FOR UPDATE` + validação `initial_qty - sold_qty >= qty` em `create_order`/`add_items_to_order`; checks `>= 0` | ✅ `ESTOQUE_INSUFICIENTE` |
| Pedido sem dia aberto | `create_order` exige `status='aberto'` (`DIA_NAO_ABERTO`) | ✅ |
| Pedido após dia encerrado | `create_order`/`add_items_to_order`/`adjust_stock` verificam dia aberto | ✅ `DIA_NAO_ABERTO` |
| Cozinha acessar caixa/pagamentos | RLS `payments`/`daily_stock`/`order_status_history` só `is_john()`; RPCs financeiras exigem john | ✅ `PERMISSAO_NEGADA` |
| Cozinha alterar estoque | RPC `adjust_stock` exige john | ✅ `PERMISSAO_NEGADA` |
| Usuário não autorizado (anon) | RLS bloqueia anon; RPCs exigem `auth.uid()`/papel | ✅ 0 rows / negado |
| Manipular preço pelo frontend | Banco valida `unit_price` contra o catálogo (`PRECO_INVALIDO`); total recalculado no banco | ✅ |
| Pedido duplicado | `unique(business_day_id, number)` + `next_order_number` sob lock; RPC atômica | ✅ |

### Achados encontrados e CORRIGIDOS (migrations 0014–0017, sem custo)

1. **`business_days` RLS `using(true)` vazava colunas de caixa** (initial/counted/difference) para a cozinha → restringida: cozinha só vê dia `aberto` (0014). ✅
2. **`orders` RLS `using(true)` deixava a cozinha ler histórico de valores** de todos os dias → restrita a pedidos do dia aberto (0014). ✅
3. **TOCTOU de preço** em `create_order` (re-leitura do catálogo entre validar e inserir) → `create_order` refeito com loop único e `search_path=''` (0015). ✅
4. **`stock_movements.order_id` incorreto** (trigger inferia o "pedido mais recente") → trigger usa `order_id` real via `set_config` propagado pela RPC (0015). ✅
5. **`is_john`/`is_cozinha` executáveis por anon/public** (higiene) → revogado de anon/public (0016/0017); `authenticated` mantido (necessário às políticas RLS). ✅
6. **Troco aceito em Pix/cartão** → bloqueado (`TROCO_SOMENTE_DINHEIRO`) (0014). ✅
7. **`apply_payment_internal` exigia john** (já corrigido na 0013). ✅

## 17. Auditoria de Performance (12/08/2026)

**Auditoria realizada (somente leitura de código/banco + medições reais de produção). NENHUMA alteração feita. Nada implementado ainda — aguardando autorização.**

### Contexto

- Stack: Next.js 16.3 (App Router, Turbopack) no Vercel + Supabase (Postgres 17, região sa-east-1), RLS em todas as tabelas, gravações via RPC `SECURITY DEFINER`.
- Produção: `https://shekinah-five.vercel.app`.

### Métricas reais medidas (produção, curl)

| Medida | Valor | Observação |
|---|---|---|
| TTFB `/login` (1ª carga) | **1.41s** | cold start da function serverless do Vercel |
| TTFB `/login` (2ª/3ª) | **0.38–0.50s** | warm |
| TTFB `/` (sem sessão → redirect 307 login) | **0.47s** | inclui `getUser()` do middleware |
| Static asset (`manifest`) | **0.62s** | 1º acesso ao edge |
| Bundle client (chunks `.js` maiores) | **251KB + 229KB + 134KB + 112KB** | ~727KB raw; dominado por `@supabase/supabase-js` |

> Não foi possível medir com precisão o tempo de autenticação (login e-mail/senha) e o tempo até o dashboard sem uma sessão real/DevTools — **métrica não medida** (apenas estimada pela soma de latência de infra + chamadas redundantes).

### Problemas encontrados (por severidade)

#### 🔴 CRÍTICO — Chamadas de autenticação/perfil REDUNDANTES em toda rota autenticada
- Em cada request a rota autenticada, o Supabase é consultado **3 vezes** para a MESMA informação:
  1. **middleware.ts**: `supabase.auth.getUser()` + `SELECT profiles.role` (para guarda por perfil).
  2. **`(app)/layout.tsx`**: `getUser()` + `SELECT profiles`.
  3. **a própria página** (13 páginas): `getUser()` + `SELECT profiles`.
- **Total: 6+ chamadas ao Supabase por request** (2× `/auth/v1/user` + consultas a `profiles`), em sequência (não paralelas). Isso é a causa estrutural da "sensação de lentidão" ao navegar e após o login.
- **Onde**: `middleware.ts` (linhas 46–92), `app/(app)/layout.tsx` (14–27), e em cada `page.tsx` do app.

#### 🔴 ALTO — Bundle client inflado pelo Supabase client
- `@supabase/supabase-js` (718K) + `@supabase/ssr` (539K) são carregados no cliente pelos componentes `kitchen-board.tsx` e `orders-board.tsx` (`createClient()` client-side) e por `connection-banner`/`sw-register`.
- Chunks de até 251KB/229KB → **~727KB raw de JS** (~250KB gzipped) no navegador; aumenta o tempo até a interface interativa.
- **Onde**: `lib/supabase/client.ts` + componentes client que o usam.

#### 🟡 MÉDIO — Login: espera por perfil em sequência
- `login()` (server action) faz `signInWithPassword` → `getUser()` → `SELECT profiles` **em sequência**. O `getUser()` após o sign-in é redundante (o `signInWithPassword` já retorna a sessão); e o SELECT de perfil poderia ser evitado (o middleware já decide o redirect por perfil). Adiciona ~1 RTT ao login.

#### 🟡 MÉDIO — SELECT `profiles` por página (mesmo sem precisar do papel na página)
- Muitas páginas (ex.: `pedidos/novo`, `estoque`, `caixa`) fazem o `SELECT profiles.role` **apenas para checar permissão**, mas o **middleware já garantiu** john/cozinha. É um roundtrip extra por navegação.

#### 🟡 MÉDIO — Consultas sequenciais que poderiam ser paralelas
- `pedidos/page.tsx`: carrega `orders` e `order_items` em `Promise.all` (bom), mas o `getUser()`+`profiles`+`day` são sequenciais antes. Algumas páginas fazem `getUser()` → `profiles` → `day` → dados, tudo em sequência.
- `relatorio/[dayId]/page.tsx`: 2× `SELECT profiles` (abertura + responsável) — 1 pode ser reutilizado.

#### 🟢 BAIXO — `stock_movements` sem índice em `business_day_id`
- `estoque/page.tsx` consulta `stock_movements` por `business_day_id`; a tabela **só tem pkey** (sem índice na coluna de filtro) → full scan conforme cresce. (Recomendação de índice; NÃO criado.)

#### 🟢 BAIXO — `profiles` sem índice em `email`
- Usado pelo trigger `handle_new_user` e (potencialmente) por consultas; só tem pkey por id. Não crítico hoje (volume baixo).

#### 🟢 BAIXO — Sem `loading.tsx`/Suspense nas rotas dinâmicas
- As páginas server renderizam só após TODAS as consultas resolverem (padrão "espera tudo carregar"). Não há skeleton/loading → a interface "aparece de uma vez" após o fetch, ampliando a sensação de lentidão.

### O que está OK (não alterar)

- Índices de `orders` (business_day_id, status, number) e `daily_stock` (business_day_id, product_id) são adequados.
- Realtime só em `orders` (necessário para cozinha/pedidos); sem abusos.
- Server actions com RPC atômica (sem chamadas duplicadas na criação de pedido — o `createOrderAction` faz 1 RPC + 1 SELECT products para nomes).
- Sem API routes, sem `dangerouslySetInnerHTML`, RLS em todas as tabelas.

### Otimizações recomendadas (por impacto/risco — NÃO implementadas)

1. **✅ CRÍTICO — Eliminar chamadas redundantes de auth/perfil (IMPLEMENTADO em 12/08/2026)**:
   - **Solução aplicada**: `lib/supabase/server.ts` agora exporta `getUser` e `getRole` **memoizados via React `cache()`** (uma única chamada ao Supabase por request). O `(app)/layout.tsx` e todas as páginas usam `getRole()`/`getUser()` — eliminando o `getUser()` + `SELECT profiles` duplicado (antes: middleware + layout + cada página = ~6 chamadas; agora: 1 de cada, compartilhadas por request).
   - Login: `signInWithPassword` não é seguido de `getUser()` redundante; usa `getRole()` para o redirect por perfil.
   - O middleware permanece com sua guarda por perfil em borda (necessária e executada uma vez por request).
   - Build OK. **Segurança preservada** (RLS + RPCs continuam validando papel; o `getRole()` é a fonte única por request).
2. **ALTO — Reduzir o bundle client** (NÃO implementado):
   - Usar `createClient()` client-side **somente** nos componentes que precisam de Realtime (kitchen/orders boards). Os demais client components não precisam do supabase-js.
   - `dynamic import`/lazy dos boards (que são pesados) e/ou manter o supabase-js só onde necessário.
   - Impacto: JS inicial menor → interface interativa mais cedo.
3. **✅ MÉDIO — Login mais rápido (IMPLEMENTADO em 12/08/2026)**: `signInWithPassword` não é seguido de `getUser()` redundante (a resposta já traz o usuário); redirect por perfil via `getRole()`. −1 RTT no login.
4. **MÉDIO — Paralelizar consultas server** (NÃO implementado):
   - Agrupar `getUser` + `profiles` + `day` + dados em `Promise.all` onde hoje é sequencial (ex.: home).
   - Impacto: reduz tempo até a renderização.
5. **MÉDIO — Adicionar `loading.tsx`/Suspense** nas rotas que fazem múltiplas consultas (dashboard, pedidos, caixa) com skeleton leve → interface aparece antes. (NÃO implementado)
6. **BAIXO — Índices recomendados** (documentar apenas; aplicar com autorização):
   - `CREATE INDEX idx_stock_movements_day ON stock_movements(business_day_id);`
   - `CREATE INDEX idx_profiles_email ON profiles(email);` (se usado por auth/gestão)

### Próxima etapa

- **Otimizações 1 (CRÍTICO) e 3 (login) IMPLEMENTADAS em 12/08/2026** (build OK, NÃO commitado ainda).
- **Aguardando autorização para**: (2) reduzir bundle client → (4) paralelizar consultas → (5) loading/skeleton → (6) índices (com revisão).
- Alterações atuais não commitadas (aguardando revisão).

### Recomendações documentadas (NÃO implementadas — não geram custo, mas são boas práticas)

- **Desativar signup público no Supabase Auth** (Authentication → Sign In / Providers → Email: "Allow new users to sign up" = OFF). Os usuários são criados pelo painel. **Sem isso**, o trigger de papel por e-mail poderia permitir criar `john@qualquercoisa` e virar admin. **Ação de configuração, não de código.**
- Papel por prefixo de e-mail é frágil; alternativamente, definir papel por fluxo administrativo.
- `update_order_status` não verifica dia aberto (transições benignas) — opcional.
- `settings` RLS `using(true)` — revisar antes de adicionar chaves sensíveis.
- Teste de **anti-corrida concorrente real** (duas conexões simultâneas) ainda pendente.

### Verificações OK

- Sem API routes (menor superfície). Sem `dangerouslySetInnerHTML`/`eval` (XSS mitigado pelo React). Sem CSRF relevante (server actions + cookies httpOnly).
- `.env.local`: URL + anon key + `SUPABASE_SERVICE_ROLE_KEY` (secret, **só servidor**); `.gitignore` cobre `.env*`. No Vercel: mesmas variáveis (incluir service_role para `/usuarios` em produção).
- RLS em todas as tabelas; gravações de negócio só via RPC `SECURITY DEFINER` com validação de papel.
- Nenhuma correção exigiu recurso pago do Supabase (todas em SQL/config gratuitas).
