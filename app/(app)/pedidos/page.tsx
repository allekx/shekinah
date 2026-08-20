import { createClient, getRole } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import PageShell from "@/components/page-shell";
import OrdersBoard from "./orders-board";

/** Acompanhamento de PEDIDOS do dia aberto (somente john).
 *  Mostra os pedidos do dia em tempo real (Realtime em orders).
 */
export default async function PedidosPage() {
  const supabase = await createClient();

  if ((await getRole()) !== "john") {
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
    return (
      <PageShell title="Pedidos">
        <p className="sk-empty">Nenhum dia aberto. Inicie o dia para acompanhar pedidos.</p>
      </PageShell>
    );
  }

  // Pedidos do dia + itens + produtos ativos (p/ complemento) + estoque
  const [ordersRes, itemsRes, productsRes, stockRes] = await Promise.all([
    supabase
      .from("orders")
      .select("id, number, customer_name, status, total, paid, created_at, updated_at")
      .eq("business_day_id", day.id)
      .order("number", { ascending: true }),
    supabase
      .from("order_items")
      .select("order_id, product_name, quantity, unit_price, subtotal, complement_id")
      .order("created_at", { ascending: true }),
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

  const itemsByOrder: Record<string, { product_name: string; quantity: number; complementary: boolean }[]> = {};
  for (const it of itemsRes.data ?? []) {
    (itemsByOrder[it.order_id] ??= []).push({
      product_name: it.product_name,
      quantity: it.quantity,
      complementary: it.complement_id !== null,
    });
  }

  const orders = (ordersRes.data ?? []).map((o) => ({
    id: o.id,
    number: o.number,
    customer_name: o.customer_name,
    status: o.status,
    total: Number(o.total),
    paid: o.paid,
    created_at: o.created_at,
    updated_at: o.updated_at,
    items: itemsByOrder[o.id] ?? [],
  }));

  // Disponibilidade de cada produto (para o modal de complemento)
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
    available: p.tracks_stock ? stockMap[p.id] ?? 0 : null, // null = sem controle
  }));

  return <OrdersBoard dayId={day.id} orders={orders} products={products} />;
}