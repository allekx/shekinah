import { getRole } from "@/lib/supabase/server";
import { getOpenBusinessDay, getCatalogWithStock } from "@/lib/supabase/queries";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import PageShell from "@/components/page-shell";
import OrdersBoard from "./orders-board";

/** Acompanhamento de PEDIDOS do dia aberto (somente john). */
export default async function PedidosPage() {
  if ((await getRole()) !== "john") {
    redirect("/");
  }

  const day = await getOpenBusinessDay();

  if (!day) {
    return (
      <PageShell title="Pedidos">
        <p className="sk-empty">Nenhum dia aberto. Inicie o dia para acompanhar pedidos.</p>
      </PageShell>
    );
  }

  const supabase = await createClient();

  const [ordersRes, products] = await Promise.all([
    supabase
      .from("orders")
      .select(
        "id, number, customer_name, status, total, paid, created_at, updated_at, order_items(product_name, quantity, complement_id)"
      )
      .eq("business_day_id", day.id)
      .order("number", { ascending: true }),
    getCatalogWithStock(day.id),
  ]);

  const orders = (ordersRes.data ?? []).map((o) => {
    const items = (o.order_items ?? []) as {
      product_name: string;
      quantity: number;
      complement_id: number | null;
    }[];
    return {
      id: o.id,
      number: o.number,
      customer_name: o.customer_name,
      status: o.status,
      total: Number(o.total),
      paid: o.paid,
      created_at: o.created_at,
      updated_at: o.updated_at,
      items: items.map((it) => ({
        product_name: it.product_name,
        quantity: it.quantity,
        complementary: it.complement_id !== null,
      })),
    };
  });

  return <OrdersBoard dayId={day.id} orders={orders} products={products} />;
}
