import { createClient, getRole } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import OpenDayForm from "./open-day-form";

/** Página de abertura do dia.
 *  Carrega o catálogo de produtos ativos e o dia atual.
 *  - Se já houver dia aberto, redireciona ao dashboard (não permite abrir 2º).
 *  - Caso contrário, renderiza o formulário (estoque inicial + caixa inicial).
 */
export default async function AbrirDiaPage() {
  const supabase = await createClient();

  if ((await getRole()) === "cozinha") {
    redirect("/cozinha");
  }

  // Se já há dia aberto, não permite abrir outro.
  const { data: existingDay } = await supabase
    .from("business_days")
    .select("id, day")
    .eq("status", "aberto")
    .limit(1)
    .maybeSingle();

  if (existingDay) {
    redirect("/");
  }

  // Produtos ativos para a grade de estoque inicial.
  const { data: products } = await supabase
    .from("products")
    .select("id, name, unit_price, category, tracks_stock, active")
    .eq("active", true)
    .order("category", { ascending: true })
    .order("name", { ascending: true });

  const tracked = (products ?? []).filter((p) => p.tracks_stock);

  return <OpenDayForm products={tracked} />;
}