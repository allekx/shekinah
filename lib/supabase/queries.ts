import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { CatalogProduct } from "@/lib/catalog";

/** Dia aberto atual — uma consulta por request (memoizado). */
export const getOpenBusinessDay = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("business_days")
    .select("id, day, status, initial_cash, opened_at")
    .eq("status", "aberto")
    .order("opened_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
});

/** Produtos ativos + disponibilidade do dia — memoizado por request e dayId. */
export const getCatalogWithStock = cache(async (dayId: string): Promise<CatalogProduct[]> => {
  const supabase = await createClient();
  const [productsRes, stockRes] = await Promise.all([
    supabase
      .from("products")
      .select("id, name, unit_price, category, tracks_stock, active")
      .eq("active", true)
      .order("category", { ascending: true })
      .order("name", { ascending: true }),
    supabase
      .from("daily_stock")
      .select("product_id, initial_qty, sold_qty")
      .eq("business_day_id", dayId),
  ]);

  const stockMap: Record<number, number> = {};
  for (const s of stockRes.data ?? []) {
    stockMap[s.product_id] = s.initial_qty - s.sold_qty;
  }

  return (productsRes.data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    unit_price: Number(p.unit_price),
    category: p.category,
    tracks_stock: p.tracks_stock,
    available: p.tracks_stock ? stockMap[p.id] ?? 0 : null,
  }));
});
