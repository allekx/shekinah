"use client";

import { useState } from "react";
import { adjustStockAction } from "@/lib/auth/stock";
import BackButton from "@/components/back-button";

interface StockLine {
  product_id: number;
  name: string;
  initial_qty: number;
  sold_qty: number;
  remaining: number;
  esgotado: boolean;
}

interface Move {
  type: string;
  quantity: number;
  created_at: string;
  product_name: string;
}

/** Painel de estoque do dia: saldo, ESGOTADO, ajuste (+/-) e histórico. */
export default function StockPanel({
  dayId,
  stock,
  movements,
}: {
  dayId: string;
  stock: StockLine[];
  movements: Move[];
}) {
  const [adjustFor, setAdjustFor] = useState<number | null>(null);
  const [delta, setDelta] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const typeLabel: Record<string, string> = {
    inicial: "Inicial",
    venda: "Venda",
    cancelamento: "Cancelamento",
    ajuste: "Ajuste",
  };

  const sign = (n: number, showPlus: boolean) =>
    `${n > 0 && showPlus ? "+" : ""}${n}`;

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <BackButton />
        <div>
          <h1 className="text-xl font-bold text-neutral-900">Estoque</h1>
          <p className="text-sm text-neutral-500">Controle do dia de operação.</p>
        </div>
      </header>

      {/* Saldo por produto */}
      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-neutral-500">
          Saldo do dia
        </h2>
        <ul className="space-y-2">
          {stock.length === 0 && (
            <li className="py-3 text-center text-sm text-neutral-400">
              Nenhum produto com estoque neste dia.
            </li>
          )}
          {stock.map((s) => (
            <li
              key={s.product_id}
              className="flex items-center justify-between gap-2 rounded-xl border border-neutral-200 px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-neutral-900">
                  {s.name}{" "}
                  {s.esgotado && (
                    <span className="ml-1 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-700">
                      ESGOTADO
                    </span>
                  )}
                </p>
                <p className="text-xs text-neutral-500">
                  inicial {s.initial_qty} · vendido {s.sold_qty}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-lg font-black text-neutral-900">
                  {s.remaining}
                </span>
                <button
                  type="button"
                  onClick={() => setAdjustFor(adjustFor === s.product_id ? null : s.product_id)}
                  className="rounded-lg bg-neutral-100 px-2.5 py-1.5 text-xs font-bold text-neutral-700"
                >
                  Ajustar
                </button>
              </div>

              {adjustFor === s.product_id && (
                <form
                  className="flex-1 basis-full gap-2 border-t border-neutral-100 pt-2 sm:flex"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setPending(true);
                    const fd = new FormData(e.currentTarget);
                    const res = await adjustStockAction(fd);
                    setError(res?.error ?? null);
                    if (!res?.error) {
                      setAdjustFor(null);
                      setDelta("");
                    }
                    setPending(false);
                  }}
                >
                  <input type="hidden" name="day_id" value={dayId} />
                  <input type="hidden" name="product_id" value={s.product_id} />
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setDelta((d) => String((Number(d) || 0) - 1))}
                      className="flex h-10 w-10 items-center justify-center rounded-lg bg-neutral-100 text-xl font-bold text-neutral-700"
                    >
                      −
                    </button>
                    <input
                      name="delta"
                      type="number"
                      value={delta}
                      onChange={(e) => setDelta(e.target.value)}
                      placeholder="0"
                      className="h-10 w-16 rounded-lg border border-neutral-300 text-center text-base font-bold outline-none focus:border-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => setDelta((d) => String((Number(d) || 0) + 1))}
                      className="flex h-10 w-10 items-center justify-center rounded-lg bg-neutral-100 text-xl font-bold text-neutral-700"
                    >
                      +
                    </button>
                  </div>
                  <button
                    type="submit"
                    disabled={pending}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
                  >
                    Aplicar
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
        {error && (
          <p role="alert" className="mt-3 rounded-xl bg-red-50 px-4 py-2 text-sm font-medium text-red-700">
            {error}
          </p>
        )}
      </section>

      {/* Histórico de movimentações */}
      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-neutral-500">
          Movimentações
        </h2>
        {movements.length === 0 ? (
          <p className="text-sm text-neutral-400">Sem movimentações registradas.</p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {movements.map((m, i) => (
              <li key={i} className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm font-semibold text-neutral-800">
                    {m.product_name}
                  </p>
                  <p className="text-xs text-neutral-500">
                    {typeLabel[m.type] ?? m.type} ·{" "}
                    {new Date(m.created_at).toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                <span
                  className={`text-sm font-bold ${
                    m.quantity > 0 ? "text-red-600" : "text-green-600"
                  }`}
                >
                  {sign(m.quantity, true)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}