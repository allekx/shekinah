"use client";

import { useMemo, useState } from "react";
import PageShell from "@/components/page-shell";
import { SkNavLink } from "@/components/navigation-pending";
import { closeDay } from "@/lib/auth/close-day";
import { formatMoneyInput } from "@/lib/money";
import MoneyInput from "@/components/money-input";

interface CloseoutProps {
  day: {
    id: string;
    day: string;
    status: string;
    initial_cash: number;
    counted_cash: number | null;
    cash_difference: number | null;
    closed_at: string | null;
    closed_by: string | null;
  };
  closeout: Record<string, unknown> | null;
  closeoutError?: string;
  encerrado: boolean;
}

const fmtBRL = (v: number | string) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    Number(v)
  );

interface StockRow {
  product_id: number;
  product_name: string;
  initial_qty: number;
  sold_qty: number;
  expected_remaining: number;
  final_counted_qty: number | null;
}

/** Painel de fechamento: conferência completa + confirmar + DIA ENCERRADO. */
export default function CloseoutPanel({ day, closeout, closeoutError, encerrado }: CloseoutProps) {
  const [countedCash, setCountedCash] = useState<number | null>(null);
  const [stockCounted, setStockCounted] = useState<Record<number, number>>({});
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pm = (closeout?.payments_by_method as Record<string, number> | undefined) ?? {};
  const initialCash = Number(closeout?.initial_cash ?? 0);
  const totalSales = Number(closeout?.total_sales ?? 0);
  const cashCash = Number(pm.dinheiro ?? 0);
  const pixCash = Number(pm.pix ?? 0);
  const cardCash = Number(pm.cartao ?? 0);
  const expectedCash = Number(closeout?.expected_cash ?? initialCash + cashCash);

  const stock: StockRow[] = useMemo(() => (closeout?.stock as StockRow[] | undefined) ?? [], [closeout]);

  const counted = countedCash ?? 0;
  const diff = counted - expectedCash;
  const cashFieldEmpty = countedCash === null;
  const cashOk = !cashFieldEmpty && diff === 0;

  const stockDiffTotal = stock.reduce((acc, s) => {
    const countedQty = stockCounted[s.product_id];
    return acc + (countedQty !== undefined ? Math.abs(countedQty - s.expected_remaining) : 0);
  }, 0);

  if (encerrado || day.status === "fechado") {
    return (
      <PageShell title="Dia encerrado" subtitle={day.day}>
        <section className="sk-hero-success">
          <p className="text-3xl">✅</p>
          <h2 className="mt-2 text-2xl font-black">DIA ENCERRADO</h2>
          <p className="mt-1 text-sm opacity-90">{day.day}</p>
        </section>

        {day.cash_difference !== null && (
          <section className="sk-card p-4">
            <h2 className="mb-3 sk-section-title">Resultado do caixa</h2>
            <Row label="Dinheiro esperado" value={fmtBRL(expectedCash)} />
            <Row label="Dinheiro contado" value={fmtBRL(day.counted_cash ?? counted)} />
            <div
              className={`mt-2 rounded-xl px-4 py-2 ${
                Number(day.cash_difference) === 0 ? "bg-success-50" : "bg-danger-50"
              }`}
            >
              <p
                className={`text-sm font-bold ${
                  Number(day.cash_difference) === 0 ? "text-success-600" : "text-danger-600"
                }`}
              >
                {Number(day.cash_difference) === 0
                  ? "CAIXA CONFERIDO"
                  : `DIFERENÇA DE ${fmtBRL(Math.abs(Number(day.cash_difference)))}`}
              </p>
            </div>
          </section>
        )}

        <SkNavLink
          href={`/relatorio/${day.id}`}
          skeleton="report"
          className="sk-btn-primary block w-full py-4 text-center text-lg"
        >
          Ver relatório
        </SkNavLink>
        <p className="text-center text-xs sk-text-muted">
          O dia foi bloqueado e o histórico está preservado.
        </p>
      </PageShell>
    );
  }

  const setCountedQty = (id: number, v: number) =>
    setStockCounted((prev) => ({ ...prev, [id]: v }));

  return (
    <PageShell
      title="Encerrar dia"
      subtitle="Confira tudo antes de confirmar o fechamento."
      className="sk-page-with-sticky-footer"
    >
      {closeoutError && <p className="sk-alert-error">{closeoutError}</p>}

      <section className="sk-card p-4">
        <h2 className="mb-3 sk-section-title">Vendas</h2>
        <Row label="Quantidade de pedidos" value={String(closeout?.orders_total ?? 0)} />
        <Row label="Total vendido" value={fmtBRL(totalSales)} strong />
        <Row label="Dinheiro" value={fmtBRL(cashCash)} />
        <Row label="Pix" value={fmtBRL(pixCash)} />
        <Row label="Cartão" value={fmtBRL(cardCash)} />
      </section>

      <section className="sk-card p-4">
        <h2 className="mb-3 sk-section-title">Caixa</h2>
        <Row label="Caixa inicial" value={fmtBRL(initialCash)} />
        <Row label="Vendas em dinheiro" value={fmtBRL(cashCash)} />
        <div className="sk-highlight-primary">
          <p className="text-sm font-semibold text-primary-800">Dinheiro esperado</p>
          <p className="sk-figure text-xl text-primary-900">{fmtBRL(expectedCash)}</p>
        </div>
        <div className="mt-3">
          <label className="sk-label">Dinheiro contado</label>
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold text-neutral-500">R$</span>
            <MoneyInput
              value={countedCash}
              onValueChange={setCountedCash}
              placeholder="0,00"
              className="sk-input h-12 flex-1 text-xl font-bold tabular-nums"
            />
          </div>
          {(!cashFieldEmpty || expectedCash === 0) && (
            <div
              className={`mt-2 rounded-xl px-4 py-2 ${
                cashFieldEmpty ? "bg-neutral-50" : cashOk ? "bg-success-50" : "bg-danger-50"
              }`}
            >
              <p
                className={`text-sm font-bold ${
                  cashFieldEmpty
                    ? "text-neutral-600"
                    : cashOk
                      ? "text-success-600"
                      : "text-danger-600"
                }`}
              >
                {cashFieldEmpty
                  ? "Informe o dinheiro contado"
                  : cashOk
                    ? "CAIXA CONFERIDO"
                    : `DIFERENÇA DE ${fmtBRL(Math.abs(diff))}`}
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="sk-card p-4">
        <h2 className="mb-3 sk-section-title">Estoque final</h2>
        <p className="mb-3 text-xs sk-text-muted">
          Informe a quantidade física encontrada de cada produto.
        </p>

        {stock.length === 0 && (
          <p className="sk-empty">Nenhum produto com estoque neste dia.</p>
        )}

        <ul className="space-y-3">
          {stock.map((s) => {
            const countedQty = stockCounted[s.product_id];
            const hasCount = countedQty !== undefined && countedQty !== null;
            const itemDiff = hasCount ? countedQty - s.expected_remaining : null;
            return (
              <li key={s.product_id} className="sk-list-row p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-neutral-900">{s.product_name}</p>
                  {itemDiff !== null && itemDiff !== 0 && (
                    <span className="sk-badge sk-badge--danger">
                      dif: {itemDiff > 0 ? "+" : ""}
                      {itemDiff}
                    </span>
                  )}
                </div>
                <p className="text-xs sk-text-muted">
                  inicial {s.initial_qty} · vendido {s.sold_qty} · esperado {s.expected_remaining}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-xs font-semibold text-neutral-600">Contado:</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    name="counted_qty"
                    value={countedQty ?? ""}
                    onChange={(e) => setCountedQty(s.product_id, Number(e.target.value))}
                    className="sk-qty-input h-10 w-20"
                  />
                  <input type="hidden" name="product_id" value={s.product_id} />
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="sk-summary-dark">
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide opacity-80">Resumo final</h2>
        <div className="flex justify-between text-sm">
          <span>Pedidos</span>
          <span>{String(closeout?.orders_total ?? 0)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span>Total vendido</span>
          <span>{fmtBRL(totalSales)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span>Dinheiro esperado</span>
          <span>{fmtBRL(expectedCash)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span>Dinheiro contado</span>
          <span>{fmtBRL(counted)}</span>
        </div>
        <div className="flex justify-between border-t border-white/20 pt-2 text-base font-black">
          <span>Diferença</span>
          <span>{fmtBRL(diff)}</span>
        </div>
        <p className="mt-2 text-xs opacity-70">
          {stockDiffTotal === 0
            ? "Estoque conferido"
            : `Atenção: ${stockDiffTotal} unidade(s) de diferença no estoque ainda não conferida(s).`}
        </p>
      </section>

      {error && (
        <p role="alert" className="sk-alert-error">
          {error}
        </p>
      )}

      <div className="sk-sticky-footer">
        <div className="sk-sticky-footer__inner">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setPending(true);
              const fd = new FormData(e.currentTarget);
              const res = await closeDay(fd);
              setError(res.error ?? null);
              setPending(false);
            }}
          >
            <input type="hidden" name="day_id" value={day.id} />
            <input
              type="hidden"
              name="counted_cash"
              value={countedCash === null ? "" : formatMoneyInput(countedCash)}
            />
            {stock.map((s) => (
              <input key={s.product_id} type="hidden" name="product_id" value={s.product_id} />
            ))}
            {stock.map((s) => (
              <input
                key={`q-${s.product_id}`}
                type="hidden"
                name="counted_qty"
                value={stockCounted[s.product_id] ?? 0}
              />
            ))}
            <input type="hidden" name="notes" value="" />
            <button type="submit" disabled={pending} className="sk-btn-danger w-full py-5 text-lg">
              {pending ? "Encerrando…" : "CONFIRMAR E ENCERRAR DIA"}
            </button>
            <p className="mt-2 text-center text-xs sk-text-muted">
              Ao confirmar, o dia será bloqueado e não aceitará novos pedidos.
            </p>
          </form>
        </div>
      </div>
    </PageShell>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1">
      <dt className={strong ? "text-sm font-bold text-neutral-900" : "text-sm text-neutral-600"}>
        {label}
      </dt>
      <dd className={`${strong ? "text-lg font-black" : "text-sm font-semibold"} text-neutral-900`}>
        {value}
      </dd>
    </div>
  );
}
