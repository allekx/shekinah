"use client";

import { useMemo, useState } from "react";
import { closeDay } from "@/lib/auth/close-day";
import BackButton from "@/components/back-button";

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
  const [countedCash, setCountedCash] = useState(String(closeout?.expected_cash ?? ""));
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

  // Resumo final da conferência
  const counted = Number(countedCash.replace(/\./g, "").replace(",", ".")) || 0;
  const diff = counted - expectedCash;

  const stockDiffTotal = stock.reduce((acc, s) => {
    const countedQty = stockCounted[s.product_id];
    return acc + (countedQty !== undefined ? Math.abs(countedQty - s.expected_remaining) : 0);
  }, 0);

  // Tela "DIA ENCERRADO"
  if (encerrado || day.status === "fechado") {
    return (
      <div className="space-y-6">
        <section className="rounded-2xl bg-green-600 p-6 text-center text-white">
          <p className="text-3xl">✅</p>
          <h1 className="mt-2 text-2xl font-black">DIA ENCERRADO</h1>
          <p className="mt-1 text-sm opacity-90">{day.day}</p>
        </section>

        {day.cash_difference !== null && (
          <section className="sk-card p-4">
            <h2 className="mb-3 sk-section-title">
              Resultado do caixa
            </h2>
            <Row label="Dinheiro esperado" value={fmtBRL(expectedCash)} />
            <Row label="Dinheiro contado" value={fmtBRL(day.counted_cash ?? counted)} />
            <div
              className={`mt-2 rounded-xl px-4 py-2 ${
                Number(day.cash_difference) === 0 ? "bg-green-50" : "bg-red-50"
              }`}
            >
              <p
                className={`text-sm font-bold ${
                  Number(day.cash_difference) === 0 ? "text-green-700" : "text-red-700"
                }`}
              >
                {Number(day.cash_difference) === 0
                  ? "🟢 CAIXA CONFERIDO"
                  : `🔴 DIFERENÇA DE ${fmtBRL(Math.abs(Number(day.cash_difference)))}`}
              </p>
            </div>
          </section>
        )}

        <a
          href="/relatorio"
          className="block rounded-2xl bg-blue-600 py-4 text-center text-lg font-black text-white"
        >
          🖨 IMPRIMIR RELATÓRIO
        </a>
        <p className="text-center text-xs text-neutral-400">
          O dia foi bloqueado e o histórico está preservado.
        </p>
      </div>
    );
  }

  // Tela de conferência (antes do fechamento)
  const setCountedQty = (id: number, v: number) =>
    setStockCounted((prev) => ({ ...prev, [id]: v }));

  return (
    <div className="space-y-5 pb-24">
      <header className="flex items-center gap-3">
        <BackButton />
        <div>
          <h1 className="text-xl font-bold text-neutral-900">Encerrar dia</h1>
          <p className="text-sm text-neutral-500">
            Confira tudo antes de confirmar o fechamento.
          </p>
        </div>
      </header>

      {closeoutError && (
        <p className="rounded-xl bg-red-50 px-4 py-2 text-sm font-medium text-red-700">
          {closeoutError}
        </p>
      )}

      {/* Vendas */}
      <section className="sk-card p-4">
        <h2 className="mb-3 sk-section-title">Vendas</h2>
        <Row label="Quantidade de pedidos" value={String(closeout?.orders_total ?? 0)} />
        <Row label="Total vendido" value={fmtBRL(totalSales)} strong />
        <Row label="Dinheiro" value={fmtBRL(cashCash)} />
        <Row label="Pix" value={fmtBRL(pixCash)} />
        <Row label="Cartão" value={fmtBRL(cardCash)} />
      </section>

      {/* Caixa */}
      <section className="sk-card p-4">
        <h2 className="mb-3 sk-section-title">Caixa</h2>
        <Row label="Caixa inicial" value={fmtBRL(initialCash)} />
        <Row label="Vendas em dinheiro" value={fmtBRL(cashCash)} />
        <div className="mt-2 rounded-xl bg-blue-50 px-4 py-2">
          <p className="text-sm font-semibold text-blue-800">Dinheiro esperado</p>
          <p className="text-xl font-black text-blue-900">{fmtBRL(expectedCash)}</p>
        </div>
        <div className="mt-3">
          <label className="mb-1 block text-sm font-semibold text-neutral-700">Dinheiro contado</label>
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold text-neutral-500">R$</span>
            <input
              name="counted_cash"
              value={countedCash}
              onChange={(e) => setCountedCash(e.target.value)}
              inputMode="decimal"
              placeholder="0,00"
              className="h-12 w-full rounded-xl border border-neutral-300 px-4 text-xl font-bold outline-none focus:border-blue-500"
            />
          </div>
          {counted > 0 && (
            <div
              className={`mt-2 rounded-xl px-4 py-2 ${
                diff === 0 ? "bg-green-50" : "bg-red-50"
              }`}
            >
              <p className={`text-sm font-bold ${diff === 0 ? "text-green-700" : "text-red-700"}`}>
                {diff === 0
                  ? "🟢 CAIXA CONFERIDO"
                  : `🔴 DIFERENÇA DE ${fmtBRL(Math.abs(diff))}`}
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Estoque final esperado x contado */}
      <section className="sk-card p-4">
        <h2 className="mb-3 sk-section-title">
          Estoque final
        </h2>
        <p className="mb-3 text-xs text-neutral-500">
          Informe a quantidade física encontrada de cada produto.
        </p>

        {stock.length === 0 && (
          <p className="text-sm text-neutral-400">Nenhum produto com estoque neste dia.</p>
        )}

        <ul className="space-y-3">
          {stock.map((s) => {
            const countedQty = stockCounted[s.product_id];
            const hasCount = countedQty !== undefined && countedQty !== null;
            const itemDiff = hasCount ? countedQty - s.expected_remaining : null;
            return (
              <li key={s.product_id} className="rounded-xl border border-neutral-200 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-neutral-900">{s.product_name}</p>
                  {itemDiff !== null && itemDiff !== 0 && (
                    <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-700">
                      dif: {itemDiff > 0 ? "+" : ""}{itemDiff}
                    </span>
                  )}
                </div>
                <p className="text-xs text-neutral-500">
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
                    className="h-10 w-20 rounded-lg border border-neutral-300 px-3 text-center text-base font-bold outline-none focus:border-blue-500"
                  />
                  <input type="hidden" name="product_id" value={s.product_id} />
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Resumo final + confirmar */}
      <section className="rounded-2xl bg-neutral-900 p-4 text-white">
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
          {stockDiffTotal === 0 ? "Estoque conferido" : `Atenção: ${stockDiffTotal} unidade(s) de diferença no estoque ainda não conferida(s).`}
        </p>
      </section>

      {error && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </p>
      )}

      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-neutral-200 bg-white p-4">
        <div className="mx-auto max-w-md">
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
            <input type="hidden" name="counted_cash" value={countedCash} />
            {stock.map((s) => (
              <input key={s.product_id} type="hidden" name="product_id" value={s.product_id} />
            ))}
            {stock.map((s) => (
              <input key={`q-${s.product_id}`} type="hidden" name="counted_qty" value={stockCounted[s.product_id] ?? 0} />
            ))}
            <input type="hidden" name="notes" value="" />
            <button
              type="submit"
              disabled={pending}
              className="w-full rounded-2xl bg-red-600 py-5 text-lg font-black text-white transition active:bg-red-700 disabled:opacity-60"
            >
              {pending ? "Encerrando…" : "CONFIRMAR E ENCERRAR DIA"}
            </button>
            <p className="mt-2 text-center text-xs text-neutral-400">
              Ao confirmar, o dia será bloqueado e não aceitará novos pedidos.
            </p>
          </form>
        </div>
      </div>
    </div>
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