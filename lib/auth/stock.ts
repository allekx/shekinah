"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface StockActionError {
  error?: string;
}

/** Ajusta o estoque do produto no dia aberto (delta +/-). Somente john. */
export async function adjustStockAction(formData: FormData): Promise<StockActionError> {
  const supabase = await createClient();
  const dayId = String(formData.get("day_id") ?? "");
  const productId = Number(formData.get("product_id"));
  const delta = Number(formData.get("delta"));

  if (!dayId || !productId) return { error: "Dados inválidos." };
  if (Number.isNaN(delta) || delta === 0) return { error: "Informe um valor de ajuste." };

  const { error } = await supabase.rpc("adjust_stock", {
    p_business_day_id: dayId,
    p_product_id: productId,
    p_delta: delta,
  });

  if (error) {
    const msg = error.message;
    if (msg.includes("ESTOQUE_INSUFICIENTE"))
      return { error: "Ajuste não permitido: estoque ficaria negativo." };
    if (msg.includes("DIA_NAO_ABERTO"))
      return { error: "Nenhum dia aberto." };
    if (msg.includes("PERMISSAO_NEGADA"))
      return { error: "Você não tem permissão para ajustar estoque." };
    return { error: "Não foi possível ajustar o estoque." };
  }

  revalidatePath("/estoque", "layout");
  return {};
}