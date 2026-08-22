"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import PageShell from "@/components/page-shell";
import { addPaymentsAction } from "@/lib/auth/cashier";
import { closeDay } from "@/lib/auth/close-day";
import { formatMoneyInput } from "@/lib/money";
import MoneyInput from "@/components/money-input";

interface CashierProps {
  dayId: string;
  day: string;
  closeout: Record<string, unknown> | null;
  closeoutError?: string;
  pendingOrders: {
    id: string;
    number: number;
    customer_name: string | null;
    status: string;
    total: number;
  }[];
}

interface StockRow {
  product_id: number;
  product_name: string;
  initial_qty: number;
  sold_qty: number;
  expected_remaining: number;
  final_counted_qty: number | null;
}

const fmtBRL = (v: number | string) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v));

const fmtDayShort = (dayStr: string) => {
  const [year, month, dayNum] = dayStr.split("-");
  if (!year || !month || !dayNum) return dayStr;
  return `${dayNum.padStart(2, "0")}/${month.padStart(2, "0")}/${year.slice(-2)}`;
};

type PayMethod = "dinheiro" | "pix" | "cartao";

interface PaymentLine {
  id: string;
  method: PayMethod;
  amount: number | null;
  change: number | null;
}

const lineLiquid = (line: PaymentLine) => {
  const amount = line.amount ?? 0;
  const change = line.method === "dinheiro" ? line.change ?? 0 : 0;
  return Math.max(0, amount - change);
};

const newPaymentLine = (
  method: PayMethod = "dinheiro",
  amount: number | null = null
): PaymentLine => ({
  id: crypto.randomUUID(),
  method,
  amount,
  change: null,
});

