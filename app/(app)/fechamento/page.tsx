import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import CloseoutPanel from "./closeout-panel";

/** Fechamento do dia: conferência completa antes de encerrar.
 *  Se ?encerrado=1, mostra "DIA ENCERRADO" + IMPRIMIR RELATÓRIO.
 */
export default async function FechamentoPage({
  searchParams,
}: {
  searchParams: Promise<{ encerrado?: string }>;
}) {
  const { encerrado } = await searchParams;
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

  // Último dia (aberto ou recém-fechado)
  const { data: day } = await supabase
    .from("business_days")
    .select("id, day, status, initial_cash, counted_cash, cash_difference, closed_at, closed_by")
    .order("opened_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!day) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-bold text-neutral-900">Fechamento</h1>
        <p className="rounded-2xl bg-white p-5 text-center text-sm text-neutral-500 shadow-sm">
          Nenhum dia de operação encontrado.
        </p>
      </div>
    );
  }

  // Detalhes do dia (apenas se fechado ou para conferência)
  const { data: closeout, error } = await supabase.rpc("get_closeout", {
    p_day_id: day.id,
  });

  return (
    <CloseoutPanel
      day={day}
      closeout={closeout}
      closeoutError={error?.message}
      encerrado={encerrado === "1"}
    />
  );
}