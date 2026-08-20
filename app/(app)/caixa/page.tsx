import { createClient, getRole } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import PageShell from "@/components/page-shell";
import CashierPanel from "./cashier-panel";

/** Módulo de CAIXA do dia aberto (somente john). */
export default async function CaixaPage() {
  const supabase = await createClient();

  if ((await getRole()) !== "john") {
    redirect("/");
  }

  const { data: day } = await supabase
    .from("business_days")
    .select("id, day, status, initial_cash")
    .eq("status", "aberto")
    .order("opened_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!day) {
    return (
      <PageShell title="Caixa">
        <p className="sk-empty">Nenhum dia aberto. Inicie o dia para operar o caixa.</p>
      </PageShell>
    );
  }

  // Resumo financeiro via get_closeout (dados do dia)
  const { data: closeout, error } = await supabase.rpc("get_closeout", {
    p_day_id: day.id,
  });

  // Pedidos não pagos (a receber) — para registrar pagamento
  const { data: pendingOrders } = await supabase
    .from("orders")
    .select("id, number, customer_name, status, total")
    .eq("business_day_id", day.id)
    .eq("paid", false)
    .neq("status", "cancelado")
    .order("number", { ascending: true });

  return (
    <CashierPanel
      dayId={day.id}
      day={day.day}
      closeout={closeout}
      closeoutError={error?.message}
      pendingOrders={pendingOrders ?? []}
    />
  );
}