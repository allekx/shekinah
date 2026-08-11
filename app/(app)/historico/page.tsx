import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import HistoryList from "./history-list";

/** Histórico de dias encerrados (somente john). */
export default async function HistoricoPage() {
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

  // Dias encerrados + total vendido por dia
  const { data: days } = await supabase
    .from("business_days")
    .select(
      "id, day, status, opened_at, closed_at, initial_cash, counted_cash, cash_difference, opened_by"
    )
    .order("day", { ascending: false });

  // Para cada dia, conta pedidos e soma total (em paralelo)
  const enriched = await Promise.all(
    (days ?? []).map(async (d) => {
      const [countRes, sumRes] = await Promise.all([
        supabase
          .from("orders")
          .select("id", { count: "exact", head: true })
          .eq("business_day_id", d.id)
          .neq("status", "cancelado"),
        supabase
          .from("orders")
          .select("total")
          .eq("business_day_id", d.id)
          .neq("status", "cancelado"),
      ]);
      const total = (sumRes.data ?? []).reduce((s, o) => s + Number(o.total), 0);
      return {
        id: d.id,
        day: d.day,
        status: d.status,
        opened_at: d.opened_at,
        closed_at: d.closed_at,
        initial_cash: Number(d.initial_cash),
        orders_count: countRes.count ?? 0,
        total_sales: total,
        cash_difference: d.cash_difference,
      };
    })
  );

  return <HistoryList days={enriched} />;
}