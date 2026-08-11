import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import KitchenBoard from "./kitchen-board";

/** Home da COZINHA — interface extremamente simples.
 *  Sem caixa, sem estoque, sem relatórios, sem preço.
 *  Somente: NOVOS / EM PREPARO / PRONTOS + Realtime.
 */
export default async function CozinhaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user!.id)
    .single();

  // Segurança: somente cozinha (o middleware redireciona john para /).
  if (!profile || profile.role !== "cozinha") {
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
      <div className="flex min-h-screen flex-col items-center justify-center bg-neutral-100 px-4">
        <p className="rounded-2xl bg-white p-6 text-center text-base text-neutral-500 shadow-sm">
          Aguarde John iniciar o dia para começar a receber pedidos.
        </p>
      </div>
    );
  }

  // Pedidos do dia + itens (sem preços para a cozinha — only nome qtd, e complemento)
  const [ordersRes, itemsRes] = await Promise.all([
    supabase
      .from("orders")
      .select("id, number, customer_name, status, created_at")
      .eq("business_day_id", day.id)
      .not("status", "in", `("cancelado","entregue")`)
      .order("number", { ascending: true }),
    supabase
      .from("order_items")
      .select("order_id, product_name, quantity, complement_id")
      .order("created_at", { ascending: true }),
  ]);

  const itemsByOrder: Record<string, { name: string; qty: number; complement: boolean }[]> = {};
  for (const it of itemsRes.data ?? []) {
    (itemsByOrder[it.order_id] ??= []).push({
      name: it.product_name,
      qty: it.quantity,
      complement: it.complement_id !== null,
    });
  }

  const orders = (ordersRes.data ?? []).map((o) => ({
    id: o.id,
    number: o.number,
    customer_name: o.customer_name,
    status: o.status,
    created_at: o.created_at,
    items: itemsByOrder[o.id] ?? [],
  }));

  return (
    <KitchenBoard
      dayId={day.id}
      dayLabel={day.day}
      orders={orders}
    />
  );
}