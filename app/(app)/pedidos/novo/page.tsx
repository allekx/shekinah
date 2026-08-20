import { createClient, getRole } from "@/lib/supabase/server";
import { getOpenBusinessDay, getCatalogWithStock } from "@/lib/supabase/queries";
import { getPrinterSettings } from "@/lib/auth/printer-settings";
import { redirect } from "next/navigation";
import NewOrderForm from "./new-order-form";

/** Tela de ATENDIMENTO (novo pedido) — mobile-first. */
export default async function NovoPedidoPage() {
  if ((await getRole()) !== "john") {
    redirect("/");
  }

  const day = await getOpenBusinessDay();

  if (!day) {
    redirect("/");
  }

  const [products, printerSettings] = await Promise.all([
    getCatalogWithStock(day.id),
    getPrinterSettings(),
  ]);

  return (
    <NewOrderForm dayId={day.id} products={products} printerSettings={printerSettings} />
  );
}
