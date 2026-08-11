import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import OrdersBoard from "./orders-board";

/** Acompanhamento de PEDIDOS do dia aberto (somente john).
 *  Mostra os pedidos do dia em tempo real (Realtime em orders).
 */
export default async function PedidosPage() {
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
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-bold text-neutral-900">Pedidos</h1>
        <p className="rounded-2xl bg-white p-5 text-center text-sm text-neutral-500 shadow-sm">
          Nenhum dia aberto. Inicie o dia para acompanhar pedidos.
        </p>
      </div>
    );
  }

  // Pedidos do dia + itens
  const [ordersRes, itemsRes] = await Promise.all([
    supabase
      .from("orders")
      .select("id, number, customer_name, status, total, paid, created_at, updated_at")
      .eq("business_day_id", day.id)
      .order("number", { ascending: true }),
    supabase
      .from("order_items")
      .select("order_id, product_name, quantity, unit_price, subtotal, complement_id")
      .order("created_at", { ascending: true }),
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

  return <OrdersBoard dayId={day.id} orders={orders} />;
}