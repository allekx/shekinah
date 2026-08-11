import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import CashierPanel from "./cashier-panel";

/** Módulo de CAIXA do dia aberto (somente john). */
export default async function CaixaPage() {
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

  const { data: day } = await supabase
    .from("business_days")
    .select("id, day, status, initial_cash")
    .eq("status", "aberto")
    .order("opened_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!day) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-bold text-neutral-900">Caixa</h1>
        <p className="rounded-2xl bg-white p-5 text-center text-sm text-neutral-500 shadow-sm">
          Nenhum dia aberto. Inicie o dia para operar o caixa.
        </p>
      </div>
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