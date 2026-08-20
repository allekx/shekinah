import { createClient, getRole } from "@/lib/supabase/server";
import { getOpenBusinessDay } from "@/lib/supabase/queries";
import { redirect } from "next/navigation";
import PageShell from "@/components/page-shell";
import CashierPanel from "./cashier-panel";

/** Módulo de CAIXA do dia aberto (somente john). */
export default async function CaixaPage() {
  if ((await getRole()) !== "john") {
    redirect("/");
  }

  const day = await getOpenBusinessDay();

  if (!day) {
    return (
      <PageShell title="Caixa">
        <p className="sk-empty">Nenhum dia aberto. Inicie o dia para operar o caixa.</p>
      </PageShell>
    );
  }

  const supabase = await createClient();

  const [closeoutRes, pendingRes] = await Promise.all([
    supabase.rpc("get_closeout", { p_day_id: day.id }),
    supabase
      .from("orders")
      .select("id, number, customer_name, status, total")
      .eq("business_day_id", day.id)
      .eq("paid", false)
      .neq("status", "cancelado")
      .order("number", { ascending: true }),
  ]);

  return (
    <CashierPanel
      dayId={day.id}
      day={day.day}
      closeout={closeoutRes.data}
      closeoutError={closeoutRes.error?.message}
      pendingOrders={pendingRes.data ?? []}
    />
  );
}
