import { TextBuilder } from "./text-builder";
import type { ReceiptPreview } from "./types";

/**
 * Geradores de documentos para impressão térmica.
 * Formatos definidos no requisito (comanda, complemento, relatório).
 */

export const DEFAULT_WIDTH = 42;

interface Establishment {
  name?: string;
  address?: string;
}

interface OrderItem {
  product_name: string;
  quantity: number;
  complementary?: boolean;
  /** Preço unitário — usado para mostrar o subtotal por item na comanda. */
  unit_price?: number;
}

interface OrderData {
  number: number;
  customer_name: string | null;
  created_at: string;
  items: OrderItem[];
  total: number;
}

/** Formata data/hora pt-BR para a comanda. */
function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR") + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

/** Apenas data DD/MM/YYYY. */
function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR");
}

/** Apenas hora HH:MM. */
function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

/** Monta uma linha com item à esquerda e valor à direita (colunas fixas). */
function itemRow(b: TextBuilder, width: number, left: string, right: string) {
  const r = right.toString();
  const leftMax = Math.max(1, width - r.length - 2);
  const lv = left.length > leftMax ? left.slice(0, leftMax - 1) + "…" : left;
  b.addLine({ text: ` ${lv}${" ".repeat(Math.max(1, width - lv.length - r.length))}${r}`, align: "left" });
}

function fmtBRL(v: number): string {
  return "R$ " + v.toFixed(2).replace(".", ",");
}

/** CABEÇALHO padrão (nome do estabelecimento centralizado). */
function header(est: Establishment, b: TextBuilder) {
  b.addLine({ text: est.name ?? "SHEKINAH", align: "center", bold: true, doubleHeight: true });
  if (est.address) b.addLine({ text: est.address, align: "center" });
  b.addDivider();
}

/** COMANDA do pedido (requisito oficial). */
export function buildOrderReceipt(order: OrderData, est: Establishment): ReceiptPreview {
  const b = new TextBuilder(DEFAULT_WIDTH);
  header(est, b);
  b.addLine("");
  b.addLine({ text: `Comanda #${String(order.number).padStart(3, "0")}`, align: "center", bold: true });
  b.addLine(`Cliente: ${order.customer_name ?? "—"}`);
  b.addDivider();
  for (const it of order.items) {
    // item à esquerda + subtotal à direita (formato do requisito oficial)
    const subtotal = fmtBRL((it.unit_price ?? 0) * it.quantity);
    itemRow(b, DEFAULT_WIDTH, `${it.quantity}x ${it.product_name}`, subtotal);
  }
  b.addDivider();
  // linha total em NEGRITO (duas colunas: rótulo à esquerda, valor à direita)
  const totalW = b.width;
  const totalRight = fmtBRL(order.total);
  b.addLine({
    text: `TOTAL${" ".repeat(Math.max(1, totalW - ("TOTAL").length - totalRight.length))}${totalRight}`,
    bold: true,
  });
  b.addBlank();
  b.addLine("Data: " + fmtDate(order.created_at));
  b.addLine(`Hora: ${fmtTime(order.created_at)}`);
  b.addBlank();
  b.addLine("");
  return { kind: "comanda", text: b.build(), width: b.width };
}

/** COMANDA COMPLEMENTAR (requisito: itens adicionados depois). */
export function buildComplementReceipt(
  complement: {
    orderNumber: number;
    customerName: string | null;
    createdAt: string;
    items: OrderItem[];
    total: number;
  },
  est: Establishment
): ReceiptPreview {
  const b = new TextBuilder(DEFAULT_WIDTH);
  header(est, b);
  b.addLine("");
  b.addLine({ text: "** COMPLEMENTO **", align: "center", bold: true });
  b.addLine({ text: `PEDIDO #${String(complement.orderNumber).padStart(3, "0")}`, align: "center", bold: true });
  b.addLine(`CLIENTE: ${complement.customerName ?? "—"}`);
  b.addDivider();
  for (const it of complement.items) {
    b.addLine(`${it.quantity}x ${it.product_name}`);
  }
  b.addDivider();
  b.addLine({ text: `VALOR DO COMPLEMENTO: ${fmtBRL(complement.total)}`, bold: true });
  b.addLine("DATA/HORA: " + fmtDateTime(complement.createdAt));
  b.addBlank();
  b.addLine("");
  return { kind: "complemento", text: b.build(), width: b.width };
}

interface CloseoutData {
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

/** RELATÓRIO DE FECHAMENTO (requisito). */
export function buildCloseoutReceipt(co: CloseoutData, est: Establishment): ReceiptPreview {
  const b = new TextBuilder(DEFAULT_WIDTH);
  header(est, b);
  b.addLine({ text: "FECHAMENTO DO DIA", align: "center", bold: true });
  b.addBlank();
  b.addLine(`DATA: ${co.day}`);
  b.addLine(`ABERTO: ${fmtDateTime(co.opened_at)}`);
  b.addLine(`FECHADO: ${co.closed_at ? fmtDateTime(co.closed_at) : "—"}`);
  b.addDivider();
  b.addLine("PEDIDOS");
  b.addLine(`  ${co.orders_total}`);
  b.addLine({ text: `TOTAL VENDIDO: ${fmtBRL(co.total_sales)}`, bold: true });
  b.addBlank();
  b.addLine("VENDAS POR FORMA");
  b.addLine(`  DINHEIRO: ${fmtBRL(co.payments.dinheiro)}`);
  b.addLine(`  PIX:      ${fmtBRL(co.payments.pix)}`);
  b.addLine(`  CARTAO:   ${fmtBRL(co.payments.cartao)}`);
  b.addDivider();
  b.addLine("CAIXA");
  b.addLine(`  INICIAL:      ${fmtBRL(co.initial_cash)}`);
  b.addLine(`  ESPERADO:     ${fmtBRL(co.expected_cash)}`);
  b.addLine(`  CONTADO:      ${fmtBRL(co.counted_cash ?? 0)}`);
  b.addLine({
    text: `  DIFERENCA:    ${fmtBRL(co.cash_difference ?? 0)}`,
    bold: true,
  });
  b.addDivider();
  b.addLine("RESUMO DE ESTOQUE");
  for (const s of co.stock) {
    b.addLine(`${s.product_name}`);
    b.addLine(
      `  inicial ${s.initial_qty} · vend ${s.sold_qty} · esp ${s.expected_remaining} · conf ${s.final_counted_qty ?? "-"}`
    );
  }
  if (co.stock.length === 0) b.addLine("  (sem produtos com estoque)");
  b.addDivider();
  b.addLine({ text: `STATUS: ${co.status.toUpperCase()}`, align: "center", bold: true });
  b.addBlank();
  b.addLine("");
  return { kind: "relatorio", text: b.build(), width: b.width };
}