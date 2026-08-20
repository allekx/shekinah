/**
 * Camada de impressão — serviço de alto nível.
 *
 * DESACOPLADO da criação do pedido: a impressão roda DEPOIS de o pedido
 * ter sido salvo (a RPC create_order já retornou os dados). Uma falha de
 * impressão NÃO perde o pedido — apenas marca o problema e abre caminho
 * para REIMPRESSÃO.
 *
 * Fluxo:
 *   1) monta a comanda (buildOrderReceipt) a partir dos dados do pedido;
 *   2) devolve o documento ESC/POS e o texto para pré-visualização;
 *   3) o transporte escolhido envia os bytes OR mostra o preview.
 *
 * O transporte real (rede/web-bluetooth/usb) é plugável — ver transports.ts.
 * O default é 'preview' (mostra o modal, sem impressora).
 */
import { buildOrderReceipt, buildComplementReceipt, buildCloseoutReceipt } from "./receipts";
import { buildEscposDocument } from "./escpos";
import { getTransport } from "./transports";
import type { ReceiptPreview } from "./types";

export interface PrintOrderData {
  number: number;
  customer_name: string | null;
  created_at: string;
  items: { product_name: string; quantity: number; unit_price?: number; complementary?: boolean }[];
  total: number;
}

export interface PrintSettings {
  transport?: string;
  width?: number;
  networkUrl?: string | null;
  establishment?: { name?: string; address?: string };
}

export interface PrintResult {
  ok: boolean;
  /** Texto pré-formatado (para mostrar ao usuário caso falhe a impressão). */
  preview: ReceiptPreview;
  /** true quando bytes foram enviados à impressora física. */
  sentToPrinter?: boolean;
  /** Erro legível (quando ok=false). */
  error?: string;
}

/** Monta a comanda e imprime/envia pelo transporte configurado.
 *  Nunca lança — sempre devolve { ok, preview } (a chamada não bloqueia o pedido).
 */
export async function printOrderReceipt(
  order: PrintOrderData,
  settings: PrintSettings = {}
): Promise<PrintResult> {
  // 1) monta o documento (independente de transporte)
  const preview = buildOrderReceipt(
    {
      number: order.number,
      customer_name: order.customer_name,
      created_at: order.created_at,
      items: order.items,
      total: order.total,
    },
    { name: settings.establishment?.name ?? "SHEKINAH", address: settings.establishment?.address }
  );

  // 3) envia pelo transporte (helper compartilhado com a comanda complementar)
  return sendToTransport(preview, settings);
}

/** Dados da comanda COMPLEMENTAR (adição ao pedido existente). */
export interface PrintComplementData {
  orderNumber: number;
  customerName: string | null;
  createdAt: string;
  items: { product_name: string; quantity: number; unit_price?: number }[];
  total: number;
}

/** Imprime a COMANDA COMPLEMENTAR (somente os novos itens adicionados).
 *  Reutiliza o mesmo mecanismo da comanda normal (buildComplementReceipt +
 *  transporte). Nunca lança — sempre devolve { ok, preview }.
 */
export async function printComplementReceipt(
  complement: PrintComplementData,
  settings: PrintSettings = {}
): Promise<PrintResult> {
  const preview = buildComplementReceipt(
    {
      orderNumber: complement.orderNumber,
      customerName: complement.customerName,
      createdAt: complement.createdAt,
      items: complement.items,
      total: complement.total,
    },
    { name: settings.establishment?.name ?? "SHEKINAH", address: settings.establishment?.address }
  );

  return sendToTransport(preview, settings);
}

export interface PrintCloseoutData {
  day: string;
  opened_at: string;
  closed_at: string | null;
  opened_by: string | null;
  closed_by: string | null;
  orders_total: number;
  total_sales: number;
  payments: { dinheiro: number; pix: number; cartao: number };
  initial_cash: number;
  expected_cash: number;
  counted_cash: number | null;
  cash_difference: number | null;
  stock: {
    product_name: string;
    initial_qty: number;
    sold_qty: number;
    expected_remaining: number;
    final_counted_qty: number | null;
  }[];
  status: string;
}

/** Imprime o relatório de fechamento do dia. */
export async function printCloseoutReceipt(
  closeout: PrintCloseoutData,
  settings: PrintSettings = {}
): Promise<PrintResult> {
  const preview = buildCloseoutReceipt(closeout, {
    name: settings.establishment?.name ?? "SHEKINAH",
    address: settings.establishment?.address,
  });

  return sendToTransport(preview, settings);
}

/** Envia um documento ao transporte (preview mostra na tela; real envia bytes). */
async function sendToTransport(preview: ReceiptPreview, settings: PrintSettings): Promise<PrintResult> {
  const transport = getTransport(settings.transport ?? "preview", settings.networkUrl);

  // preview não imprime fisicamente: ok=true (pré-visualização na tela).
  if (transport.id === "preview") {
    return { ok: true, preview, sentToPrinter: false };
  }

  try {
    const lines = preview.text.split("\n").map((text) => ({ text }));
    const bytes = new Uint8Array(buildEscposDocument(lines));
    await transport.connect();
    try {
      await transport.print(bytes);
    } finally {
      await transport.disconnect();
    }
    return { ok: true, preview, sentToPrinter: true };
  } catch (err) {
    return {
      ok: false,
      preview,
      error: err instanceof Error ? err.message : "Falha de comunicação com a impressora.",
    };
  }
}