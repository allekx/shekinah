"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import PageShell from "@/components/page-shell";
import { adjustStockAction } from "@/lib/auth/stock";

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
  const router = useRouter();
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

  const parseDeltaInput = (raw: string) => {
    const trimmed = raw.trim();
    if (trimmed === "" || trimmed === "-") return 0;
    const digits = trimmed.replace(/[^\d-]/g, "");
    if (digits === "" || digits === "-") return 0;
    return Number(digits);
  };

  const toggleAdjust = (productId: number) => {
    setError(null);
    if (adjustFor === productId) {
      setAdjustFor(null);
      setDelta("");
      return;
    }
    setAdjustFor(productId);
    setDelta("");
  };

  const setDeltaValue = (value: number) => {
    if (value === 0) {
      setDelta("");
      return;
    }
    setDelta(String(value));
  };

  return (
    <PageShell title="Estoque" subtitle="Controle do dia de operação.">
      <section className="sk-card p-4">
        <h2 className="sk-section-title mb-3">Saldo do dia</h2>
        <ul className="space-y-2">
          {stock.length === 0 && (
            <li className="py-3 text-center text-sm text-neutral-400">
              Nenhum produto com estoque neste dia.
            </li>
          )}
          {stock.map((s) => {
            const isAdjusting = adjustFor === s.product_id;
            return (
              <li
                key={s.product_id}
                className="sk-list-row"
              >
                <div className="flex items-center justify-between gap-3 px-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-neutral-900">
                      {s.name}
                      {s.esgotado && (
                        <span className="sk-badge sk-badge--danger ml-1.5">ESGOTADO</span>
                      )}
                    </p>
                    <p className="text-xs text-neutral-500">
                      inicial {s.initial_qty} · vendido {s.sold_qty}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span
                      className={`min-w-[2ch] text-right text-lg font-black tabular-nums ${
                        s.remaining < 0 ? "text-red-600" : "text-neutral-900"
                      }`}
                    >
                      {s.remaining}
                    </span>
                    <button
                      type="button"
                      onClick={() => toggleAdjust(s.product_id)}
                      className={
                        isAdjusting
                          ? "sk-btn-primary px-3 py-2 text-xs"
                          : "sk-btn-secondary px-3 py-2 text-xs"
                      }
                    >
                      {isAdjusting ? "Fechar" : "Ajustar"}
                    </button>
                  </div>
                </div>

                {isAdjusting && (
                  <form
                    className="space-y-3 border-t border-neutral-100 bg-neutral-50/80 px-3 py-3"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      setPending(true);
                      setError(null);
                      const fd = new FormData(e.currentTarget);
                      const res = await adjustStockAction(fd);
                      setError(res?.error ?? null);
                      if (!res?.error) {
                        setAdjustFor(null);
                        setDelta("");
                        router.refresh();
                      }
                      setPending(false);
                    }}
                  >
                    <input type="hidden" name="day_id" value={dayId} />
                    <input type="hidden" name="product_id" value={s.product_id} />
                    <input type="hidden" name="delta" value={parseDeltaInput(delta)} />

                    <p className="text-center text-xs font-medium text-neutral-600">
                      Quanto adicionar ou remover do saldo?
                    </p>

                    <div className="flex items-center justify-center gap-1">
                      <button
                        type="button"
                        onClick={() => setDeltaValue(parseDeltaInput(delta) - 1)}
                        className="sk-qty-btn"
                        aria-label="Diminuir ajuste"
                      >
                        −
                      </button>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={delta}
                        onChange={(e) => {
                          const raw = e.target.value;
                          if (raw === "" || raw === "-") {
                            setDelta(raw);
                            return;
                          }
                          const cleaned = raw.replace(/[^\d-]/g, "");
                          setDelta(
                            cleaned.startsWith("-")
                              ? `-${cleaned.replace(/-/g, "")}`
                              : cleaned.replace(/-/g, "")
                          );
                        }}
                        placeholder="0"
                        className="sk-qty-input"
                      />
                      <button
                        type="button"
                        onClick={() => setDeltaValue(parseDeltaInput(delta) + 1)}
                        className="sk-qty-btn"
                        aria-label="Aumentar ajuste"
                      >
                        +
                      </button>
                    </div>

                    <p className="text-center text-[11px] text-neutral-500">
                      Positivo adiciona · negativo remove
                    </p>

                    <button
                      type="submit"
                      disabled={pending || parseDeltaInput(delta) === 0}
                      className="sk-btn-primary w-full py-3"
                    >
                      {pending ? "Aplicando…" : "Aplicar ajuste"}
                    </button>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
        {error && (
          <p role="alert" className="mt-3 sk-alert-error">
            {error}
          </p>
        )}
      </section>

      <section className="sk-card p-4">
        <h2 className="sk-section-title mb-3">Movimentações</h2>
        {movements.length === 0 ? (
          <p className="text-sm text-neutral-400">Sem movimentações registradas.</p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {movements.map((m, i) => (
              <li key={i} className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm font-semibold text-neutral-800">{m.product_name}</p>
                  <p className="text-xs text-neutral-500">
                    {typeLabel[m.type] ?? m.type} ·{" "}
                    {new Date(m.created_at).toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                <span
                  className={`text-sm font-bold tabular-nums ${
                    m.type === "ajuste"
                      ? m.quantity > 0
                        ? "text-green-600"
                        : "text-red-600"
                      : m.quantity > 0
                        ? "text-red-600"
                        : "text-green-600"
                  }`}
                >
                  {sign(m.quantity, true)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </PageShell>
  );
}
