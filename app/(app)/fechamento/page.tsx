import { createClient, getRole } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

/** Redireciona para o relatório do último dia (rota legada após encerrar). */
export default async function FechamentoPage() {
  const supabase = await createClient();

  if ((await getRole()) !== "john") {
    redirect("/");
  }

  const { data: day } = await supabase
    .from("business_days")
    .select("id")
    .order("opened_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!day) {
    redirect("/relatorio");
  }

  redirect(`/relatorio/${day.id}`);
}