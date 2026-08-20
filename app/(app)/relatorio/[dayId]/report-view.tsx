"use client";

import { useMemo } from "react";
import PageShell from "@/components/page-shell";
import PrintReceiptButton from "@/components/print/print-receipt-button";
import { getPrinterSettings } from "@/lib/auth/printer-settings";
import { printCloseoutReceipt } from "@/lib/printing/print";
import { toPrintSettings } from "@/lib/printing/settings";

interface Props {
  day: {
    id: string;
    day: string;
    status: string;
    opened_at: string;
    closed_at: string | null;
    opened_by: string | null;
    initial_cash: number;
    counted_cash: number | null;
    cash_difference: number | null;
  };
  openerEmail: string | null;
  closeout: Record<string, unknown> | null;
  closeoutError?: string;
}

const fmtBRL = (v: number | string) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v));

const fmtDT = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("pt-BR")
    : "—";

/** Relatório do dia (somente leitura) + impressão via camada modular. */
export default function ReportView({ day, openerEmail, closeout, closeoutError }: Props) {
  const pm = (closeout?.payments_by_method as Record<string, number> | undefined) ?? {};
  const stock = (closeout?.stock as
    | { product_name: string; initial_qty: number; sold_qty: number; expected_remaining: number; final_counted_qty: number | null }[]
    | undefined) ?? [];

  const closeoutPrintData = useMemo(() => {
    if (!closeout) return null;
    return {
      day: day.day,
      opened_at: day.opened_at,
      closed_at: day.closed_at,
      opened_by: day.opened_by,
      closed_by: day.opened_by,
      orders_total: Number(closeout.orders_total ?? 0),
      total_sales: Number(closeout.total_sales ?? 0),
      payments: {
        dinheiro: Number(pm.dinheiro ?? 0),
        pix: Number(pm.pix ?? 0),
        cartao: Number(pm.cartao ?? 0),
      },
      initial_cash: Number(closeout.initial_cash ?? 0),
      expected_cash: Number(closeout.expected_cash ?? 0),
      counted_cash: day.counted_cash,
      cash_difference: day.cash_difference,
      stock: stock.map((s) => ({
        product_name: s.product_name,
        initial_qty: s.initial_qty,
        sold_qty: s.sold_qty,
        expected_remaining: s.expected_remaining,
        final_counted_qty: s.final_counted_qty,
      })),
      status: day.status,
    };
  }, [closeout, day, pm, stock]);

  const diff = day.cash_difference;

  return (
    <PageShell
      title="Relatório do dia"
      subtitle={`${new Date(day.day + "T00:00:00").toLocaleDateString("pt-BR")} · somente leitura`}
    >
      {closeoutError && <p className="sk-alert-error">{closeoutError}</p>}

      <section className="sk-summary-dark">
        <p className="text-sm opacity-80">SHEKINAH</p>
        <p className="text-lg font-black">{day.day}</p>
        <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
          <div>
            <p className="text-xs opacity-70">Abertura</p>
            <p className="font-semibold">{fmtDT(day.opened_at)}</p>
          </div>
          <div>
            <p className="text-xs opacity-70">Fechamento</p>
            <p className="font-semibold">{fmtDT(day.closed_at)}</p>
          </div>
        </div>
        <p className="mt-2 text-xs opacity-70">Responsável: {openerEmail ?? "—"}</p>
      </section>

      {/* Vendas */}
      <section className="sk-card p-4">
        <h2 className="mb-2 sk-section-title">Vendas</h2>
        <Row label="Pedidos" value={String(closeout?.orders_total ?? 0)} />
        <Row label="Total vendido" value={fmtBRL(Number(closeout?.total_sales ?? 0))} strong />
        <Row label="Dinheiro" value={fmtBRL(Number(pm.dinheiro ?? 0))} />
        <Row label="Pix" value={fmtBRL(Number(pm.pix ?? 0))} />
        <Row label="Cartão" value={fmtBRL(Number(pm.cartao ?? 0))} />
      </section>

      {/* Caixa */}
      <section className="sk-card p-4">
        <h2 className="mb-2 sk-section-title">Caixa</h2>
        <Row label="Caixa inicial" value={fmtBRL(Number(closeout?.initial_cash ?? 0))} />
        <Row label="Dinheiro esperado" value={fmtBRL(Number(closeout?.expected_cash ?? 0))} />
        <Row label="Dinheiro contado" value={fmtBRL(day.counted_cash ?? 0)} />
        <Row label="Diferença" value={fmtBRL(diff ?? 0)} strong />
        <div
          className={`mt-2 rounded-xl px-4 py-2 ${
            diff !== null && Number(diff) === 0 ? "bg-green-50" : "bg-red-50"
          }`}
        >
          <p className={`text-sm font-bold ${diff !== null && Number(diff) === 0 ? "text-green-700" : "text-red-700"}`}>
            {diff !== null && Number(diff) === 0
              ? "🟢 CAIXA CONFERIDO"
              : `🔴 DIFERENÇA DE ${fmtBRL(Math.abs(Number(diff ?? 0)))}`}
          </p>
        </div>
      </section>

      {/* Estoque */}
      <section className="sk-card p-4">
        <h2 className="mb-2 sk-section-title">Estoque</h2>
        {stock.length === 0 && <p className="sk-empty">Sem produtos com estoque.</p>}
        <ul className="space-y-2">
          {stock.map((s) => (
            <li key={s.product_name} className="sk-list-row px-3 py-2">
              <p className="text-sm font-semibold text-neutral-900">{s.product_name}</p>
              <p className="text-xs text-neutral-500">
                inicial {s.initial_qty} · vendido {s.sold_qty} · esperado {s.expected_remaining} · contado {s.final_counted_qty ?? "-"} · diferença {s.final_counted_qty !== null ? (s.final_counted_qty - s.expected_remaining) : "-"}
              </p>
            </li>
          ))}
        </ul>
      </section>

      {/* Status */}
      <section className="sk-card p-4">
        <h2 className="mb-2 sk-section-title">Status</h2>
        <p className="text-base font-black text-neutral-900">{day.status === "fechado" ? "FECHADO" : "ABERTO"}</p>
      </section>

      {/* Impressão e navegação */}
      <div className="space-y-3 pb-4">
        {closeoutPrintData && (
          <PrintReceiptButton
            label="IMPRIMIR RELATÓRIO"
            onPrint={async () => {
              const config = await getPrinterSettings();
              return printCloseoutReceipt(closeoutPrintData, toPrintSettings(config));
            }}
          />
        )}
        <a
          href="/"
          className="sk-btn-secondary block w-full py-3.5 text-center"
        >
          Voltar ao início
        </a>
        {day.status === "fechado" && (
          <p className="text-center text-xs sk-text-muted">
            Na tela inicial você pode iniciar um novo dia de operação.
          </p>
        )}
      </div>
    </PageShell>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1">
      <dt className={strong ? "text-sm font-bold text-neutral-900" : "text-sm text-neutral-600"}>{label}</dt>
      <dd className={`${strong ? "text-lg font-black" : "text-sm font-semibold"} text-neutral-900`}>{value}</dd>
    </div>
  );
}