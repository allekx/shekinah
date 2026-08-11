# Supabase — Banco de Dados do Sistema Shekinah

Migrations e seed do PostgreSQL (Supabase). Toda a regra de negócio crítica (pedido, estoque, pagamento, fechamento) roda no banco via RPCs transacionais.

## Estrutura

```
supabase/
├─ migrations/       # SQL versionado (0001..0010)
├─ seed.sql          # configurações padrão + produtos de exemplo
└─ config.toml       # configuração do Supabase CLI (sem credenciais)
```

## Como aplicar as migrations

**Opção A — Supabase CLI (recomendado):**
```bash
# 1. suba o ambiente local (requer Docker)
supabase start

# 2. vincule ao projeto remoto do Supabase
supabase link --project-ref <SEU_REF>

# 3. envie as migrations
supabase db push
```

**Opção B — SQL Editor do painel do Supabase:**
Crie um projeto, abra "SQL Editor" e cole o conteúdo de cada arquivo em ordem (0001 → 0010), executando um por vez.

## Depois de aplicar

1. **Criar usuários** no painel → Authentication → Users:
   - `john@suacasa.com` → o trigger cria o papel **john** (e-mail começa com `john@`).
   - `cozinha@suacasa.com` → o trigger cria o papel **cozinha**.
2. **Ajustar produtos** na tela do sistema (Configurações → Produtos) ou via seed.
3. Testar o fluxo: abrir dia → lançar pedido → cozinha → pagamento → fechamento.

## Segurança

- RLS habilitada em todas as tabelas.
- Gravações de negócio apenas via RPCs `SECURITY DEFINER` (validação de papel e regras atômicas no banco).
- Nunca usar a `service_role` no frontend. Use apenas URL + anon key via variáveis de ambiente.
- Realtime publica somente a tabela `orders`.

## Custos

Somente recursos do plano free do Supabase. Qualquer recurso pago requer autorização explícita antes do uso (ver `cloud.md`).
