import { getRole } from "@/lib/supabase/server";
import { getOpenBusinessDay } from "@/lib/supabase/queries";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import KitchenBoard from "./kitchen-board";

/** Home da COZINHA — interface extremamente simples. */
export default async function CozinhaPage() {
  if ((await getRole()) !== "cozinha") {
    redirect("/");
  }

  const day = await getOpenBusinessDay();

  if (!day) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
        <p className="sk-empty max-w-sm">Aguarde John iniciar o dia para começar a receber pedidos.</p>
      </div>
    );
  }

  const supabase = await createClient();

  const { data: ordersRaw } = await supabase
    .from("orders")
    .select(
      "id, number, customer_name, status, created_at, order_items(product_name, quantity, complement_id)"
    )
    .eq("business_day_id", day.id)
    .not("status", "in", `("cancelado","entregue")`)
    .order("number", { ascending: true });

  const orders = (ordersRaw ?? []).map((o) => {
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
      created_at: o.created_at,
      items: items.map((it) => ({
        name: it.product_name,
        qty: it.quantity,
        complement: it.complement_id !== null,
      })),
    };
  });

  return <KitchenBoard dayId={day.id} dayLabel={day.day} orders={orders} />;
}
