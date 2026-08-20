"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  DEFAULT_PRINTER_CONFIG,
  parsePrinterConfig,
  type PrinterConfig,
} from "@/lib/printing/settings";

export interface PrinterSettingsResult {
  error?: string;
  saved?: boolean;
}

export async function getPrinterSettings(): Promise<PrinterConfig> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "printer")
    .maybeSingle();

  if (!data?.value) return DEFAULT_PRINTER_CONFIG;
  return parsePrinterConfig(data.value);
}

export async function updatePrinterSettings(
  _prev: PrinterSettingsResult,
  formData: FormData
): Promise<PrinterSettingsResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada." };

  const transport = String(formData.get("transport") ?? "preview");
  const width = Number(formData.get("width") ?? 42);
  const networkUrl = String(formData.get("network_url") ?? "").trim() || null;

  if (!["preview", "network"].includes(transport)) {
    return { error: "Modo de impressão inválido." };
  }
  if (Number.isNaN(width) || width < 32 || width > 48) {
    return { error: "Largura do papel inválida (32–48 colunas)." };
  }
  if (transport === "network" && !networkUrl) {
    return { error: "Informe a URL da impressora na rede." };
  }
  if (networkUrl && !/^https?:\/\/.+/i.test(networkUrl)) {
    return { error: "URL inválida. Use http://IP:porta/caminho" };
  }

  const value = {
    transport,
    width,
    networkUrl,
    bluetoothService: null,
  };

  const { error } = await supabase.from("settings").upsert(
    { key: "printer", value },
    { onConflict: "key" }
  );

  if (error) return { error: "Não foi possível salvar a configuração." };

  revalidatePath("/impressora");
  return { saved: true };
}
