"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface CashierActionResult {
  error?: string;
}

/** Registra um pagamento em um pedido via RPC add_payment.
 *  A RPC valida john, valor, troco e excedente; pedido é quitado
 *  (paid=true) automaticamente quando a soma atinge o total.
 */
export async function addPaymentAction(formData: FormData): Promise<CashierActionResult> {
  const supabase = await createClient();
  const orderId = String(formData.get("order_id") ?? "");
  const method = String(formData.get("method") ?? "");
  const amountRaw = String(formData.get("amount") ?? "")
    .replace("R$", "")
    .replace(/\./g, "")
    .replace(",", ".");
  const changeRaw = String(formData.get("change_given") ?? "0")
    .replace("R$", "")
    .replace(/\./g, "")
    .replace(",", ".");

  const amount = Number(amountRaw);
  const changeGiven = Number(changeRaw) || 0;

  if (!orderId || !["dinheiro", "pix", "cartao"].includes(method)) {
    return { error: "Dados inválidos." };
  }
  if (Number.isNaN(amount) || amount <= 0) {
    return { error: "Informe um valor válido." };
  }
  if (changeGiven < 0) {
    return { error: "Troco inválido." };
  }

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
    return { error: "Não foi possível registrar o pagamento." };
  }

  revalidatePath("/caixa", "layout");
  revalidatePath("/pedidos", "layout");
  return {};
}