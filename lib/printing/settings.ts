/** Configuração da impressora térmica (settings.printer no Supabase). */
export interface PrinterConfig {
  transport: "preview" | "network" | "bluetooth" | "webusb" | "console";
  width: number;
  networkUrl: string | null;
  bluetoothService: string | null;
}

export const DEFAULT_PRINTER_CONFIG: PrinterConfig = {
  transport: "preview",
  width: 42,
  networkUrl: null,
  bluetoothService: null,
};

export function parsePrinterConfig(raw: unknown): PrinterConfig {
  const v = (raw ?? {}) as Record<string, unknown>;
  const transport = String(v.transport ?? "preview");
  const allowed = ["preview", "network", "bluetooth", "webusb", "console"];
  return {
    transport: (allowed.includes(transport) ? transport : "preview") as PrinterConfig["transport"],
    width: Number(v.width ?? 42) || 42,
    networkUrl: v.networkUrl ? String(v.networkUrl).trim() : null,
    bluetoothService: v.bluetoothService ? String(v.bluetoothService).trim() : null,
  };
}

export function toPrintSettings(config: PrinterConfig) {
  return {
    transport: config.transport,
    width: config.width,
    networkUrl: config.networkUrl,
  };
}
