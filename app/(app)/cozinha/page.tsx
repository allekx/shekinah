import { getRole } from "@/lib/supabase/server";
import { getOpenBusinessDay } from "@/lib/supabase/queries";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import KitchenBoard from "./kitchen-board";
import {
  kitchenItemsForDisplay,
  isComplementReopen,
  type KitchenComplementRow,
  type KitchenItemRow,
} from "@/lib/kitchen-display";

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
    .not("status", "in", '("cancelado","entregue")')
    .order("number", { ascending: true });

  const orderIds = (ordersRaw ?? []).map((o) => o.id);

  const { data: complementsRaw } =
    orderIds.length > 0
      ? await supabase
          .from("order_complements")
          .select("id, order_id, kitchen_status")
          .in("order_id", orderIds)
      : { data: [] };

  const complementsByOrder: Record<string, KitchenComplementRow[]> = {};
  for (const c of complementsRaw ?? []) {
    (complementsByOrder[c.order_id] ??= []).push({
      id: c.id,
      kitchen_status: c.kitchen_status,
    });
  }

  const orders = (ordersRaw ?? []).map((o) => {
    const rawItems = (o.order_items ?? []) as KitchenItemRow[];
    const complements = complementsByOrder[o.id] ?? [];
    return {
      id: o.id,
      number: o.number,
      customer_name: o.customer_name,
      status: o.status,
      created_at: o.created_at,
      complement_reopen: isComplementReopen(o.status, complements),
      items: kitchenItemsForDisplay(o.status, rawItems, complements),
    };
  });

  return <KitchenBoard dayId={day.id} dayLabel={day.day} orders={orders} />;
}
