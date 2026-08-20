import { createClient, getRole } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import PageShell from "@/components/page-shell";
import StockPanel from "./stock-panel";

/** Estoque operacional do dia aberto (somente john).
 *  Mostra saldo por produto, estado ESGOTADO, ajuste (+/-) e histórico.
 */
export default async function EstoquePage() {
  const supabase = await createClient();

  if ((await getRole()) !== "john") {
    redirect("/");
  }

  // Dia aberto
  const { data: day } = await supabase
    .from("business_days")
    .select("id, day")
    .eq("status", "aberto")
    .order("opened_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!day) {
    return (
      <PageShell title="Estoque">
        <p className="sk-empty">Nenhum dia aberto. Inicie o dia para controlar o estoque.</p>
      </PageShell>
    );
  }

  // Estoques + produtos + movimentações do dia
  const [stockRes, movesRes] = await Promise.all([
    supabase
      .from("daily_stock")
      .select(
        "product_id, initial_qty, sold_qty, final_counted_qty, products(id, name, unit_price, category)"
      )
      .eq("business_day_id", day.id)
      .order("product_id"),
    supabase
      .from("stock_movements")
      .select(
        "type, quantity, created_at, order_id, products(name)"
      )
      .eq("business_day_id", day.id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const stock = (stockRes.data ?? []).map((s) => {
    const product = Array.isArray(s.products)
      ? s.products[0]
      : (s.products as { name: string } | null);
    return {
      product_id: s.product_id,
      name: product?.name ?? "?",
      initial_qty: s.initial_qty,
      sold_qty: s.sold_qty,
      remaining: s.initial_qty - s.sold_qty,
      esgotado: s.initial_qty - s.sold_qty <= 0,
    };
  });

  const moves = (movesRes.data ?? []).map((m) => ({
    type: m.type,
    quantity: m.quantity,
    created_at: m.created_at,
    product_name: (Array.isArray(m.products)
      ? m.products[0]?.name
      : (m.products as { name: string } | null)?.name) ?? "?",
  }));

  return (
    <StockPanel dayId={day.id} stock={stock} movements={moves} />
  );
}