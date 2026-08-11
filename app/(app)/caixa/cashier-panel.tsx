"use client";

import { useState } from "react";
import { addPaymentAction } from "@/lib/auth/cashier";

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

const fmtBRL = (v: number | string) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v));

/** Painel do caixa: resumo financeiro + receber pedidos + conferência. */
export default function CashierPanel({ closeout, closeoutError, pendingOrders, dayId, day }: CashierProps) {
  const [paymentFor, setPaymentFor] = useState<string | null>(null);
  const [method, setMethod] = useState<"dinheiro" | "pix" | "cartao">("dinheiro");
  const [amount, setAmount] = useState("");
  const [change, setChange] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [countedCash, setCountedCash] = useState("");
  const [pending, setPending] = useState(false);

  const pm = (closeout?.payments_by_method as Record<string, number> | undefined) ?? {};
  const initialCash = Number(closeout?.initial_cash ?? 0);
  const totalSales = Number(closeout?.total_sales ?? 0);
  const cashCash = Number(pm.dinheiro ?? 0);
  const pixCash = Number(pm.pix ?? 0);
  const cardCash = Number(pm.cartao ?? 0);
  const expectedCash = Number(closeout?.expected_cash ?? initialCash + cashCash);

  // Conferência
  const counted = Number(countedCash.replace(/\./g, "").replace(",", ".")) || 0;
  const difference = counted - expectedCash;

  const openPayment = (id: string, total: number) => {
    setPaymentFor(id);
    setMethod("dinheiro");
    setAmount(String(total));
    setError(null);
    setChange("");
  };

  return (
    <div className="space-y-5 pb-10">
      <header>
        <h1 className="text-xl font-bold text-neutral-900">Caixa</h1>
        <p className="text-sm text-neutral-500">Dia {day}</p>
      </header>

      {closeoutError && (
        <p className="rounded-xl bg-red-50 px-4 py-2 text-sm font-medium text-red-700">{closeoutError}</p>
      )}

      {/* Resumo financeiro */}
      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-neutral-500">Resumo do caixa</h2>
        <dl className="space-y-2">
          <Row label="Caixa inicial" value={fmtBRL(initialCash)} />
          <Row label="Vendas em dinheiro" value={fmtBRL(cashCash)} />
          <Row label="Vendas via Pix" value={fmtBRL(pixCash)} />
          <Row label="Vendas via cartão" value={fmtBRL(cardCash)} />
          <Row label="Total vendido" value={fmtBRL(totalSales)} strong />
        </dl>
        <div className="mt-3 rounded-xl bg-blue-50 px-4 py-3">
          <p className="text-sm font-semibold text-blue-800">DINHEIRO ESPERADO</p>
          <p className="text-2xl font-black text-blue-900">{fmtBRL(expectedCash)}</p>
          <p className="text-xs text-blue-600">caixa inicial + vendas em dinheiro</p>
        </div>
      </section>

      {/* Conferência */}
      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-neutral-500">Conferência</h2>
        <label className="mb-1 block text-sm font-semibold text-neutral-700">Dinheiro contado</label>
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold text-neutral-500">R$</span>
          <input
            value={countedCash}
            onChange={(e) => setCountedCash(e.target.value)}
            inputMode="decimal"
            placeholder="0,00"
            className="h-12 w-full rounded-xl border border-neutral-300 px-4 text-2xl font-bold outline-none focus:border-blue-500"
          />
        </div>
        <div
          className={`mt-3 rounded-xl px-4 py-3 ${
            counted === 0 ? "bg-neutral-50" : difference === 0 ? "bg-green-50" : "bg-red-50"
          }`}
        >
          <p className={`text-sm font-bold ${difference === 0 ? "text-green-700" : "text-red-700"}`}>
            {counted === 0
              ? "Informe o dinheiro contado"
              : difference === 0
                ? "🟢 CAIXA CONFERIDO"
                : `🔴 DIFERENÇA DE ${fmtBRL(Math.abs(difference))}`}
          </p>
          <p className="mt-1 text-xs text-neutral-500">
            Contado {fmtBRL(counted)} · Esperado {fmtBRL(expectedCash)}
            {difference !== 0 && counted !== 0 && ` (${difference > 0 ? "sobra" : "falta"} de ${fmtBRL(Math.abs(difference))})`}
          </p>
        </div>
        <p className="mt-2 text-xs text-neutral-400">
          O resultado da conferência será registrado no fechamento.
        </p>
      </section>

      {/* Pedidos a receber */}
      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-neutral-500">
          Receber ({pendingOrders.length})
        </h2>

        {pendingOrders.length === 0 && (
          <p className="rounded-xl bg-neutral-50 py-6 text-center text-sm text-neutral-400">
            Nenhum pedido pendente de pagamento.
          </p>
        )}

        <ul className="space-y-2">
          {pendingOrders.map((o) => (
            <li key={o.id} className="rounded-xl border border-neutral-200 p-3">
              {paymentFor === o.id ? (
                <form
                  className="space-y-3"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setPending(true);
                    const fd = new FormData(e.currentTarget);
                    const res = await addPaymentAction(fd);
                    setError(res.error ?? null);
                    if (!res.error) {
                      setPaymentFor(null);
                      setAmount("");
                      setChange("");
                    }
                    setPending(false);
                  }}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-base font-bold text-neutral-900">
                      #{o.number} · {o.customer_name ?? "Cliente"}
                    </p>
                    <p className="text-lg font-black">{fmtBRL(o.total)}</p>
                  </div>

                  {/* Forma */}
                  <div className="grid grid-cols-3 gap-2">
                    {(
                      [
                        ["dinheiro", "Dinheiro"],
                        ["pix", "Pix"],
                        ["cartao", "Cartão"],
                      ] as const
                    ).map(([v, label]) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => {
                          setMethod(v);
                          setAmount(String(o.total));
                        }}
                        className={`rounded-lg border px-2 py-2 text-sm font-bold ${
                          method === v ? "border-blue-600 bg-blue-50 text-blue-700" : "border-neutral-200 text-neutral-600"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  <input type="hidden" name="order_id" value={o.id} />
                  <input type="hidden" name="method" value={method} />
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-neutral-500">R$</span>
                    <input
                      name="amount"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      inputMode="decimal"
                      className="h-11 flex-1 rounded-lg border border-neutral-300 px-3 text-lg font-bold outline-none focus:border-blue-500"
                    />
                  </div>

                  {method === "dinheiro" && (
                    <label className="flex items-center gap-2 text-sm text-neutral-600">
                      Troco para R$
                    </label>
                  )}
                  {method === "dinheiro" && (
                    <input
                      name="change_given"
                      value={change}
                      onChange={(e) => setChange(e.target.value)}
                      inputMode="decimal"
                      placeholder="0,00"
                      className="h-11 w-full rounded-lg border border-neutral-300 px-3 text-base font-bold outline-none focus:border-blue-500"
                    />
                  )}

                  {error && (
                    <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p>
                  )}

                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={pending}
                      className="flex-1 rounded-lg bg-green-600 py-3 text-base font-black text-white disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {pending ? "Registrando…" : "REGISTRAR PAGAMENTO"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentFor(null)}
                      className="rounded-lg border border-neutral-300 px-4 text-sm font-bold text-neutral-600"
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
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
                      className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white"
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
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <dt className={strong ? "text-sm font-bold text-neutral-900" : "text-sm text-neutral-600"}>{label}</dt>
      <dd className={`${strong ? "text-lg font-black" : "text-sm font-semibold"} text-neutral-900`}>{value}</dd>
    </div>
  );
}