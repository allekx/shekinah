"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface CreateOrderResult {
  error?: string;
  orderId?: string;
  orderNumber?: number;
  /** Itens do pedido (snapshot) — usado para montar a comanda de impressão. */
  items?: { product_name: string; quantity: number; unit_price: number }[];
}

export interface OrderItemInput {
  product_id: number;
  quantity: number;
  unit_price: number;
}

export interface PaymentInput {
  method: "dinheiro" | "pix" | "cartao";
  amount: number;
  change_given?: number;
}

export interface CancelOrderResult {
  error?: string;
}

export interface AddItemsResult {
  error?: string;
  /** Pedido atualizado (para atualizar a UI e reimprimir). */
  orderId?: string;
  orderNumber?: number;
  total?: number;
  status?: string;
  /** Itens adicionados (snapshot, para a comanda complementar). */
  complementItems?: { product_name: string; quantity: number; unit_price: number }[];
}

/** Adiciona itens a um pedido EXISTENTE (complemento).
 *  Chama a RPC add_items_to_order (transacional): NÃO cria novo pedido, NÃO
 *  substitui itens, recalcula o total somando TODOS os itens (originais +
 *  complemento), baixa estoque, cria order_complements (auditoria quem/quando).
 *  Respeita regras do banco: dia aberto, não pago, não cancelado, não entregue.
 */
export async function addItemsAction(
  orderId: string,
  items: { product_id: number; quantity: number; unit_price: number }[]
): Promise<AddItemsResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada. Faça login novamente." };

  if (!orderId || !items.length) return { error: "Dados inválidos." };

  const { data, error } = await supabase.rpc("add_items_to_order", {
    p_order_id: orderId,
    p_items: items,
  });

  if (error) {
    return { error: mapAddItemsError(error.message) };
  }

  // Nomes dos produtos adicionados (para a comanda complementar / Realtime).
  const namesById: Record<number, string> = {};
  const { data: catalog } = await supabase
    .from("products")
    .select("id, name")
    .in("id", items.map((it) => it.product_id));
  for (const p of catalog ?? []) namesById[p.id] = p.name;

  revalidatePath("/caixa");
  revalidatePath("/estoque");
  revalidatePath("/pedidos");
  revalidatePath("/cozinha");

  return {
    orderId: data?.id as string | undefined,
    orderNumber: data?.number as number | undefined,
    total: data?.total != null ? Number(data.total) : undefined,
    status: data?.status as string | undefined,
    complementItems: items.map((it) => ({
      product_name: namesById[it.product_id] ?? "?",
      quantity: it.quantity,
      unit_price: it.unit_price,
    })),
  };
}

function mapAddItemsError(message: string): string {
  if (message.includes("PERMISSAO_NEGADA")) return "Você não tem permissão para adicionar itens.";
  if (message.includes("PEDIDO_JA_PAGO")) return "Este pedido já está pago — não pode receber itens.";
  if (message.includes("PEDIDO_CANCELADO")) return "Este pedido foi cancelado — não pode receber itens.";
  if (message.includes("PEDIDO_ENTREGUE")) return "Este pedido já foi entregue — não pode receber itens.";
  if (message.includes("DIA_NAO_ABERTO")) return "Não há dia aberto para adicionar itens.";
  if (message.includes("ESTOQUE_INSUFICIENTE")) return "Estoque insuficiente para um dos produtos.";
  if (message.includes("PRODUTO_INATIVO")) return "Um dos produtos está inativo.";
  if (message.includes("PRODUTO_SEM_ESTOQUE_INICIAL")) return "Produto sem estoque inicial no dia.";
  if (message.includes("QUANTIDADE_INVALIDA")) return "Quantidade inválida.";
  if (message.includes("PRECO_INVALIDO")) return "Preço inválido.";
  if (message.includes("COMPLEMENTO_SEM_ITENS")) return "Selecione itens para adicionar.";
  if (message.includes("PEDIDO_NAO_ENCONTRADO")) return "Pedido não encontrado.";
  return "Não foi possível adicionar os itens. Tente novamente.";
}

/** Cancela um pedido NÃO PAGO (restaura estoque) via RPC cancel_order.
 *  Somente john; pedido pago não pode ser cancelado (banco bloqueia).
 */
export async function cancelOrderAction(formData: FormData): Promise<CancelOrderResult> {
  const supabase = await createClient();
  const orderId = String(formData.get("order_id") ?? "");
  if (!orderId) return { error: "Dados inválidos." };

  const { error } = await supabase.rpc("cancel_order", {
    p_order_id: orderId,
  });

  if (error) {
    const msg = error.message;
    if (msg.includes("PEDIDO_JA_PAGO")) return { error: "Pedido já pago — não pode ser cancelado." };
    if (msg.includes("PEDIDO_JA_CANCELADO")) return { error: "Pedido já cancelado." };
    if (msg.includes("PERMISSAO_NEGADA")) return { error: "Você não tem permissão." };
    return { error: "Não foi possível cancelar o pedido." };
  }

  revalidatePath("/caixa");
  revalidatePath("/estoque");

  return {};
}

