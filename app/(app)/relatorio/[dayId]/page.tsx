import { createClient, getRole } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import ReportView from "./report-view";

/** Relatório de um dia de operação (somente leitura).
 *  Usa get_closeout para os detalhes e a camada de impressão.
 */
export default async function RelatorioDiaPage({
  params,
}: {
  params: Promise<{ dayId: string }>;
}) {
  const { dayId } = await params;
  const supabase = await createClient();

  if ((await getRole()) !== "john") {
    redirect("/");
  }

  // Detalhes do dia
  const { data: day } = await supabase
    .from("business_days")
    .select("id, day, status, opened_at, closed_at, opened_by, initial_cash, counted_cash, cash_difference, notes")
    .eq("id", dayId)
    .maybeSingle();

  if (!day) {
    notFound();
  }

  const [openerRes, closeoutRes] = await Promise.all([
    supabase.from("profiles").select("email").eq("id", day.opened_by ?? "").maybeSingle(),
    supabase.rpc("get_closeout", { p_day_id: day.id }),
  ]);

  return (
    <ReportView
      day={day}
      openerEmail={openerRes.data?.email ?? null}
      closeout={closeoutRes.data}
      closeoutError={closeoutRes.error?.message}
    />
  );
}