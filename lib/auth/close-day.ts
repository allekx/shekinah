"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { parseMoney } from "@/lib/money";

export interface CloseDayResult {
  error?: string;
  closed?: boolean;
}

/** Encerra o dia de operação via RPC close_business_day.
 *  A RPC valida john, trava o dia, exige pedidos pagos, grava o estoque
 *  contado e o dinheiro contado, calcula a diferença, fecha e bloqueia.
 *  Transacional: se falhar, nada é alterado.
 */
export async function closeDay(formData: FormData): Promise<CloseDayResult> {
  const supabase = await createClient();
  const dayId = String(formData.get("day_id") ?? "");
  const countedCash = parseMoney(String(formData.get("counted_cash") ?? ""));
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!dayId) return { error: "Dados inválidos." };
  if (Number.isNaN(countedCash) || countedCash < 0) {
    return { error: "Informe o dinheiro contado." };
  }

  // Estoque contado: pares product_id / counted_qty
  const productIds = formData.getAll("product_id").map(Number);
  const counted = formData.getAll("counted_qty").map((q) => Number(String(q)));
  const stockCounted: { product_id: number; counted_qty: number }[] = [];
  for (let i = 0; i < productIds.length; i++) {
    const qty = counted[i] ?? 0;
    if (productIds[i] > 0 && qty >= 0) {
      stockCounted.push({ product_id: productIds[i], counted_qty: qty });
    }
  }

  const { data, error } = await supabase.rpc("close_business_day", {
    p_day_id: dayId,
    p_counted_cash: countedCash,
    p_stock_counted: stockCounted,
    p_notes: notes,
  });

  if (error) {
    const msg = error.message;
    if (msg.includes("HA_PEDIDOS_NAO_PAGOS")) {
      return { error: "Existem pedidos não pagos. Quite-os antes de fechar o dia." };
    }
    if (msg.includes("DIA_JA_FECHADO")) return { error: "O dia já está fechado." };
    if (msg.includes("DIA_NAO_ENCONTRADO")) return { error: "Dia não encontrado." };
    if (msg.includes("PERMISSAO_NEGADA")) return { error: "Você não tem permissão." };
    return { error: "Não foi possível fechar o dia." };
  }

  revalidatePath("/", "layout");
  revalidatePath("/caixa");
  revalidatePath("/relatorio", "layout");
  redirect(`/relatorio/${dayId}`);
}