/**
 * Cria um pedido via RPC create_order (transacional no banco).
 *  - valida dia aberto, estoque, produto ativo -> erros por exceção (nada parcial);
 *  - baixa estoque, numera o pedido, registra itens e pagamento na mesma transação;
 *  - o banco já bloqueia venda acima do estoque (ESTOQUE_INSUFICIENTE).
 *
 * Proteção contra duplicidade: o frontend gera um `submission_id` único por tentativa;
 * este valor é armazenado como nome do cliente temporário? Não — usamos apenas como
 * artefato de UI (desabilitar botão) já que create_order é atômico: se a chamada falhar,
 * nada é criado; se tiver sucesso, redireciona. O retry após falha não duplica porque a
 * transação reverteu tudo.
 */
export async function createOrderAction(
  formData: FormData
): Promise<CreateOrderResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada. Faça login novamente." };

  // Cliente
  const customerName = String(formData.get("customer_name") ?? "").trim();

  // Itens: pares product_id / quantity / unit_price
  const productIds = formData.getAll("product_id").map(Number);
  const quantities = formData.getAll("quantity").map((q) => Number(String(q)));
  const prices = formData.getAll("unit_price").map((p) => Number(String(p)));

  // Nomes dos produtos vêm do formulário (evita consulta extra ao catálogo).
  const productNames = formData.getAll("product_name").map(String);
  const namesById: Record<number, string> = {};
  for (let i = 0; i < productIds.length; i++) {
    if (productIds[i] > 0 && productNames[i]) {
      namesById[productIds[i]] = productNames[i];
    }
  }

  const items: OrderItemInput[] = [];
  for (let i = 0; i < productIds.length; i++) {
    const qty = quantities[i] ?? 0;
    if (qty > 0) {
      items.push({
        product_id: productIds[i],
        quantity: qty,
        unit_price: prices[i],
      });
    }
  }

  // Busca nomes faltantes no catálogo (fallback se o form não enviou).
  const idsInItems = items.map((it) => it.product_id);
  if (idsInItems.some((id) => !namesById[id])) {
    const { data: catalog } = await supabase
      .from("products")
      .select("id, name")
      .in("id", idsInItems);
    for (const p of catalog ?? []) namesById[p.id] = p.name;
  }

  if (items.length === 0) {
    return { error: "Selecione ao menos um produto com quantidade." };
  }

  // Pagamento
  const methodRaw = String(formData.get("payment_method") ?? "");
  const amountRaw = String(formData.get("payment_amount") ?? "")
    .replace("R$", "")
    .replace(/\./g, "")
    .replace(",", ".");
  const changeRaw = String(formData.get("change_given") ?? "0")
    .replace("R$", "")
    .replace(/\./g, "")
    .replace(",", ".");

  const payment: PaymentInput[] = [];
  if (methodRaw) {
    const amount = Number(amountRaw);
    if (Number.isNaN(amount) || amount <= 0) {
      return { error: "Informe o valor recebido." };
    }
    payment.push({
      method: methodRaw as PaymentInput["method"],
      amount,
      change_given: Number(changeRaw) || 0,
    });
  }

  // Chamada RPC transacional
  const { data, error } = await supabase.rpc("create_order", {
    p_customer_name: customerName || null,
    p_items: items,
    p_payment: payment.length ? payment : null,
  });

  if (error) {
    return { error: mapCreateOrderError(error.message) };
  }

  revalidatePath("/caixa");

  // Retorna o pedido criado para o frontend redirecionar/confirmar,
  // incluindo os itens (com nome) para montar a comanda de impressão.
  return {
    orderId: data?.id as string | undefined,
    orderNumber: data?.number as number | undefined,
    items: data?.id
      ? items.map((it) => ({
          product_name: namesById[it.product_id] ?? "?",
          quantity: it.quantity,
          unit_price: it.unit_price,
        }))
      : undefined,
  };
}

function mapCreateOrderError(message: string): string {
  if (message.includes("DIA_NAO_ABERTO")) return "Não há dia aberto. Inicie o dia antes.";
  if (message.includes("ESTOQUE_INSUFICIENTE")) return "Estoque insuficiente para um dos produtos.";
  if (message.includes("PRODUTO_SEM_ESTOQUE_INICIAL")) return "Produto sem estoque inicial no dia.";
  if (message.includes("PRODUTO_INATIVO")) return "Um dos produtos está inativo.";
  if (message.includes("PEDIDO_SEM_ITENS")) return "Selecione itens para o pedido.";
  if (message.includes("QUANTIDADE_INVALIDA")) return "Quantidade inválida.";
  if (message.includes("PAGAMENTO_EXCEDE_TOTAL")) return "Pagamento maior que o total.";
  if (message.includes("PERMISSAO_NEGADA")) return "Você não tem permissão para criar pedidos.";
  return "Não foi possível criar o pedido. Tente novamente.";
}