import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import NewOrderForm from "./new-order-form";

/** Tela de ATENDIMENTO (novo pedido) — mobile-first.
 *  Carrega produtos ativos + disponibilidade do dia aberto.
 *  Sem dia aberto → redireciona para INICIAR DIA.
 */
export default async function NovoPedidoPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user!.id)
    .single();

  if (profile?.role !== "john") {
    redirect("/");
  }

  // Dia aberto (obrigatório)
  const { data: day } = await supabase
    .from("business_days")
    .select("id, day")
    .eq("status", "aberto")
    .order("opened_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!day) {
    redirect("/"); // home mostra "INICIAR DIA"
  }

  // Produtos ativos + estoque disponível (daily_stock do dia)
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
      .eq("business_day_id", day.id),
  ]);

  const stockMap: Record<number, number> = {};
  for (const s of stockRes.data ?? []) {
    stockMap[s.product_id] = s.initial_qty - s.sold_qty;
  }

  const products = (productsRes.data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    unit_price: Number(p.unit_price),
    category: p.category,
    tracks_stock: p.tracks_stock,
    available: p.tracks_stock ? stockMap[p.id] ?? 0 : null, // null = sem controle de estoque
  }));

  return <NewOrderForm dayId={day.id} products={products} />;
}