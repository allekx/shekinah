import { createClient } from "@/lib/supabase/server";
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

  // Detalhes do dia
  const { data: day } = await supabase
    .from("business_days")
    .select("id, day, status, opened_at, closed_at, opened_by, initial_cash, counted_cash, cash_difference, notes")
    .eq("id", dayId)
    .maybeSingle();

  if (!day) {
    notFound();
  }

  // Nome do responsável
  const { data: opener } = await supabase
    .from("profiles")
    .select("email")
    .eq("id", day.opened_by ?? "")
    .maybeSingle();

  // Resumo via get_closeout
  const { data: closeout, error } = await supabase.rpc("get_closeout", {
    p_day_id: day.id,
  });

  return (
    <ReportView
      day={day}
      openerEmail={opener?.email ?? null}
      closeout={closeout}
      closeoutError={error?.message}
    />
  );
}