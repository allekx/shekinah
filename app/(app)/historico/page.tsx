import { createClient, getRole } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import HistoryList from "./history-list";

/** Histórico de dias encerrados (somente john). */
export default async function HistoricoPage() {
  const supabase = await createClient();

  if ((await getRole()) !== "john") {
    redirect("/");
  }

  const [{ data: days }, { data: orderRows }] = await Promise.all([
    supabase
      .from("business_days")
      .select(
        "id, day, status, opened_at, closed_at, initial_cash, counted_cash, cash_difference, opened_by"
      )
      .order("day", { ascending: false }),
    supabase
      .from("orders")
      .select("business_day_id, total")
      .neq("status", "cancelado"),
  ]);

  const statsByDay: Record<string, { count: number; total: number }> = {};
  for (const o of orderRows ?? []) {
    const id = o.business_day_id as string;
    if (!statsByDay[id]) statsByDay[id] = { count: 0, total: 0 };
    statsByDay[id].count += 1;
    statsByDay[id].total += Number(o.total);
  }

  const enriched = (days ?? []).map((d) => ({
    id: d.id,
    day: d.day,
    status: d.status,
    opened_at: d.opened_at,
    closed_at: d.closed_at,
    initial_cash: Number(d.initial_cash),
    orders_count: statsByDay[d.id]?.count ?? 0,
    total_sales: statsByDay[d.id]?.total ?? 0,
    cash_difference: d.cash_difference,
  }));

  return <HistoryList days={enriched} />;
}