/** Painel do caixa: receber → resumo → conferência → encerrar dia. */
export default function CashierPanel({
  closeout,
  closeoutError,
  pendingOrders,
  dayId,
  day,
}: CashierProps) {
  const router = useRouter();
  const [paymentFor, setPaymentFor] = useState<string | null>(null);
  const [paymentLines, setPaymentLines] = useState<PaymentLine[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [countedCash, setCountedCash] = useState<number | null>(null);
  const [stockCounted, setStockCounted] = useState<Record<number, number>>({});
  const [pending, setPending] = useState(false);
  const [closing, setClosing] = useState(false);
  const [closeError, setCloseError] = useState<string | null>(null);

  const pm = (closeout?.payments_by_method as Record<string, number> | undefined) ?? {};
  const initialCash = Number(closeout?.initial_cash ?? 0);
  const totalSales = Number(closeout?.total_sales ?? 0);
  const cashCash = Number(pm.dinheiro ?? 0);
  const pixCash = Number(pm.pix ?? 0);
  const cardCash = Number(pm.cartao ?? 0);
  const expectedCash = Number(closeout?.expected_cash ?? initialCash + cashCash);
  const stock: StockRow[] = useMemo(
    () => (closeout?.stock as StockRow[] | undefined) ?? [],
    [closeout]
  );

  const counted = countedCash ?? 0;
  const difference = counted - expectedCash;
  const cashFieldEmpty = countedCash === null;
  const cashOk = !cashFieldEmpty && difference === 0;

  const openPayment = (id: string, total: number) => {
    setPaymentFor(id);
    setPaymentLines([newPaymentLine("dinheiro", total)]);
    setError(null);
  };

  const closePayment = () => {
    setPaymentFor(null);
    setPaymentLines([]);
    setError(null);
  };

  const updatePaymentLine = (id: string, patch: Partial<PaymentLine>) => {
    setPaymentLines((prev) =>
      prev.map((line) => (line.id === id ? { ...line, ...patch } : line))
    );
  };

  const addPaymentLine = (orderTotal: number) => {
    setPaymentLines((prev) => {
      const received = prev.reduce((sum, line) => sum + lineLiquid(line), 0);
      const remaining = Math.max(0, orderTotal - received);
      const nextMethod: PayMethod = prev.some((line) => line.method === "pix")
        ? "dinheiro"
        : "pix";
      return [...prev, newPaymentLine(nextMethod, remaining > 0 ? remaining : null)];
    });
  };

  const removePaymentLine = (id: string) => {
    setPaymentLines((prev) => (prev.length <= 1 ? prev : prev.filter((line) => line.id !== id)));
  };

  const setCountedQty = (id: number, v: number) =>
    setStockCounted((prev) => ({ ...prev, [id]: v }));

  return (
    <PageShell title="Caixa" subtitle={`Dia ${fmtDayShort(day)}`} className="pb-10">
      {closeoutError && <p className="sk-alert-error">{closeoutError}</p>}

      {/* 1. Receber */}
      <section className="sk-card p-4">
        <h2 className="sk-section-title mb-3">Receber ({pendingOrders.length})</h2>

        {pendingOrders.length === 0 && (
          <p className="sk-empty">Nenhum pedido pendente de pagamento.</p>
        )}

        <ul className="space-y-2">
          {pendingOrders.map((o) => (
            <li key={o.id} className="sk-list-row p-3">
              {paymentFor === o.id ? (
                (() => {
                  const receivedTotal = paymentLines.reduce(
                    (sum, line) => sum + lineLiquid(line),
                    0
                  );
                  const remaining = o.total - receivedTotal;
                  const canSubmit =
                    paymentLines.length > 0 &&
                    paymentLines.every((line) => (line.amount ?? 0) > 0) &&
                    Math.abs(remaining) < 0.01;

                  return (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-base font-bold text-neutral-900">
                          #{o.number} · {o.customer_name ?? "Cliente"}
                        </p>
                        <p className="text-lg font-black">{fmtBRL(o.total)}</p>
                      </div>

                      <div className="space-y-3">
                        {paymentLines.map((line, index) => (
                          <div
                            key={line.id}
                            className="rounded-xl border border-neutral-200 bg-neutral-50/80 p-3"
                          >
                            <div className="mb-2 flex items-center justify-between gap-2">
                              <p className="text-xs font-bold uppercase tracking-wide text-neutral-500">
                                Pagamento {index + 1}
                              </p>
                              {paymentLines.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => removePaymentLine(line.id)}
                                  className="text-xs font-semibold text-red-600"
                                >
                                  Remover
                                </button>
                              )}
                            </div>

                            <div className="grid grid-cols-3 gap-2">
                              {(
                                [
                                  ["dinheiro", "Dinheiro"],
                                  ["pix", "Pix"],
                                  ["cartao", "Cartão"],
                                ] as const
                              ).map(([value, label]) => (
                                <button
                                  key={value}
                                  type="button"
                                  onClick={() =>
                                    updatePaymentLine(line.id, {
                                      method: value,
                                      change: value === "dinheiro" ? line.change : null,
                                    })
                                  }
                                  className={`sk-method-chip ${
                                    line.method === value ? "sk-method-chip--active" : ""
                                  }`}
                                >
                                  {label}
                                </button>
                              ))}
                            </div>

                            <div className="mt-2 flex items-center gap-2">
                              <span className="text-lg font-bold text-neutral-500">R$</span>
                              <MoneyInput
                                value={line.amount}
                                onValueChange={(amount) =>
                                  updatePaymentLine(line.id, { amount })
                                }
                                placeholder="0,00"
                                className="sk-input h-11 flex-1 text-lg font-bold tabular-nums"
                              />
                            </div>

                            {line.method === "dinheiro" && (
                              <div className="mt-2">
                                <label className="mb-1 block text-sm text-neutral-600">
                                  Troco para R$
                                </label>
                                <MoneyInput
                                  value={line.change}
                                  onValueChange={(change) =>
                                    updatePaymentLine(line.id, { change })
                                  }
                                  placeholder="0,00"
                                  className="sk-input h-11 w-full text-base font-bold tabular-nums"
                                />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      <button
                        type="button"
                        onClick={() => addPaymentLine(o.total)}
                        disabled={paymentLines.length >= 3}
                        className="w-full rounded-xl border border-dashed border-primary-300 bg-primary-50/50 py-2.5 text-sm font-bold text-primary-700 transition hover:bg-primary-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        + Outra forma de pagamento
                      </button>

                      <div
                        className={
                          canSubmit
                            ? "sk-alert-success py-2.5"
                            : remaining > 0
                              ? "sk-alert-warn py-2.5"
                              : "sk-alert-error py-2.5"
                        }
                      >
                        {canSubmit ? (
                          <p className="font-semibold">Total conferido · pronto para registrar</p>
                        ) : remaining > 0 ? (
                          <p className="font-semibold">
                            Falta {fmtBRL(remaining)} para quitar o pedido
                          </p>
                        ) : (
                          <p className="font-semibold">
                            Valor excede o total em {fmtBRL(Math.abs(remaining))}
                          </p>
                        )}
                        <p className="mt-0.5 text-xs opacity-80">
                          Recebido {fmtBRL(receivedTotal)} de {fmtBRL(o.total)}
                        </p>
                      </div>

                      {error && <p className="sk-alert-error">{error}</p>}

                      <div className="flex items-stretch gap-2">
                        <button
                          type="button"
                          disabled={pending || !canSubmit}
                          onClick={async () => {
                            if (!canSubmit || pending) return;
                            setPending(true);
                            setError(null);
                            const res = await addPaymentsAction(
                              o.id,
                              paymentLines.map((line) => ({
                                method: line.method,
                                amount: line.amount ?? 0,
                                change_given:
                                  line.method === "dinheiro" ? line.change ?? 0 : 0,
                              }))
                            );
                            setError(res.error ?? null);
                            if (!res.error) {
                              closePayment();
                              router.refresh();
                            }
                            setPending(false);
                          }}
                          className="sk-btn-success min-h-[3.25rem] flex-1 rounded-xl py-3 text-sm font-bold tracking-wide"
                        >
                          {pending ? "Registrando…" : "Registrar pagamento"}
                        </button>
                        <button
                          type="button"
                          onClick={closePayment}
                          disabled={pending}
                          className="sk-btn-secondary min-h-[3.25rem] shrink-0 rounded-xl px-5 py-3 text-sm font-semibold"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  );
                })()
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-neutral-900">
                      #{o.number} · {o.customer_name ?? "Cliente"}
                    </p>
                    <p className="text-xs text-neutral-500">{o.status}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-sm font-bold">{fmtBRL(o.total)}</span>
                    <button
                      type="button"
                      onClick={() => openPayment(o.id, o.total)}
                      className="sk-btn-primary sk-btn-sm"
                    >
                      Receber
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      {/* 2. Resumo do caixa */}
      <section className="sk-card p-4">
        <h2 className="sk-section-title mb-3">Resumo do caixa</h2>
        <dl className="space-y-2">
          <Row label="Caixa inicial" value={fmtBRL(initialCash)} />
          <Row label="Vendas em dinheiro" value={fmtBRL(cashCash)} />
          <Row label="Vendas via Pix" value={fmtBRL(pixCash)} />
          <Row label="Vendas via cartão" value={fmtBRL(cardCash)} />
          <Row label="Total vendido" value={fmtBRL(totalSales)} strong />
        </dl>
        <div className="sk-highlight-primary">
          <p className="text-sm font-bold uppercase tracking-wide text-primary-700">
            Dinheiro esperado
          </p>
          <p className="sk-figure mt-0.5 text-2xl text-primary-800">{fmtBRL(expectedCash)}</p>
          <p className="text-xs text-primary-600/80">caixa inicial + vendas em dinheiro</p>
        </div>
      </section>

      {/* 3. Conferência */}
      <section className="sk-card p-4">
        <h2 className="sk-section-title mb-3">Conferência</h2>
        <label className="mb-1 block text-sm font-semibold text-neutral-700">
          Dinheiro contado
        </label>
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold text-neutral-500">R$</span>
          <MoneyInput
            value={countedCash}
            onValueChange={setCountedCash}
            placeholder="0,00"
            className="sk-input h-12 flex-1 text-2xl font-bold tabular-nums"
          />
        </div>
        <div
          className={`mt-3 rounded-xl px-4 py-3 ${
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
                : `DIFERENÇA DE ${fmtBRL(Math.abs(difference))}`}
          </p>
          <p className="mt-1 text-xs text-neutral-500">
            Contado {fmtBRL(counted)} · Esperado {fmtBRL(expectedCash)}
            {!cashOk &&
              !cashFieldEmpty &&
              ` (${difference > 0 ? "sobra" : "falta"} de ${fmtBRL(Math.abs(difference))})`}
          </p>
        </div>
      </section>

      {/* 4. Encerrar dia */}
      <section className="sk-card overflow-hidden p-0">
        <div className="border-b border-neutral-100 px-4 py-3">
          <h2 className="sk-section-title">Encerrar dia</h2>
          <p className="mt-1 text-xs text-neutral-500">
            Confira o estoque físico e encerre a operação do dia.
          </p>
        </div>

        <div className="space-y-4 px-4 py-4">
          {pendingOrders.length > 0 && (
            <p className="sk-alert-warn">
              Quite todos os pedidos pendentes antes de encerrar o dia.
            </p>
          )}

          {stock.length === 0 ? (
            <p className="text-sm text-neutral-400">Nenhum produto com estoque neste dia.</p>
          ) : (
            <ul className="space-y-3">
              {stock.map((s) => {
                const countedQty = stockCounted[s.product_id] ?? s.expected_remaining;
                const itemDiff = countedQty - s.expected_remaining;
                return (
                  <li key={s.product_id} className="sk-list-row p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="min-w-0 truncate text-sm font-semibold text-neutral-900">
                        {s.product_name}
                      </p>
                      {itemDiff !== 0 && (
                        <span className="shrink-0 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-700">
                          dif: {itemDiff > 0 ? "+" : ""}
                          {itemDiff}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-neutral-500">
                      inicial {s.initial_qty} · vendido {s.sold_qty} · esperado{" "}
                      {s.expected_remaining}
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-xs font-semibold text-neutral-600">Contado:</span>
                      <input
                        type="number"
                        inputMode="numeric"
                        value={countedQty}
                        onChange={(e) => setCountedQty(s.product_id, Number(e.target.value))}
                        className="sk-qty-input h-10 w-20"
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {closeError && (
            <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {closeError}
            </p>
          )}

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setClosing(true);
              setCloseError(null);
              const fd = new FormData(e.currentTarget);
              const res = await closeDay(fd);
              if (res?.error) {
                setCloseError(res.error);
                setClosing(false);
              }
            }}
          >
            <input type="hidden" name="day_id" value={dayId} />
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
                value={stockCounted[s.product_id] ?? s.expected_remaining}
              />
            ))}
            <input type="hidden" name="notes" value="" />
            <button
              type="submit"
              disabled={closing || pendingOrders.length > 0 || cashFieldEmpty || counted < 0}
              className="sk-btn-dark w-full rounded-2xl py-4"
            >
              {closing ? "Encerrando…" : "Confirmar e encerrar dia"}
            </button>
            <p className="mt-2 text-center text-xs text-neutral-400">
              Ao confirmar, o dia será bloqueado e não aceitará novos pedidos.
            </p>
          </form>
        </div>
      </section>
    </PageShell>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <dt className={strong ? "text-sm font-bold text-neutral-900" : "text-sm text-neutral-600"}>
        {label}
      </dt>
      <dd
        className={`${strong ? "text-lg font-black" : "text-sm font-semibold"} text-neutral-900`}
      >
        {value}
      </dd>
    </div>
  );
}
