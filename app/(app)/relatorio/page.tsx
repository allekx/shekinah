import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

/** Rota /relatorio (sem id): redireciona ao último dia de operação. */
export default async function RelatorioPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: day } = await supabase
    .from("business_days")
    .select("id")
    .order("opened_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!day) {
    redirect("/historico");
  }

  redirect(`/relatorio/${day.id}`);
}