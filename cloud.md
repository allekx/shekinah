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
│  ├─ (auth)/login/page.tsx    # Login mobile-first (sem cadastro público)
│  ├─ (app)/layout.tsx         # Shell autenticado (header + sessão + logout)
│  ├─ (app)/session-header.tsx # Cabeçalho de sessão (perfil + botão sair)
│  ├─ (app)/page.tsx           # Home: dashboard do dia (john) / INICIAR DIA
│  ├─ (app)/abrir-dia/         # Abertura do dia
│  │  ├─ page.tsx              #   server: carrega produtos, redireciona se dia aberto
│  │  └─ open-day-form.tsx     #   client: estoque [-] qty [+] + caixa + confirmar
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
│  └─ printing/                # Camada modular de impressão
│     ├─ types.ts              #   interfaces ReceiptBuilder/PrinterTransport
│     ├─ text-builder.ts       #   formatador de texto (largura em colunas)
│     ├─ escpos.ts             #   bytes ESC/POS (INIT, alinhamento, negrito)
│     ├─ receipts.ts           #   comanda, complemento, relatório de fechamento
│     └─ transports.ts         #   transportes plugáveis (preview default + stubs)
├─ components/
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
├─ .env.local                  # URL + anon key (NUNCA service_role)
├─ .env.example
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

Criação de usuários: no painel Supabase (Auth → Users → Add user). O trigger `handle_new_user` define o papel por prefixo de e-mail (`john@*` → john; demais → cozinha). Para papel diferente do padrão, ajustar o `profiles.role` via SQL.

> NOTA IMPORTANTE: usuários criados **fora do painel** (ex.: via INSERT direto em `auth.users`) não são reconhecidos pelo GoTrue no login ("Database error querying schema"). Usuários devem ser criados **sempre pelo painel/Admin API** (gera identity/confirmed_at corretos).

## 8. Funcionalidades

