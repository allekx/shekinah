import type { PrinterTransport } from "./types";

/**
 * Transportes de impressão — método de conexão PLUGÁVEL.
 * O modelo/método final será definido após a escolha da impressora.
 * Nenhum transporte real é assumido; 'preview' é o default (pré-visualização).
 */

/** Transporte de PRÉ-VISUALIZAÇÃO (default). Não imprime fisicamente. */
export class PreviewTransport implements PrinterTransport {
  readonly id = "preview";
  readonly label = "Pré-visualização (tela)";
  readonly description =
    "Exibe o documento na tela. Usado até o modelo da impressora ser definido. Sem custo e sem dependência de Bluetooth/USB/rede.";

  async connect() {
    // nada a fazer — preview não conecta
  }
  async disconnect() {}
  async print(_data: Uint8Array) {
    // a pré-visualização é feita pelo componente (modal), não aqui
    throw new Error("PreviewTransport não imprime fisicamente; use a pré-visualização.");
  }
}

// ---------------------------------------------------------------------------
// Stubs documentados (implementação REAL deve ser validada com o modelo da
// impressora). Por ora apenas declarativos — NÃO inventar solução não testada.
// ---------------------------------------------------------------------------

/** Bluetooth (Web Bluetooth). Vale apenas no Chrome/Chromium Android.
 *  NÃO suportado em iOS (Safari). Requer impressora BLUETOOTH compatível. */
export class BluetoothTransport implements PrinterTransport {
  readonly id = "bluetooth";
  readonly label = "Bluetooth (Web Bluetooth)";
  readonly description =
    "Usa navigator.bluetooth (Chrome Android). NÃO funciona no Safari/iOS. Requer definir o serviço/characteristic após escolher o modelo.";

  async connect() {
    throw new Error("BluetoothTransport: não implementado até definir o modelo da impressora.");
  }
  async disconnect() {}
  async print(_data: Uint8Array) {
    throw new Error("BluetoothTransport: não implementado até definir o modelo da impressora.");
  }
}

/** USB-C/OTG (WebUSB). Vale apenas Chrome/Chromium Android. */
export class WebUsbTransport implements PrinterTransport {
  readonly id = "webusb";
  readonly label = "USB (WebUSB / OTG)";
  readonly description =
    "Usa navigator.usb (Chrome Android). Requer impressora com interface serial USB e definição de vendor/product filers.";

  async connect() {
    throw new Error("WebUsbTransport: não implementado até definir o modelo da impressora.");
  }
  async disconnect() {}
  async print(_data: Uint8Array) {
    throw new Error("WebUsbTransport: não implementado até definir o modelo da impressora.");
  }
}

/** Rede/Wi-Fi — envia bytes ESC/POS por HTTP POST para a URL configurada. */
export class NetworkTransport implements PrinterTransport {
  readonly id = "network";
  readonly label = "Rede Wi-Fi";
  readonly description =
    "Envia o cupom por HTTP POST (application/octet-stream) para a URL da impressora. Celular e impressora na mesma rede Wi-Fi.";

  constructor(private readonly url: string | null = null) {}

  async connect() {}
  async disconnect() {}

  async print(data: Uint8Array): Promise<void> {
    const url = this.url?.trim();
    if (!url) {
      throw new Error("Configure a URL da impressora em Impressora.");
    }

    const body = Uint8Array.from(data);

    const response = await fetch(url, {
      method: "POST",
      body,
      headers: { "Content-Type": "application/octet-stream" },
    });

    if (!response.ok) {
      throw new Error(`Impressora respondeu HTTP ${response.status}.`);
    }
  }
}

/** Console (debug). */
export class ConsoleTransport implements PrinterTransport {
  readonly id = "console";
  readonly label = "Console (debug)";
  readonly description = "Loga os bytes/hex no console. Apenas desenvolvimento.";

  async connect() {}
  async disconnect() {}
  async print(data: Uint8Array) {
    console.log("[print:console]", Array.from(data).map((b) => b.toString(16).padStart(2, "0")).join(" ").slice(0, 200));
  }
}

/** Registro dos transportes disponíveis. */
export const TRANSPORTS: PrinterTransport[] = [
  new PreviewTransport(),
  new BluetoothTransport(),
  new WebUsbTransport(),
  new NetworkTransport(),
  new ConsoleTransport(),
];

/** Resolve um transporte pelo id. */
export function getTransport(id: string, networkUrl?: string | null): PrinterTransport {
  if (id === "network") return new NetworkTransport(networkUrl);
  const found = TRANSPORTS.find((t) => t.id === id);
  return found ?? new PreviewTransport();
}