import { getPrinterSettings } from "@/lib/auth/printer-settings";
import { getRole } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import PrinterConfigForm from "./printer-config-form";

export default async function ImpressoraPage() {
  if ((await getRole()) !== "john") {
    redirect("/");
  }

  const config = await getPrinterSettings();
  return <PrinterConfigForm config={config} />;
}