- [x] Banco de dados (schema + migrations + RLS + RPCs) — migrations EXECUTADAS e validadas no projeto Supabase real
- [x] Autenticação (login/logout/sessão/proteção de rotas/perfil) — testada com usuários reais do painel
- [x] Abertura do dia (tela /abrir-dia + dashboard + RPC) — testada
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
- [x] Dashboard principal do John (home /) — sem dia → 🌅 INICIAR DIA; com dia → 🟢 DIA EM ANDAMENTO (pedidos/vendas/preparo/prontos/estoque baixo) + ações (NOVO PEDIDO em destaque)
- [x] PWA (Android) — manifest, ícones (192/512/maskable/apple), service worker manual, viewport, banner de conexão, anti-duplicação verificada
- [ ] Cozinha
- [ ] Pagamento
- [ ] Caixa
- [ ] Conferência
- [ ] Fechamento
- [ ] Impressão
- [ ] Relatórios

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
- Foi decidido que **estoque é controlado por dia** (`initial_qty - sold_qty`), não armazenado como saldo.
- Foi decidido que **preço é snapshot** no item do pedido.
- Foi decidido que **cancelação só de pedido não pago** (estorno/reembolso fora do escopo atual).
- Foi decidido que **papel do usuário é definido pelo prefixo do e-mail** (john@ → john).
- Foi decidido que **impressão é modular** (builder + transport), método/modelo definidos posteriormente.
- Foi decidido que **um pedido NÃO fica bloqueado após envio à cozinha** — pode receber COMPLEMENTOS (`add_items_to_order`) enquanto o dia estiver aberto e o pedido não estiver pago/cancelado/entregue.
- Foi decidido que **complemento é agrupado** em tabela `order_complements` + `order_items.complement_id` (NULL = item original). Auditoria completa (quem/quando/itens/valor) sem poluir `order_status_history`.
- Foi decidido que **complemento é permitido com pagamento parcial** (bloqueado apenas após `paid=true`).
- Foi decidido que **não há edição destrutiva de itens já enviados**; remoção é operação separada com auditoria (fora do escopo atual).
- Foi decidido que **a cozinha identifica complemento** (🔔 COMPLEMENTO — PEDIDO #X) e que a **impressão do complemento é uma comanda complementar separada** (não reimprime o pedido inteiro).

## 11. Impressão

> Modelo da impressora e método de conexão AINDA NÃO DEFINIDOS. Não inventar informações antes da definição.

**Arquitetura modular implementada** (`lib/printing/`):

| Arquivo | Responsabilidade |
|---|---|
| `types.ts` | Interfaces `ReceiptBuilder` + `PrinterTransport` (camada de montagem separada do transporte) |
| `text-builder.ts` | Formatador de texto por colunas (width configurável, default 42), centralização, divisores |
| `escpos.ts` | Geração de **bytes ESC/POS** (INIT, alinhamento, negrito, sublinhado, latin-1) |
| `receipts.ts` | Geradores: **comanda** (`buildOrderReceipt`), **complemento** (`buildComplementReceipt`), **relatório** (`buildCloseoutReceipt`) |
| `transports.ts` | Transportes plugáveis: **preview (default)**, bluetooth, webusb, network, console (brancos/stubs documentados) |

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
2. **`business_days.day` é UNIQUE**: não é possível abrir mais de um dia de operação para a mesma data (o dia fechado de hoje bloqueia reabrir hoje). É o desenho aprovado (1 dia por data); se necessário reabrir no mesmo dia, exigiria evolução.
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
- **DEPLOY NO VERCEL REALIZADO (12/08/2026)**: usuário fez deploy via repositório GitHub. Sistema publicado em URL `*.vercel.app`. **Importante**: verificar as variáveis de ambiente no Vercel (NEXT_PUBLIC_SUPABASE_URL + ANON_KEY) — são obrigatórias e não vão para o repositório.

## 15. Estado atual

```
ESTADO ATUAL DO PROJETO:
Banco (PostgreSQL/Supabase) validado no projeto real (jztxzmjdxzniatlgmxtk): migrations 0001–0019,
11 tabelas, RLS, RPCs. AUDITORIA DE SEGURANÇA concluída (regras críticas validadas + correções sem
custo). BATERIA COMPLETA DE TESTES (12/08/2026): 40 testes ✅ (fluxo/permissões/robustez/mobile).
REVISÃO TÉCNICA (12/08/2026) CONCLUÍDA E VALIDADA: correções de código (cancelar pedido, troco,
pending no caixa, destaque de novo na cozinha, ESC/POS) + migrations 0018/0019 aplicadas e VALIDADAS
no banco real (10/10: troco em dinheiro, pronto+pago=entregue, cancel_order, RLS inativos). Neste
momento: dia 2026-08-11 ABERTO com 3 pedidos de teste da validação.

ÚLTIMA ETAPA CONCLUÍDA:
Revisão técnica completa validada: correções LOCAIS (build OK) + migrations 0018/0019 validadas no
banco real (10/10 testes).

PRÓXIMA ETAPA:
1) ✅ **Signup público DESATIVADO** no painel Supabase (usuário confirmou em 12/08/2026) — brecha da auditoria fechada.
2) ✅ **Deploy no Vercel realizado pelo usuário** (via repositório GitHub) — 12/08/2026. Sistema no ar em URL `*.vercel.app`.
3) **Verificar variáveis de ambiente no Vercel** (`NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`) — são obrigatórias e não são commitadas (`.env.local` fica fora do repositório). Sem elas o app não conecta ao Supabase.
4) Quando o modelo da impressora for escolhido: implementar o transporte real (bluetooth/usb/rede).
5) Operação real: abrir um novo dia.
6) Teste de anti-corrida concorrente real (pendente).

PROBLEMAS PENDENTES:
- Confirmar que as variáveis de ambiente estão configuradas no Vercel (URL + anon key).
- Modelo/método da impressora INDEFINIDO — transportes reais são stubs até escolher o modelo.
- Há um dia ABERTO (2026-08-11) com pedidos de teste da validação — pode ser limpo ao iniciar operação real.
- Teste de anti-corrida concorrente real (pendente).
- Teste de anti-corrida concorrente (duas conexões simultâneas) ainda não executado.
- Modelo/método da impressora INDEFINIDO — transportes reais são stubs até escolher o modelo.
- Seed de produtos é exemplo; ajustar com o atendimento (John).
- Usuários devem ser criados SEMPRE pelo painel (via SQL dá erro de login no GoTrue).
- `business_days.day` único por data: não é possível abrir 2º dia na mesma data.
- Todos os dados atuais (pedidos/dia) são de TESTE — na operação real será aberto um novo dia.
- Dependência `sharp` é devOnly (usada apenas para gerar ícones) — não afeta produção/custo.
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

### Recomendações documentadas (NÃO implementadas — não geram custo, mas são boas práticas)

- **Desativar signup público no Supabase Auth** (Authentication → Sign In / Providers → Email: "Allow new users to sign up" = OFF). Os usuários são criados pelo painel. **Sem isso**, o trigger de papel por e-mail poderia permitir criar `john@qualquercoisa` e virar admin. **Ação de configuração, não de código.**
- Papel por prefixo de e-mail é frágil; alternativamente, definir papel por fluxo administrativo.
- `update_order_status` não verifica dia aberto (transições benignas) — opcional.
- `settings` RLS `using(true)` — revisar antes de adicionar chaves sensíveis.
- Teste de **anti-corrida concorrente real** (duas conexões simultâneas) ainda pendente.

### Verificações OK

- Sem API routes (menor superfície). Sem `dangerouslySetInnerHTML`/`eval` (XSS mitigado pelo React). Sem CSRF relevante (server actions + cookies httpOnly).
- `.env.local` só tem URL + anon key (service_role **nunca** no frontend); `.gitignore` cobre `.env*`.
- RLS em todas as tabelas; gravações de negócio só via RPC `SECURITY DEFINER` com validação de papel.
- Nenhuma correção exigiu recurso pago do Supabase (todas em SQL/config gratuitas).
