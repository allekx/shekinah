"use client";

import { useActionState, useState } from "react";
import PageShell from "@/components/page-shell";
import { openDay, type OpenDayResult } from "@/lib/auth/open-day";
import OpenDayAddProduct from "./open-day-add-product";

interface Product {
  id: number;
  name: string;
  category: string | null;
  unit_price: number;
}

/** Formulário de abertura do dia: grade de estoque inicial + caixa inicial.
 *  Controles simples [-] qty [+] para digitação rápida no celular.
 */
export default function OpenDayForm({
  products,
  categories,
}: {
  products: Product[];
  categories: string[];
}) {
  const [state, formAction, pending] = useActionState<OpenDayResult, FormData>(
    openDay,
    {}
  );
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [cash, setCash] = useState("");

  const qty = (id: number) => quantities[id] ?? 0;

  const setQty = (id: number, value: number) => {
    setQuantities((prev) => ({ ...prev, [id]: Math.max(0, value) }));
  };

  const parseQtyInput = (raw: string) => {
    const digits = raw.replace(/\D/g, "");
    if (digits === "") return 0;
    return Number(digits);
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);

  // Agrupa por categoria
  const byCategory = products.reduce<Record<string, Product[]>>((acc, p) => {
    const key = p.category ?? "Outros";
    (acc[key] ??= []).push(p);
    return acc;
  }, {});

  const categoryRank = (category: string) => {
    const name = category.toLowerCase();
    if (name === "pratos") return 0;
    if (name === "bebidas") return 1;
    return 2;
  };

  const sortedCategories = Object.entries(byCategory).sort(([a], [b]) => {
    const diff = categoryRank(a) - categoryRank(b);
    if (diff !== 0) return diff;
    return a.localeCompare(b, "pt-BR");
  });

  return (
    <PageShell title="Iniciar dia" subtitle="Informe o estoque inicial e o caixa inicial.">
      <form action={formAction} className="space-y-6">
        {/* Grade de estoque por categoria */}
        {sortedCategories.map(([category, list]) => (
          <section key={category} className="sk-card p-4">
            <h2 className="mb-3 sk-section-title">
              {category}
            </h2>
            <ul className="space-y-2">
              {list.map((p) => {
                const n = qty(p.id);
                return (
                <li
                  key={p.id}
                  className="sk-list-row flex items-center justify-between gap-3 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-neutral-900">
                      {p.name}
                    </p>
                    <p className="text-xs text-neutral-500">
                      {formatCurrency(Number(p.unit_price))}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setQty(p.id, n - 1)}
                      className="sk-qty-btn h-9 w-9"
                      aria-label={`Diminuir ${p.name}`}
                    >
                      −
                    </button>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      name="quantity"
                      value={n === 0 ? "" : String(n)}
                      placeholder="0"
                      onChange={(e) => setQty(p.id, parseQtyInput(e.target.value))}
                      className="sk-qty-input h-9 w-14"
                    />
                    <button
                      type="button"
                      onClick={() => setQty(p.id, n + 1)}
                      className="sk-qty-btn h-9 w-9"
                      aria-label={`Aumentar ${p.name}`}
                    >
                      +
                    </button>
                    {/* campos ocultos para enviar produto+quantidade */}
                    <input type="hidden" name="product_id" value={p.id} />
                  </div>
                </li>
                );
              })}
            </ul>
          </section>
        ))}

        <OpenDayAddProduct categories={categories} />

        {/* Caixa inicial */}
        <section className="sk-card p-4">
          <h2 className="mb-3 sk-section-title">
            Caixa inicial
          </h2>
          <div className="flex items-center gap-3">
            <span className="text-2xl font-bold text-neutral-500">R$</span>
            <input
              type="number"
              inputMode="decimal"
              name="initial_cash"
              value={cash}
              onChange={(e) => setCash(e.target.value)}
              placeholder="0,00"
              className="sk-input h-12 text-2xl font-bold tabular-nums"
            />
          </div>
        </section>

        {state?.error && (
          <p role="alert" className="sk-alert-error">
            {state.error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="sk-btn-primary w-full py-4 text-lg"
        >
          {pending ? "Abrindo…" : "CONFIRMAR ABERTURA"}
        </button>

        <p className="text-center text-xs sk-text-muted">
          Não é possível abrir outro dia enquanto houver um dia aberto.
        </p>
      </form>
    </PageShell>
  );
}