"use server";

import { createClient } from "@/lib/supabase/server";

export interface KitchenActionResult {
  error?: string;
}

/** Altera o status de um pedido via RPC update_order_status.
 *  O banco valida a transição e o papel:
 *   - cozinha/john: novo -> em_preparo -> pronto
 *   - john: pronto -> entregue
 *  A cozinha não consegue entregar (só john marca entregue).
 */
export async function updateStatusAction(formData: FormData): Promise<KitchenActionResult> {
  const supabase = await createClient();
  const orderId = String(formData.get("order_id") ?? "");
  const toStatus = String(formData.get("to_status") ?? "");

  if (!orderId || !toStatus) return { error: "Dados inválidos." };

  const { error } = await supabase.rpc("update_order_status", {
    p_order_id: orderId,
    p_to_status: toStatus,
  });

  if (error) {
    const msg = error.message;
    if (msg.includes("PERMISSAO_NEGADA")) return { error: "Você não tem permissão para essa ação." };
    if (msg.includes("TRANSICAO_INVALIDA")) return { error: "Transição de status inválida." };
    if (msg.includes("PEDIDO_NAO_ENCONTRADO")) return { error: "Pedido não encontrado." };
    return { error: "Não foi possível atualizar o pedido." };
  }

  // Realtime + atualização otimista na UI — sem revalidar layout inteiro.
  return {};
}