"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parseMoney } from "@/lib/money";

export interface CashierActionResult {
  error?: string;
}

export interface PaymentLineInput {
  method: "dinheiro" | "pix" | "cartao";
  amount: number;
  change_given?: number;
}

async function registerPayment(
  orderId: string,
  method: string,
  amount: number,
  changeGiven: number
): Promise<CashierActionResult> {
  const supabase = await createClient();

  const { error } = await supabase.rpc("add_payment", {
    p_order_id: orderId,
    p_method: method,
    p_amount: amount,
    p_change_given: changeGiven,
  });

  if (error) {
    const msg = error.message;
    if (msg.includes("PERMISSAO_NEGADA")) return { error: "Você não tem permissão." };
    if (msg.includes("PAGAMENTO_EXCEDE_TOTAL")) return { error: "Valor maior que o total do pedido." };
    if (msg.includes("PEDIDO_CANCELADO")) return { error: "Pedido cancelado." };
    if (msg.includes("PEDIDO_NAO_ENCONTRADO")) return { error: "Pedido não encontrado." };
    if (msg.includes("TROCO_SOMENTE_DINHEIRO")) return { error: "Troco só em pagamento em dinheiro." };
    if (msg.includes("TROCO_INVALIDO")) return { error: "Troco inválido para este pagamento." };
    return { error: "Não foi possível registrar o pagamento." };
  }

  return {};
}

/** Registra um pagamento em um pedido via RPC add_payment. */
export async function addPaymentAction(formData: FormData): Promise<CashierActionResult> {
  const orderId = String(formData.get("order_id") ?? "");
  const method = String(formData.get("method") ?? "");
  const amount = parseMoney(String(formData.get("amount") ?? ""));
  const changeGiven = parseMoney(String(formData.get("change_given") ?? "0"));

  if (!orderId || !["dinheiro", "pix", "cartao"].includes(method)) {
    return { error: "Dados inválidos." };
  }
  if (Number.isNaN(amount) || amount <= 0) {
    return { error: "Informe um valor válido." };
  }
  if (changeGiven < 0) {
    return { error: "Troco inválido." };
  }

  const res = await registerPayment(orderId, method, amount, changeGiven);
  if (!res.error) {
    revalidatePath("/caixa", "layout");
    revalidatePath("/pedidos", "layout");
  }
  return res;
}

/** Registra vários pagamentos (ex.: parte Pix + parte dinheiro) até quitar o pedido. */
export async function addPaymentsAction(
  orderId: string,
  payments: PaymentLineInput[]
): Promise<CashierActionResult> {
  if (!orderId || payments.length === 0) {
    return { error: "Dados inválidos." };
  }

  for (const payment of payments) {
    if (!["dinheiro", "pix", "cartao"].includes(payment.method)) {
      return { error: "Forma de pagamento inválida." };
    }
    if (Number.isNaN(payment.amount) || payment.amount <= 0) {
      return { error: "Informe um valor válido em cada pagamento." };
    }
    const changeGiven = payment.change_given ?? 0;
    if (changeGiven < 0) {
      return { error: "Troco inválido." };
    }

    const res = await registerPayment(orderId, payment.method, payment.amount, changeGiven);
    if (res.error) return res;
  }

  revalidatePath("/caixa", "layout");
  revalidatePath("/pedidos", "layout");
  return {};
}